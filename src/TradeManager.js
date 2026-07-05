const fs = require('fs');
const path = require('path');

function extractText(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    if (Array.isArray(obj)) {
        return obj.map(extractText).join(' ');
    }
    if (typeof obj === 'object') {
        let parts = [];
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const val = obj[key];
                if (typeof val === 'string') {
                    parts.push(val);
                } else if (typeof val === 'object' && val !== null) {
                    parts.push(extractText(val));
                } else if (typeof val === 'number' || typeof val === 'boolean') {
                    parts.push(String(val));
                }
            }
        }
        return parts.join(' ');
    }
    return '';
}

function cleanString(str) {
    if (!str) return '';
    const text = extractText(str);
    return text.replace(/<[^>]*>/g, '') // Remove XML/HTML tags
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '') // Remove Vietnamese diacritics
              .replace(/[?.,!']/g, '') // Remove Vietnamese punctuation
              .trim()
              .replace(/\s+/g, ' '); // Normalize spaces
}

class TradeManager {
    constructor(bot, botId, username, io, tacticalLog) {
        this.bot = bot;
        this.botId = botId;
        this.username = username;
        this.io = io;
        const baseTacticalLog = tacticalLog || ((msg, type) => console.log(`[${type}] ${msg}`));
        this.tacticalLog = (msg, type) => baseTacticalLog(`[${this.username}] ${msg}`, type);
        this.active = false;
        
        // Lệnh mở shop mặc định
        this.shopCmd = '/shop';
        
        // Trạng thái chu kỳ giao dịch: 'buy' hoặc 'sell'
        this.step = 'buy';
        
        // Biến điều khiển
        this.loopTimeout = null;
        this.windowTimeout = null;
        this.currentWindow = null;
        
        this.onWindowOpen = this.onWindowOpen.bind(this);
        this.onWindowClose = this.onWindowClose.bind(this);
 
        // Cấu hình tốc độ giao dịch (tính bằng ms) - Đã tối ưu hóa cực hạn cho mốc 35 phút
        this.delayInitial = 300;         // Chờ sau khi mở GUI để tránh lag click
        this.delayBetweenClicks = 180;   // Chờ giữa các lượt click chọn +1 stack
        this.delayAction = 200;          // Chờ sau các hành động click chọn lượng
        this.delayConfirm = 300;         // Chờ sau khi xác nhận trước khi đóng GUI
        this.delayWindowClose = 300;     // Chờ sau khi đóng GUI để chạy bước tiếp theo
        this.delayNextStep = 250;        // Thời gian chuẩn bị chuyển mua -> bán
        this.delayNextCycle = 1000;      // Cooldown nghỉ giữa các chu kỳ mua/bán (giảm xuống 1 giây)
    }

    async start() {
        if (this.active) return;
        this.active = true;
        this.step = 'buy'; // Bắt đầu bằng mua hàng
        this.tacticalLog(`💰 Kích hoạt chế độ TỰ ĐỘNG THƯƠNG NHÂN (Mua rẻ Thức ăn - Bán đắt Nông sản) cho ${this.username}!`, 'success');
        
        this.loadCustomCommands();
        this.runTradeStep();
    }

    stop() {
        this.active = false;
        this.cleanupTimeouts();
        this.cleanupListeners();
        
        if (this.bot && this.bot.currentWindow) {
            try {
                this.bot.closeWindow(this.bot.currentWindow);
            } catch (e) {}
        }
        
        this.tacticalLog(`🛑 Đã dừng chế độ tự động mua/bán đồ của ${this.username}.`, 'warning');
    }

    loadCustomCommands() {
        try {
            const accountsPath = path.join(__dirname, '../accounts.json');
            if (fs.existsSync(accountsPath)) {
                const accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
                const accInfo = accounts.find(a => a.id === this.botId || a.username === this.username);
                if (accInfo && accInfo.shopCmd) {
                    this.shopCmd = accInfo.shopCmd;
                }
            }
        } catch (e) {
            console.error(`[TradeManager] Lỗi đọc accounts.json:`, e);
        }
    }

    cleanupTimeouts() {
        if (this.loopTimeout) {
            clearTimeout(this.loopTimeout);
            this.loopTimeout = null;
        }
        if (this.windowTimeout) {
            clearTimeout(this.windowTimeout);
            this.windowTimeout = null;
        }
    }

    cleanupListeners() {
        this.bot.removeListener('windowOpen', this.onWindowOpen);
        this.bot.removeListener('windowClose', this.onWindowClose);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async runTradeStep() {
        if (!this.active) return;
        
        this.cleanupTimeouts();
        this.cleanupListeners();
        
        this.bot.on('windowOpen', this.onWindowOpen);
        this.bot.on('windowClose', this.onWindowClose);
        
        const actionText = this.step === 'buy' ? 'MUA QUẢ MỌNG ($1)' : 'BÁN QUẢ MỌNG ($30)';
        this.tacticalLog(`[Giao Dịch] Bắt đầu bước ${actionText}. Gửi lệnh: ${this.shopCmd}`, 'info');
        this.bot.chat(this.shopCmd);
        
        this.windowTimeout = setTimeout(() => {
            this.tacticalLog(`[-] Hết thời gian chờ GUI mở ở bước ${actionText}. Thử lại sau 5 giây...`, 'warning');
            this.retryLater(5000);
        }, 8000);
    }

    retryLater(ms) {
        this.cleanupTimeouts();
        this.cleanupListeners();
        if (this.active) {
            this.loopTimeout = setTimeout(() => this.runTradeStep(), ms);
        }
    }

    async onWindowOpen(window) {
        clearTimeout(this.windowTimeout);
        this.currentWindow = window;
        
        const titleRaw = window.title || '';
        const title = cleanString(titleRaw);
        this.tacticalLog(`[GUI] Mở bảng: "${titleRaw}" (Bước: ${this.step.toUpperCase()})`, 'info');
        
        // Chờ trước khi thực hiện click để an toàn
        await this.sleep(this.delayInitial);
        if (!this.active) return;

        // Chờ cho các ô vật phẩm được tải xong hoàn toàn để tránh click nhầm hoặc dùng fallback sai
        let slotsLoaded = false;
        for (let attempt = 0; attempt < 20; attempt++) {
            const loadedCount = window.slots.filter(s => s !== null).length;
            if (loadedCount >= 5) {
                slotsLoaded = true;
                break;
            }
            await this.sleep(50);
        }
        if (!slotsLoaded) {
            this.tacticalLog(`[GUI] Cảnh báo: Các ô vật phẩm chưa tải xong sau 1 giây.`, 'warning');
        }

        try {
            // 1. GUI Cửa hàng chính (Cửa Hàng Server)
            if (title.includes('cua hang server') || title.includes('shop') || title.includes('menu')) {
                let targetSlot = null;
                
                if (this.step === 'buy') {
                    // Bước Mua: Tìm mục "Thức ăn" (Steak)
                    for (let i = 0; i < window.slots.length; i++) {
                        const item = window.slots[i];
                        if (item) {
                            const displayName = cleanString(item.displayName || '');
                            const customName = cleanString(item.customName || '');
                            if (displayName.includes('thuc an') || customName.includes('thuc an')) {
                                targetSlot = i;
                                break;
                            }
                        }
                    }
                    if (targetSlot === null) {
                        targetSlot = 25; // Steak fallback slot (Thức ăn trong shop chính LuckyVN)
                        this.tacticalLog(`[GUI] Không tìm thấy mục "Thức ăn", sử dụng slot ${targetSlot}`, 'warning');
                    }
                    this.tacticalLog(`[GUI] Click chọn mục Thức ăn (Slot ${targetSlot})...`, 'info');
                } else {
                    // Bước Bán: Tìm mục "Nông sản" (Wheat block)
                    for (let i = 0; i < window.slots.length; i++) {
                        const item = window.slots[i];
                        if (item) {
                            const displayName = cleanString(item.displayName || '');
                            const customName = cleanString(item.customName || '');
                            if (displayName.includes('nong san') || customName.includes('nong san')) {
                                targetSlot = i;
                                break;
                            }
                        }
                    }
                    if (targetSlot === null) {
                        targetSlot = 20; // Wheat block fallback slot (Nông sản trong shop chính LuckyVN)
                        this.tacticalLog(`[GUI] Không tìm thấy mục "Nông sản", sử dụng slot ${targetSlot}`, 'warning');
                    }
                    this.tacticalLog(`[GUI] Click chọn mục Nông sản (Slot ${targetSlot})...`, 'info');
                }
                
                await this.bot.clickWindow(targetSlot, 0, 0);
            } 
            // 2. GUI Thức ăn (Dành cho mua hàng)
            else if (title.includes('thuc an') || title.includes('food')) {
                if (this.step !== 'buy') {
                    this.tacticalLog(`[GUI] Nhầm bảng Thức ăn ở bước Bán. Đóng GUI...`, 'warning');
                    if (this.bot.currentWindow) this.bot.closeWindow(this.bot.currentWindow);
                    this.step = 'buy';
                    return;
                }
                
                let targetSlot = null;
                for (let i = 0; i < window.slots.length; i++) {
                    const item = window.slots[i];
                    if (item) {
                        const name = item.name || '';
                        const displayName = cleanString(item.displayName || '');
                        const customName = cleanString(item.customName || '');
                        
                        if (name.includes('glow_berries') || 
                            displayName.includes('qua mong phat sang') || 
                            customName.includes('qua mong phat sang')) {
                            targetSlot = i;
                            break;
                        }
                    }
                }
                if (targetSlot === null) {
                    targetSlot = 6; // Glow berries fallback slot (Quả mọng phát sáng trong shop LuckyVN)
                    this.tacticalLog(`[GUI] Không quét thấy Quả mọng phát sáng, click slot ${targetSlot}`, 'warning');
                }
                
                this.tacticalLog(`[GUI] Left Click vào Quả mọng phát sáng để MUA (Slot ${targetSlot})...`, 'info');
                await this.bot.clickWindow(targetSlot, 0, 0);
            } 
            // 3. GUI Nông sản (Dành cho bán hàng)
            else if (title.includes('nong san') || title.includes('crop') || title.includes('farm')) {
                if (this.step !== 'sell') {
                    this.tacticalLog(`[GUI] Nhầm bảng Nông sản ở bước Mua. Đóng GUI...`, 'warning');
                    if (this.bot.currentWindow) this.bot.closeWindow(this.bot.currentWindow);
                    this.step = 'buy';
                    return;
                }
                
                let targetSlot = null;
                for (let i = 0; i < window.slots.length; i++) {
                    const item = window.slots[i];
                    if (item) {
                        const name = item.name || '';
                        const displayName = cleanString(item.displayName || '');
                        const customName = cleanString(item.customName || '');
                        
                        if (name.includes('glow_berries') || 
                            displayName.includes('qua mong phat sang') || 
                            customName.includes('qua mong phat sang')) {
                            targetSlot = i;
                            break;
                        }
                    }
                }
                if (targetSlot === null) {
                    targetSlot = 30; // Glow berries fallback slot trong bảng Nông sản
                    this.tacticalLog(`[GUI] Không quét thấy Quả mọng phát sáng, click slot ${targetSlot}`, 'warning');
                }
                
                // Click chuột phải để bán: mouseButton = 1 (Right click), mode = 0 (Normal click)
                this.tacticalLog(`[GUI] Right Click vào Quả mọng phát sáng để mở bảng Bán (Slot ${targetSlot})...`, 'info');
                await this.bot.clickWindow(targetSlot, 1, 0);
            } 
            // 4a. GUI Chọn số lượng để mua (Bước trung gian trước khi chọn Stack)
            else if (title.includes('chon so luong') && title.includes('mua') && !title.includes('stack')) {
                let targetSlot = 31; // fallback chest slot
                for (let i = 0; i < window.slots.length; i++) {
                    const item = window.slots[i];
                    if (item && item.name.includes('chest')) {
                        targetSlot = i;
                        break;
                    }
                }
                this.tacticalLog(`[GUI] Click vào Rương để chọn số lượng Stacks ở Slot ${targetSlot}...`, 'info');
                await this.bot.clickWindow(targetSlot, 0, 0);
            }
            // 4b. GUI Chọn số lượng Stacks của vật phẩm (Chỉ chạy ở bước Mua)
            else if ((title.includes('chon so luong') && title.includes('stack')) || title.includes('amount') || title.includes('quantity')) {
                let slot1Stack = null;
                let slot32Stacks = null;
                let slotConfirm = null;
                
                for (let i = 0; i < window.slots.length; i++) {
                    const item = window.slots[i];
                    if (item) {
                        const name = item.name || '';
                        const displayName = cleanString(item.displayName || '');
                        const customName = cleanString(item.customName || '');
                        
                        if (customName.includes('+1') && !customName.includes('+16')) {
                            slot1Stack = i; // Nút mua 1 stack (quả mọng)
                        } else if (customName.includes('+32')) {
                            slot32Stacks = i; // Nút mua 32 stacks
                        } else if (customName.includes('an de mua') || customName.includes('an đe mua') || customName.includes('xac nhan')) {
                            slotConfirm = i; // Nút xác nhận mua
                        }
                    }
                }
                
                // Thiết lập chỉ số fallback nếu không quét được
                if (slot1Stack === null) slot1Stack = 23;
                if (slot32Stacks === null) slot32Stacks = 25;
                if (slotConfirm === null) slotConfirm = 13;
                
                // Bước 1: Mua 32 stacks
                this.tacticalLog(`[GUI] Click chọn mua 32 stacks ở Slot ${slot32Stacks}...`, 'info');
                await this.bot.clickWindow(slot32Stacks, 0, 0);
                
                await this.sleep(this.delayAction);
                if (!this.active) return;
                
                // Bước 2: ĐÃ BỎ QUA CLICK LẺ (Chỉ mua đúng 32 stacks để tối ưu chu kỳ cày tiền)
                
                // Bước 3: Xác nhận giao dịch
                this.tacticalLog(`[GUI] Click rương/giấy xác nhận mua hàng ở Slot ${slotConfirm}...`, 'info');
                await this.bot.clickWindow(slotConfirm, 0, 0);
                
                await this.sleep(this.delayConfirm);
                if (this.bot.currentWindow) {
                    this.bot.closeWindow(this.bot.currentWindow);
                }
                
                // Chuyển bước tiếp theo sang Bán
                this.step = 'sell';
            } 
            // 5. GUI Chọn số lượng hàng để bán (Chỉ chạy ở bước Bán)
            else if ((title.includes('chon so luong') && title.includes('ban')) || title.includes('sell') || title.includes('ban tat ca')) {
                let slotSellAll = null;
                for (let i = 0; i < window.slots.length; i++) {
                    const item = window.slots[i];
                    if (item) {
                        const name = item.name || '';
                        const displayName = cleanString(item.displayName || '');
                        const customName = cleanString(item.customName || '');
                        
                        if (name.includes('emerald') || customName.includes('ban tat ca') || displayName.includes('ban tat ca') || customName.includes('tat ca')) {
                            slotSellAll = i;
                            break;
                        }
                    }
                }
                if (slotSellAll === null) slotSellAll = 30; // fallback
                this.tacticalLog(`[GUI] Click nút bán tất cả ở Slot ${slotSellAll}...`, 'success');
                await this.bot.clickWindow(slotSellAll, 0, 0);
                
                await this.sleep(this.delayConfirm);
                if (this.bot.currentWindow) {
                    this.bot.closeWindow(this.bot.currentWindow);
                }
                
                // Trở về bước Mua cho vòng tiếp theo
                this.step = 'buy';
            }
        } catch (err) {
            this.tacticalLog(`[-] Lỗi tương tác GUI: ${err.message}`, 'error');
            this.retryLater(5000);
        }
    }

    async onWindowClose(window) {
        this.currentWindow = null;
        this.tacticalLog(`[GUI] Giao diện đã đóng.`, 'info');
        
        await this.sleep(this.delayWindowClose);
        if (!this.active) return;
        
        if (this.step === 'sell') {
            this.tacticalLog(`[Giao Dịch] Mua hoàn tất. Chuyển sang bước BÁN HÀNG...`, 'info');
            this.retryLater(this.delayNextStep);
        } else {
            this.tacticalLog(`[Giao Dịch] Chu kỳ hoàn tất! Chờ ${this.delayNextCycle / 1000} giây trước khi mua vòng tiếp theo...`, 'success');
            this.retryLater(this.delayNextCycle);
        }
    }
}

module.exports = TradeManager;
