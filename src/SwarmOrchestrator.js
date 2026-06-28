const EventEmitter = require('events');

/**
 * 🛡️ Stealth AFK Ladder Orchestrator
 * Triển khai theo thuật toán đã chốt tại: docs/vault/tech-stack/afk-ladder-algorithm.md
 */
class SwarmOrchestrator extends EventEmitter {
    constructor(serverIo) {
        super();
        this.io = serverIo;
        
        // Định nghĩa cấp bậc cứng (Acc 1 ưu tiên cao nhất)
        this.hierarchy = ['TuringBot_01', 'TuringBot_02', 'TuringBot_03'];
        
        // Quản lý trạng thái
        this.activeBots = new Map(); // username -> bot instance
        this.afkStats = new Map(); // username -> afk hours
        
        // Stealth Configs
        this.checkIntervalMs = 2 * 60 * 60 * 1000; // Đọc Top mỗi 2 tiếng
        this.currentMarginHours = this.generateJitterMargin(); // Margin ngẫu nhiên ban đầu
        
        this.monitorInterval = null;
        this.tacticalLog("🚀 Khởi tạo Swarm Orchestrator với Jitter Margin: " + this.currentMarginHours.toFixed(2) + "h", "success");
    }

    tacticalLog(message, type = 'info') {
        console.log(`[Swarm Orchestrator] ${message}`);
        if (this.io) {
            this.io.emit('bot_log', { message: `[Orchestrator] ${message}`, type });
        }
    }

    /**
     * Thuật toán Jitter Margin: Ngẫu nhiên từ 1 đến 3 tiếng (Anti-ban)
     */
    generateJitterMargin() {
        // Random float from 1.0 to 3.0
        return (Math.random() * 2) + 1;
    }

    /**
     * Bắt đầu vòng lặp cảm biến tàng hình
     */
    startSensorLoop() {
        if (this.monitorInterval) clearInterval(this.monitorInterval);
        
        this.tacticalLog("Bật cảm biến Stealth Sensor (Chu kỳ 2h/lần)...", "info");
        this.monitorInterval = setInterval(() => {
            this.executeSensorTick();
        }, this.checkIntervalMs);
        
        // Chạy ngay lần đầu
        this.executeSensorTick();
    }

    stopSensorLoop() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
    }

    /**
     * Chu kỳ quét Bảng xếp hạng và Phân tích lệch pha
     */
    executeSensorTick() {
        this.tacticalLog("Đang đọc bảng xếp hạng /top AFK...", "info");
        
        // Sinh Jitter mới cho chu kỳ này để lừa Admin
        this.currentMarginHours = this.generateJitterMargin();
        this.tacticalLog(`Jitter Margin mới được thiết lập: ${this.currentMarginHours.toFixed(2)}h`, "warning");

        // Gửi lệnh vào game để đọc /top
        // Ở đây giả lập việc lấy dữ liệu từ GUI /top (Vì chưa code Parser cụ thể)
        this.fetchMockAfkTimes();

        // Chạy logic Asymmetric Auto-Rest (Hi sinh thằng em bảo vệ thằng anh)
        this.enforceLadderConstraints();
    }

    fetchMockAfkTimes() {
        // Fake data để test logic trước
        // Đáng lẽ ra phải lấy từ activeBots.get('TuringBot_01').chat('/top afk') và parse string
        this.hierarchy.forEach((username, index) => {
            let currentHours = this.afkStats.get(username) || 0;
            // Mỗi 2h trôi qua, thằng nào đang active thì được +2h
            if (this.activeBots.has(username)) {
                currentHours += 2; 
            }
            this.afkStats.set(username, currentHours);
        });
        
        // Gửi về Frontend (Dashboard)
        const statsObj = Object.fromEntries(this.afkStats);
        if (this.io) this.io.emit('swarm_afk_stats', statsObj);
    }

    /**
     * Thuật toán Thực thi Ngắt - Nghỉ (Asymmetric Auto-Rest)
     */
    enforceLadderConstraints() {
        for (let i = 0; i < this.hierarchy.length - 1; i++) {
            const highPriUser = this.hierarchy[i];
            const lowPriUser = this.hierarchy[i + 1];

            const highAfk = this.afkStats.get(highPriUser) || 0;
            const lowAfk = this.afkStats.get(lowPriUser) || 0;

            const currentGap = highAfk - lowAfk;

            if (currentGap < this.currentMarginHours) {
                // Khoảng cách quá gần! Nguy cơ vỡ trật tự
                this.tacticalLog(`CẢNH BÁO: ${lowPriUser} (${lowAfk}h) đang đuổi sát ${highPriUser} (${highAfk}h). Gap: ${currentGap}h < ${this.currentMarginHours.toFixed(2)}h`, "error");
                
                if (this.activeBots.has(lowPriUser)) {
                    this.tacticalLog(`=> Đang NGẮT KẾT NỐI (Hi sinh) ${lowPriUser} để giữ khoảng cách an toàn!`, "error");
                    this.disconnectBot(lowPriUser, "Asymmetric Auto-Rest Protocol");
                }
            } else {
                // Khoảng cách an toàn. Có thể cho thằng em đăng nhập lại nếu đang nghỉ
                if (!this.activeBots.has(lowPriUser)) {
                    this.tacticalLog(`Khoảng cách an toàn (${currentGap}h). Cho phép ${lowPriUser} Login tiếp tục cày.`, "success");
                    this.emit('request_login', lowPriUser);
                }
            }
        }
    }

    /**
     * API để Server đăng ký Bot vào Swarm khi nó login thành công
     */
    registerBot(username, botInstance) {
        this.activeBots.set(username, botInstance);
        this.tacticalLog(`${username} đã gia nhập Hạm Đội (Swarm).`, "success");
    }

    /**
     * API để ngắt kết nối
     */
    disconnectBot(username, reason = "Forced by Orchestrator") {
        const bot = this.activeBots.get(username);
        if (bot) {
            bot.quit(reason);
            this.activeBots.delete(username);
        }
    }
}

module.exports = SwarmOrchestrator;
