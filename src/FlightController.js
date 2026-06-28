const { Vec3 } = require('vec3');

// Sinh Generator tạo Perlin Noise 1D mượt mà để chống lại AI soi "Sine-Wave"
class Simple1DNoise {
    constructor() {
        this.MAX_VERTICES = 256;
        this.r = [];
        for (let i = 0; i < this.MAX_VERTICES; ++i) {
            this.r.push(Math.random());
        }
    }
    getVal(x) {
        let xFloor = Math.floor(x);
        let t = x - xFloor;
        let tRemapSmoothstep = t * t * (3 - 2 * t);
        let xMin = xFloor % this.MAX_VERTICES;
        let xMax = (xMin + 1) % this.MAX_VERTICES;
        let y = (this.r[xMin] * (1 - tRemapSmoothstep) + this.r[xMax] * tRemapSmoothstep);
        return y * 2 - 1; // Trả về [-1, 1]
    }
}

class FlightController {
    constructor(bot) {
        this.bot = bot;
        this.isFlying = false;
        this.mode = 'ELYTRA_MODE'; 
        this.targetY = 200; 
        
        this.lastFireworkTime = 0;
        this.noiseGen = new Simple1DNoise();
        this.noiseTime = 0;
        
        // Trạng thái bị đánh văng (Knockback)
        this.isBeingKnockedBack = false;
        
        this._syncWithServerTick = this.syncWithServerTick.bind(this);
        
        // Lắng nghe hiện tượng văng (Knockback) hoặc Teleport ép buộc từ Server
        this.bot.on('forcedMove', () => this.handleKnockback());
        this.bot.on('entityHurt', (entity) => {
            if (entity === this.bot.entity) this.handleKnockback();
        });
    }

    startFlying(mode = 'ELYTRA_MODE', targetAltitude = 200) {
        if (this.isFlying) return;
        this.mode = mode;
        this.targetY = targetAltitude;
        this.isFlying = true;
        
        console.log(`[FlightCore] 🛫 Cất cánh! Target Y=${this.targetY}`);
        
        // Hook thẳng vào Server Tick thay vì setInterval Node.js
        this.bot.on('physicTick', this._syncWithServerTick);
        this.bot.setControlState('jump', true);
    }

    stopFlying() {
        if (!this.isFlying) return;
        this.isFlying = false;
        this.bot.removeListener('physicTick', this._syncWithServerTick);
        this.bot.setControlState('jump', false);
        console.log(`[FlightCore] 🛬 Đã tắt động cơ.`);
    }

    /**
     * Đồng bộ pha Server (Server-Tick Synchronization)
     * Tránh việc Node.js xử lý quá nhanh khi Server TPS bị tụt
     */
    syncWithServerTick() {
        if (!this.isFlying) return;

        // Nếu đang bị đánh văng, bỏ qua mọi can thiệp vật lý để "ăn đòn tự nhiên"
        if (this.isBeingKnockedBack) return;

        const currentY = this.bot.entity.position.y;

        if (currentY >= this.targetY) {
            this.hoverWithPerlinNoise();
        } else {
            if (this.mode === 'ELYTRA_MODE') {
                this.handleElytraFlight();
            }
        }
    }

    /**
     * Xử lý Knockback một cách "nhân đạo"
     */
    handleKnockback() {
        if (!this.isFlying || this.isBeingKnockedBack) return;
        console.log("⚠️ [FlightCore] BỊ KNOCKBACK! Ngắt động cơ bay để văng tự nhiên (Anti-Velocity Check)!");
        
        this.isBeingKnockedBack = true;
        
        // Giả lập người chơi "choáng váng" mất 2 giây mới lấy lại thăng bằng
        setTimeout(() => {
            console.log("[FlightCore] Đã lấy lại thăng bằng. Quay về tọa độ Vàng qua đường vòng cung...");
            this.isBeingKnockedBack = false;
        }, 2000);
    }

    handleElytraFlight() {
        const velocity = this.bot.entity.velocity;

        if (velocity.y <= 0 && Date.now() - this.lastFireworkTime > 1500) {
            const firework = this.bot.inventory.items().find(item => item.name.includes('firework_rocket'));
            if (firework) {
                this.bot.equip(firework, 'hand').then(() => {
                    this.bot.activateItem(); 
                    this.lastFireworkTime = Date.now();
                }).catch(err => console.error("[FlightCore] ❌ Lỗi cầm pháo hoa!"));
            } else {
                console.log("🚨 HẾT PHÁO HOA! KÍCH HOẠT HẠ CÁNH KHẨN CẤP!");
                this.stopFlying();
            }
        }

        this.bot.look(this.bot.entity.yaw, -0.2, true); 
    }

    /**
     * Jitter Hover bằng Perlin Noise
     */
    hoverWithPerlinNoise() {
        this.noiseTime += 0.1;
        // Tạo nhiễu trong khoảng [-0.015, +0.015] block
        const jitterY = this.noiseGen.getVal(this.noiseTime) * 0.015;
        
        // Thay vì ép tọa độ (Teleport), chúng ta tiêm lực đẩy (Velocity) siêu nhỏ
        // Đánh lừa Anti-cheat rằng người chơi đang rớt xuống và bù lực kéo lại
        this.bot.entity.velocity.set(0, jitterY, 0);
        
        // Cờ vô cùng quan trọng: báo cho server Bot đang không đứng trên đất
        this.bot.entity.onGround = false; 
    }

    lockAltitudeForVault() {
        console.log("[FlightCore] 🔒 Đang mở Rương. Tạm chuyển sang Hover Perlin!");
        const oldMode = this.mode;
        this.mode = 'ELYTRA_MODE'; 
        
        return () => {
            console.log("[FlightCore] 🔓 Nhả khóa độ cao.");
            this.mode = oldMode;
        };
    }
}

module.exports = FlightController;
