class VaultManager {
    constructor(bot) {
        this.bot = bot;
        this.minVault = 1;
        this.maxVaults = 5; // Default fallback, configurable via UI
        this.currentVaultIndex = this.minVault;
        this.isProcessing = false;
    }

    /**
     * Dừng X giây (dùng để chống Command Spam và Ghost Items)
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Set số lượng kho từ Config (Tự động)
     */
    setVaultBounds(start, end) {
        this.minVault = start;
        this.maxVaults = end;
        this.currentVaultIndex = this.minVault;
        console.log(`[VaultManager] Giới hạn rương được nạp: Từ /pv ${this.minVault} đến /pv ${this.maxVaults}`);
    }

    /**
     * Thực hiện việc mở kho và chuyển đồ bằng Task Queue Promise
     * Có tích hợp Exponential Backoff và bắt lỗi GUI Close.
     */
    async openAndStash(itemsToStash) {
        if (this.bot.flightCore && this.bot.flightCore.isBeingKnockedBack) {
            console.log("⚠️ [VaultManager] Đang bị Knockback! Tạm dừng mọi giao dịch mở rương để tránh cờ nghi vấn từ Server.");
            return false;
        }

        if (this.isProcessing) {
            console.log("[VaultManager] Đang xử lý một tiến trình cất đồ khác, bỏ qua...");
            return;
        }

        if (this.currentVaultIndex > this.maxVaults) {
            console.log("🚨 [VaultManager] TẤT CẢ CÁC KHO ĐÃ ĐẦY! Đang vào chế độ Panic Mode.");
            // TODO: Bắn webhook qua Telegram báo động đỏ.
            return false;
        }

        this.isProcessing = true;
        let attempt = 1;
        const maxAttempts = 3;

        while (attempt <= maxAttempts) {
            try {
                console.log(`[VaultManager] Đang mở /pv ${this.currentVaultIndex} (Lần thử ${attempt})...`);
                await this.executeVaultTask(itemsToStash);
                console.log(`[VaultManager] Cất đồ thành công vào /pv ${this.currentVaultIndex}!`);
                this.isProcessing = false;
                return true; // Thành công

            } catch (error) {
                console.error(`[VaultManager] ❌ Lỗi GUI: ${error.message}`);
                
                // Đóng rương để reset trạng thái an toàn
                if (this.bot.currentWindow) {
                    this.bot.closeWindow(this.bot.currentWindow);
                }

                if (error.message === 'VAULT_FULL') {
                    console.log(`[VaultManager] Kho /pv ${this.currentVaultIndex} đã đầy. Đổi kho tiếp theo...`);
                    this.currentVaultIndex++;
                    attempt = 1; // Reset attempt cho kho mới
                    continue; 
                }

                // Exponential Backoff (3s, 6s, 12s)
                const backoffDelay = 3000 * Math.pow(2, attempt - 1);
                console.log(`[VaultManager] ⏳ Đợi ${backoffDelay/1000}s trước khi thử lại...`);
                await this.sleep(backoffDelay);
                attempt++;
            }
        }

        console.log("[VaultManager] 💥 Bỏ cuộc sau 3 lần thử mở rương thất bại.");
        this.isProcessing = false;
        return false;
    }

    /**
     * Logic Core: Gõ lệnh -> Đợi Window -> Chuyển Item -> Đóng Window
     */
    executeVaultTask(itemsToStash) {
        return new Promise((resolve, reject) => {
            let windowTimeout;
            
            // Xử lý sự kiện cửa sổ đóng bất thình lình
            const onWindowClose = () => {
                cleanup();
                reject(new Error("Cửa sổ bị đóng bất thình lình (State Lock Guard)."));
            };

            // Dọn dẹp Listener để tránh Memory Leak
            const cleanup = () => {
                clearTimeout(windowTimeout);
                this.bot.removeListener('windowOpen', onWindowOpen);
                this.bot.removeListener('windowClose', onWindowClose);
            };

            // Hàm chờ mở rương
            const onWindowOpen = async (window) => {
                clearTimeout(windowTimeout); // Đã mở rương thành công, hủy timeout

                // Kiểm tra xem đây có phải là rương thật không
                if (window.type !== 'minecraft:generic_9x3' && window.type !== 'minecraft:generic_9x6') {
                    cleanup();
                    return reject(new Error("Mở nhầm GUI không phải là rương."));
                }

                console.log("[VaultManager] 📦 Rương đã mở, bắt đầu cất đồ...");
                
                try {
                    for (const item of itemsToStash) {
                        const botItem = this.bot.inventory.items().find(i => i.name === item);
                        if (!botItem) continue;

                        // Chuyển đồ vào rương
                        // Lưu ý: hàm deposit() của mineflayer tự động chuyển toàn bộ stack
                        await this.bot.deposit(window.type, null, botItem.type, botItem.metadata, botItem.count);
                        
                        // Chống Ghost Item (Delay 300ms)
                        await this.sleep(300);
                    }

                    // Kiểm tra xem rương có bị đầy không (Tạm thời giả lập bằng cách đếm slot trống trong rương)
                    if (window.emptySlotCount() === 0) {
                        cleanup();
                        this.bot.closeWindow(window);
                        return reject(new Error('VAULT_FULL'));
                    }

                    // Thành công trót lọt
                    this.bot.closeWindow(window);
                    cleanup();
                    resolve();

                } catch (transferErr) {
                    cleanup();
                    reject(new Error(`Lỗi chuyển đồ: ${transferErr.message}`));
                }
            };

            // 1. Lắng nghe trước khi gõ lệnh
            this.bot.on('windowOpen', onWindowOpen);
            this.bot.on('windowClose', onWindowClose);

            // 2. Timeout an toàn: Nếu 5 giây mà cửa sổ không mở -> Lỗi Lag
            windowTimeout = setTimeout(() => {
                cleanup();
                reject(new Error("Timeout: Đợi 5 giây nhưng GUI rương không bật lên."));
            }, 5000);

            // 3. Gõ lệnh mở rương
            this.bot.chat(`/pv ${this.currentVaultIndex}`);
        });
    }
}

module.exports = VaultManager;
