const { Movements, goals } = require('mineflayer-pathfinder');
const fs = require('fs');
const path = require('path');

class DungeonManager {
    constructor(bot, botId, username, io, tacticalLog) {
        this.bot = bot;
        this.botId = botId;
        this.username = username;
        this.io = io;
        this.tacticalLog = tacticalLog || ((msg, type) => console.log(`[${type}] ${msg}`));
        this.spawnPos = null;
        this.dungeonActive = false;
        this.combatInterval = null;
        this.isNavigatingToSpawn = false;
    }

    start() {
        this.tacticalLog(`[Dungeon] ${this.username} bắt đầu quy trình vào phó bản (/phoban)...`, 'info');
        
        // Gửi lệnh /phoban
        this.bot.chat('/phoban');

        // Lắng nghe giao diện mở ra
        const windowOpenHandler = (window) => {
            const title = window.title ? window.title : '';
            this.tacticalLog(`[Dungeon] Giao diện phó bản mở ra: "${title}"`, 'info');

            // Đọc cấu hình để biết cần click vào ô nào
            const accountsPath = path.join(__dirname, '../accounts.json');
            let accounts = [];
            try {
                accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
            } catch (e) {
                this.tacticalLog(`[Dungeon] Lỗi đọc accounts.json: ${e.message}`, 'error');
            }
            const accInfo = accounts.find(a => a.id === this.botId) || {};

            let targetSlot = null;
            if (accInfo.phobanSlot !== undefined && accInfo.phobanSlot !== null) {
                targetSlot = accInfo.phobanSlot;
            } else {
                // Tự động quét ô có vật phẩm trùng khớp (Ví dụ: emerald đại diện cho Pillager II)
                const targetItemName = accInfo.phobanItem || 'emerald';
                for (let i = 0; i < window.slots.length; i++) {
                    const item = window.slots[i];
                    if (item && item.name.toLowerCase().includes(targetItemName.toLowerCase())) {
                        targetSlot = i;
                        break;
                    }
                }
            }

            if (targetSlot !== null) {
                this.tacticalLog(`[Dungeon] Click chọn ô Phó Bản (Slot ${targetSlot})...`, 'info');
                this.bot.clickWindow(targetSlot, 0, 0);
            } else {
                this.tacticalLog(`[Dungeon] Không tìm thấy ô phó bản phù hợp trong GUI!`, 'warning');
            }
        };

        this.bot.once('windowOpen', windowOpenHandler);

        // Đợi 5 giây để teleport và tải xong phó bản, sau đó lưu tọa độ spawn và bắt đầu combat loop
        setTimeout(() => {
            if (!this.bot || !this.bot.entity) return;
            this.spawnPos = this.bot.entity.position.clone();
            this.tacticalLog(`[Dungeon] Đã lưu tọa độ spawn phó bản: X:${this.spawnPos.x.toFixed(1)} Y:${this.spawnPos.y.toFixed(1)} Z:${this.spawnPos.z.toFixed(1)}`, 'success');
            
            this.dungeonActive = true;
            this.trySit();
            this.startCombatLoop();
        }, 5000);
    }

    trySit() {
        if (!this.bot) return;
        this.tacticalLog(`[Dungeon] ${this.username} gửi lệnh ngồi xuống (/sit)...`, 'info');
        this.bot.chat('/sit');
    }

    startCombatLoop() {
        if (this.combatInterval) clearInterval(this.combatInterval);

        this.combatInterval = setInterval(() => {
            if (!this.bot || !this.bot.entity) return;

            // Xử lý kiểm tra balo đầy và bán đồ (Ý tưởng - Chưa kích hoạt theo yêu cầu)
            this.handleFullBackpackSell();

            // Nhận diện trạng thái ngồi: bot.vehicle !== null nghĩa là bot đang cưỡi/ngồi trên thực thể ẩn
            const isSitting = this.bot.vehicle !== null;

            if (isSitting) {
                this.isNavigatingToSpawn = false;

                // Nếu đang di chuyển bằng pathfinder thì dừng lại để giữ trạng thái ngồi
                if (this.bot.pathfinder && this.bot.pathfinder.isMoving()) {
                    this.bot.pathfinder.setGoal(null);
                }

                // Quét quái chủ động xung quanh phạm vi gần (4 block) và tiêu diệt
                const hostiles = this.getHostileMobs(4);
                if (hostiles.length > 0) {
                    this.attackEntity(hostiles[0]);
                }
            } else {
                // Trạng thái không ngồi được (đang bị quái đánh hoặc bị đẩy ra)
                const hostiles = this.getHostileMobs(10);

                if (hostiles.length > 0) {
                    // Tập trung đánh quái gần nhất trước
                    const target = hostiles[0];
                    this.isNavigatingToSpawn = false;

                    if (this.bot.pathfinder) {
                        const dist = this.bot.entity.position.distanceTo(target.position);
                        if (dist > 3) {
                            // Di chuyển tiếp cận quái vật
                            const defaultMove = new Movements(this.bot);
                            this.bot.pathfinder.setMovements(defaultMove);
                            this.bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true);
                        } else {
                            this.bot.pathfinder.setGoal(null);
                        }
                    }

                    this.attackEntity(target);
                } else {
                    // Đã dọn sạch quái, đi chuyển về vị trí spawn ban đầu để ngồi xuống
                    if (this.spawnPos) {
                        const distToSpawn = this.bot.entity.position.distanceTo(this.spawnPos);
                        if (distToSpawn > 1.5) {
                            if (!this.isNavigatingToSpawn) {
                                this.tacticalLog(`[Dungeon] Xung quanh hết quái. Di chuyển về tọa độ spawn ban đầu để ngồi...`, 'info');
                                this.isNavigatingToSpawn = true;
                                const defaultMove = new Movements(this.bot);
                                defaultMove.allowFreeClearance = true;
                                this.bot.pathfinder.setMovements(defaultMove);
                                this.bot.pathfinder.setGoal(new goals.GoalBlock(this.spawnPos.x, this.spawnPos.y, this.spawnPos.z));
                            }
                        } else {
                            // Đã về đến tọa độ ban đầu, dừng di chuyển và thực hiện ngồi
                            if (this.bot.pathfinder) {
                                this.bot.pathfinder.setGoal(null);
                            }
                            this.isNavigatingToSpawn = false;
                            this.trySit();
                        }
                    }
                }
            }
        }, 500);
    }

    attackEntity(entity) {
        if (!this.bot || !entity) return;
        
        // Nhìn vào quái vật
        this.bot.lookAt(entity.position.offset(0, entity.height * 0.8, 0));
        
        // Vung tay và tấn công
        this.bot.swingArm();
        this.bot.attack(entity);
    }

    getHostileMobs(radius) {
        const list = [];
        if (!this.bot || !this.bot.entities) return list;

        for (const id in this.bot.entities) {
            const entity = this.bot.entities[id];
            if (!entity || entity.type !== 'mob') continue;

            const dist = this.bot.entity.position.distanceTo(entity.position);
            if (dist > radius) continue;

            const name = entity.name ? entity.name.toLowerCase() : '';
            const isPassive = [
                'cow', 'sheep', 'pig', 'chicken', 'villager', 'iron_golem', 'squid', 
                'bat', 'horse', 'donkey', 'mule', 'llama', 'wolf', 'cat', 'parrot', 
                'bee', 'cod', 'salmon', 'pufferfish', 'tropical_fish', 'turtle'
            ].includes(name);

            if (!isPassive) {
                list.push(entity);
            }
        }

        return list.sort((a, b) => this.bot.entity.position.distanceTo(a.position) - this.bot.entity.position.distanceTo(b.position));
    }

    handleFullBackpackSell() {
        // Ý TƯỞNG: Nếu phát hiện balo đầy thì tự động bán đồ (Chưa kích hoạt theo yêu cầu)
        /*
        if (!this.bot || !this.bot.inventory) return;
        const emptySlots = this.bot.inventory.emptySlotCount();
        if (emptySlots === 0) {
            this.tacticalLog(`[Bán Đồ - Ý Tưởng] Balo đầy! Thực hiện lệnh bán tự động...`, 'info');
            this.bot.chat('/sell all');
        }
        */
    }

    stop() {
        this.dungeonActive = false;
        if (this.combatInterval) {
            clearInterval(this.combatInterval);
            this.combatInterval = null;
        }
        if (this.bot && this.bot.pathfinder) {
            this.bot.pathfinder.setGoal(null);
        }
    }
}

module.exports = DungeonManager;
