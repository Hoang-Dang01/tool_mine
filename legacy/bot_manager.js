const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const autoeat = require('mineflayer-auto-eat').loader;

const SERVER_CONFIG = {
    host: "global.luckyvn.com",
    fakeHost: "mc.luckyvn.com",
    version: "1.18.1"
};

// Còi Báo Động Sang Điện Thoại Chủ Nhân
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1495652104185057423/7YmKZrrHUp1bq81aWzdHQCjv_c-bx7XAO2xREGXbTLDeAfmvEolvK6CECpC0PJ_GYSXf";

async function sendDiscordAlert(botName, title, desc, colorHex = 0xff5555) {
    if (!DISCORD_WEBHOOK_URL) return;
    try {
        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: `🤖 [${botName}] - ${title}`,
                    description: desc,
                    color: colorHex,
                    footer: { text: "Master Bot Skynet" },
                    timestamp: new Date().toISOString()
                }]
            })
        });
    } catch (e) {
        console.error("Gửi còi qua Discord thất bại: ", e.message);
    }
}

const fs = require('fs');
const path = require('path');
const LOCATIONS_FILE = path.join(__dirname, 'locations.json');

function getLocations() {
    if (!fs.existsSync(LOCATIONS_FILE)) return { afk_spots: [], npc_trade: null };
    return JSON.parse(fs.readFileSync(LOCATIONS_FILE, 'utf8'));
}

function saveLocations(locations) {
    fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(locations, null, 4));
}

// ==========================================
// KHU VỰC CẤU HÌNH CHO SMART AFK VÀ AUTO TRADE
// ==========================================

// Cấu hình kịch bản Auto Trade (Vị trí NPC đã dời vào locations.json)
const TRADE_CONFIG = {
    tradeSlot: 0,                         // Vị trí món đồ cần đổi trong khung Trade (Tính từ 0)
    itemToStore: 'diamond',               // Tên tiếng anh của vật phẩm muốn cất
    pvList: [1, 2, 3, 4, 5],              // Danh sách thứ tự PV sẽ cất vào
    intervalMs: 3600000                   // Thời gian lặp lại kịch bản (VD: 3600000 = 1 Tiếng)
};

const bots = {}; // Storage cho các tiến trình bot
const botConfigs = {}; // Thông số cấu hình (Mode, PvP, AFK Spot) có thể chỉnh sửa trực tiếp lúc đang chạy
const reconnectTimers = {}; // Lưu trữ bộ đếm hẹn giờ hồi sinh
const tradeLoops = {}; // Lưu trữ bộ đếm vòng lặp Trade đồ tự động

// Xử lý đọc tên JSON
function docTenVatPham(jsonString) {
    if (!jsonString) return "";
    if (typeof jsonString !== 'string' || (!jsonString.startsWith('{') && !jsonString.startsWith('['))) {
        return jsonString.replace(/§[0-9a-fk-or]/gi, '');
    }
    try {
        const obj = JSON.parse(jsonString);
        let tenThuc = "";
        function layText(o) {
            if (typeof o === 'string') { tenThuc += o; return; }
            if (Array.isArray(o)) { for (const item of o) layText(item); return; }
            if (typeof o === 'object' && o !== null) {
                if (o.text) tenThuc += o.text;
                if (o.extra) layText(o.extra);
            }
        }
        layText(obj);
        return tenThuc.trim().replace(/§[0-9a-fk-or]/gi, '');
    } catch (e) {
        return typeof jsonString === 'string' ? jsonString.replace(/§[0-9a-fk-or]/gi, '') : '';
    }
}

function sendLog(io, id, message) {
    if (io) {
        io.emit('bot_log', { id, timestamp: new Date(), message });
    }
    console.log(`[${id}] ${message}`);
}

function startBot(accInfo, io) {
    const { id, username, pass } = accInfo;

    if (bots[id]) {
        sendLog(io, id, "Bot đang chạy, không thể khởi động lại.");
        return;
    }

    if (reconnectTimers[id]) {
        clearTimeout(reconnectTimers[id]);
        delete reconnectTimers[id];
    }

    sendLog(io, id, "Đang khởi tạo Bot...");
    io.emit('bot_status', { id, status: 'connecting' });

    const BOT_CONFIG = { ...SERVER_CONFIG, username, pass };
    
    const bot = mineflayer.createBot({
        host: BOT_CONFIG.host,
        port: 25565,
        username: BOT_CONFIG.username,
        auth: 'offline',
        fakeHost: BOT_CONFIG.fakeHost,
        version: BOT_CONFIG.version
    });

    bots[id] = bot;
    bot.status = 'connecting';
    botConfigs[id] = { 
        mode: accInfo.mode || 'afk', 
        pvpEnabled: accInfo.pvpEnabled, 
        afkSpotId: accInfo.afkSpotId, 
        pvStart: accInfo.pvStart || 2,
        pvEnd: accInfo.pvEnd || 5,
        manualStop: false 
    };

    bot.loadPlugin(pathfinder);
    bot.loadPlugin(pvp);
    bot.loadPlugin(autoeat);

    // KỊCH BẢN TỰ ĐỘNG SINH TỒN (AUTO EAT)
    bot.once('spawn', () => {
        bot.autoEat.opts.priority = "foodPoints";
        bot.autoEat.opts.bannedFood = [];
        bot.autoEat.opts.eatingTimeout = 3000;
        bot.autoEat.enableAuto();
    });

    bot.on("autoeat_started", () => {
        sendLog(io, id, "🍖 Đang ăn để hồi phục thể lực...");
    });

    // KỊCH BẢN PHÒNG VỆ (SELF DEFENSE)
    let lastHealth = 20;
    bot.on('health', () => {
        // Lấy dữ liệu công tắc Live (Cho phép cập nhật trên trời)
        if (!botConfigs[id].pvpEnabled) {
            lastHealth = bot.health;
            return;
        }

        if (bot.health < lastHealth) {
            // Khi máu giảm, quét thằng người chơi gần nhất trong vòng 4 block đang khả nghi
            const filter = e => e.type === 'player' && e.username !== bot.username && e.position.distanceTo(bot.entity.position) < 4;
            const attacker = bot.nearestEntity(filter);
            
            if (attacker && bot.pvp) {
                sendLog(io, id, `⚔️ Bị ${attacker.username} tấn công! KÍCH HOẠT SÁT THỦ PHẢN ĐAM...`);
                // Báo động sang điện thoại Khẩn Cấp
                sendDiscordAlert(accInfo.username, "🚨 BỊ TẤN CÔNG KHẨN CẤP", `Phát hiện rớt máu do **${attacker.username}** gây ra!\nĐã kích hoạt Chế độ Tự Vệ sát thủ đập lại nó!`, 0xff0000);

                // Gọi module dí theo và chém liên tục
                bot.pvp.attack(attacker);
            }
        }
        lastHealth = bot.health;
    });

    async function clickDutKhoat(slot) {
        if (slot === null || slot === undefined) return;
        sendLog(io, id, `Đang nhắm bắn vào Slot ${slot}...`);
        try {
            await bot.clickWindow(slot, 0, 0);
            sendLog(io, id, `Đã click Packet thành công vào slot ${slot}!`);
        } catch (err) {
            sendLog(io, id, `Server từ chối lệnh click: ${err.message}`);
        }
    }

    bot.on('windowOpen', async (window) => {
        sendLog(io, id, `Bảng hiện ra: ${window.title}`);
        await new Promise(res => setTimeout(res, 2000));
        const title = window.title ? window.title.toUpperCase() : "";

        if (title.includes('MENU') || title.includes('NETWORK')) {
            let slotTarget = 20;
            for (let i = 0; i < window.slots.length; i++) {
                const item = window.slots[i];
                if (item) {
                    const customText = item.customName ? item.customName.toUpperCase() : "";
                    const vanillaText = item.displayName ? item.displayName.toUpperCase() : "";
                    if (customText.includes('SKYBLOCK') || vanillaText.includes('SKYBLOCK')) {
                        slotTarget = i;
                        sendLog(io, id, `MENU CHÍNH: Tìm thấy lệnh đi Skyblock tại ô số ${i}`);
                        break;
                    }
                }
            }
            await clickDutKhoat(slotTarget);
        }
        else if (title.includes('LUCKYVN') && title.includes('SKYBLOCK')) {
            let slotTarget = 33;
            for (let i = 0; i < window.slots.length; i++) {
                const item = window.slots[i];
                if (item) {
                    const customText = item.customName ? item.customName.toUpperCase() : "";
                    const vanillaText = item.displayName ? item.displayName.toUpperCase() : "";
                    if (customText.includes('SPRING') || vanillaText.includes('SPRING')) {
                        slotTarget = i;
                        sendLog(io, id, `MENU CỤM: Tìm thấy Cụm Spring tại ô ${i}`);
                        break;
                    }
                }
            }
            await clickDutKhoat(slotTarget);
        }
        else if (title.includes('ĐIỂM DANH') || title.includes('DIEM DANH')) {
            sendLog(io, id, "Bảng Điểm Danh hiện ra. (Đóng bảng để tránh lỗi click bậy bạ)");
            bot.closeWindow(window);
        }
        else {
            // Khả năng cao đây là Kho Đồ (PV) hoặc bảng Trade, hiển thị vật phẩm để rà soát
            const items = window.slots.filter(i => i != null);
            if (items.length > 0) {
                const itemCounts = {};
                const chestDetails = [];

                for (let i = 0; i < window.slots.length; i++) {
                    const it = window.slots[i];
                    if (it) {
                        const nameGoc = it.customName || it.displayName || it.name;
                        const tenDaDich = docTenVatPham(nameGoc);
                        
                        itemCounts[tenDaDich] = (itemCounts[tenDaDich] || 0) + it.count;
                        chestDetails.push({ slot: i, name: tenDaDich, count: it.count });
                    }
                }
                
                let summary = [];
                for (const [k, v] of Object.entries(itemCounts)) {
                    summary.push(`[${k} x${v}]`);
                }
                sendLog(io, id, `📦 Chứa đồ: ${summary.join(', ')}`);
                // Bắn data về Web để làm Dashboard Analytics
                io.emit('bot_inventory_data', { id, inventory: itemCounts });
                // Bắn data vị trí trong rương
                let safeTitle = "Rương Mới";
                try { safeTitle = docTenVatPham(window.title || ""); } catch(e){}
                io.emit('bot_chest_details', { id, title: safeTitle, items: chestDetails });
            } else {
                sendLog(io, id, `📦 Bảng trống rỗng!`);
                io.emit('bot_inventory_data', { id, inventory: {} });
                io.emit('bot_chest_details', { id, title: "Rương Trống", items: [] });
            }
        }
    });

    let initialized = false;

    bot.on('spawn', () => {
        bot.status = 'online';
        io.emit('bot_status', { id, status: 'online' });

        if (!initialized) {
            initialized = true;
            sendLog(io, id, `Đã vào máy chủ. Bot sẽ gõ mật khẩu đăng nhập ngay...`);
            
            setTimeout(() => {
                sendLog(io, id, `Đang login...`);
                bot.chat(`/login ${BOT_CONFIG.pass}`);
            }, 3000);

            // Bắt buộc phải móc La Bàn ra để chui qua Cụm Spring
            setTimeout(() => {
                sendLog(io, id, `Bấm Phím 5 mở la bàn...`);
                bot.setQuickBarSlot(4);
                setTimeout(() => {
                    bot.look(0, 0);
                    bot.activateItem();
                    sendLog(io, id, `Đã chuột phải để mở Menu BungeeCord.`);
                }, 1000);
            }, 12000);
        } else {
            sendLog(io, id, `[Hệ Thống] Đã đáp máy bay xuống Cụm Spring. Kích hoạt cày cuốc!`);
            
            const liveMode = botConfigs[id].mode;

            if (liveMode === 'random') {
                startRandomAFK(bot, io, id);
            } else if (liveMode === 'trade') {
                startAutoTrade(bot, io, id);
            } else {
                startSmartAFK(bot, io, id);
            }
        }
    });

    bot.on('end', (reason) => {
        bot.status = 'offline';

        if (botConfigs[id] && botConfigs[id].manualStop) {
            io.emit('bot_status', { id, status: 'offline' });
            sendLog(io, id, `🛑 Hệ thống: Đã ra lệnh ngắt kết nối Chủ động.`);
            delete bots[id];
            delete botConfigs[id];
        } else {
            io.emit('bot_status', { id, status: 'waiting' });
            sendLog(io, id, `🚨 Mất kết nối bất thường: ${reason}. Hệ thống sẽ TỰ ĐỘNG KHÔI PHỤC (Reconnect) sau 1 phút!`);
            sendDiscordAlert(accInfo.username, "MẤT KẾT NỐI", `Lý do: \`${reason}\`\nĐang tự động đếm ngược 1 phút để tiến hành cưỡng chế Đăng nhập lại.`, 0xffa500);
            
            delete bots[id];

            // Giết bỏ Timer cũ tránh đẻ rác (Timer Leak)
            if (reconnectTimers[id]) {
                clearTimeout(reconnectTimers[id]);
            }

            // Bộ đếm đếm 1 phút (60,000 milisecond) để tránh spam server
            reconnectTimers[id] = setTimeout(() => {
                if (!bots[id]) {
                    sendLog(io, id, `🔄 Kích hoạt Khôi phục tự động...`);
                    // Trích xuất lại Acc Info cũ để đút vào 
                    const freshAccInfo = { ...accInfo, ...(botConfigs[id] || {}) };
                    startBot(freshAccInfo, io);
                }
                delete reconnectTimers[id];
            }, 60000);
        }
    });

    bot.on('kicked', (reason) => {
        let why = reason;
        try {
            const parsed = JSON.parse(reason);
            why = parsed.text || (parsed.extra && parsed.extra.map(o => o.text).join('')) || reason;
        } catch(e) {}
        sendLog(io, id, `🚷 Bị Máy Chủ Đá: ${why}`);
    });

    bot.on('error', (err) => {
        sendLog(io, id, `LỖI: ${err.message}`);
    });

    // Lọc và Đọc thông báo / Tiền từ Server để hiển thị ra web
    bot.on('message', (msgMatch) => {
        const text = msgMatch.toString().trim();
        if (!text) return;

        // BỘ LỌC RÁC: DANH SÁCH TỪ KHOÁ CẤM ĐỂ KHÔNG CHỐT LAG WEB
        const spamWords = [
           'ʙᴏᴏꜱᴛᴇʀ', 'CLEANING STAFF', 'tài xỉu - LUCKYVN', 'NHIỆM VỤ ĐẶC BIỆT',
           'Nhận ngay:', 'Trạng thái: Hoàn thành', 'Link:', 'Kết thúc sau:',
           'Bạn có thể kiếm tiền', 'Khi mua rank', 'Xem top tuần này'
        ];

        // Nếu thông báo mà có dính mấy chữ Spam kia -> lơ luôn
        if (spamWords.some(word => text.includes(word))) return;

        // Nếu là chữ sạch (Giống khi anh gõ /money, server trả lời số dư)
        sendLog(io, id, `💭 ${text}`);
    });

    bot.on('chat', (sender, message) => {
        if (sender === bot.username) return;

        if (message.startsWith('!setafk')) {
            const target = bot.players[sender] ? bot.players[sender].entity : null;
            if (!target) return sendLog(io, id, `[AI] Không dòm thấy vị trí của ${sender}`);
            const args = message.split(' ');
            const name = args.slice(1).join(' ') || `Góc ${Date.now().toString().slice(-4)}`;
            const locs = getLocations();
            const newSpot = { id: `spot-${Date.now()}`, name, x: target.position.x, y: target.position.y, z: target.position.z };
            locs.afk_spots.push(newSpot);
            saveLocations(locs);
            if (io) io.emit('locations_updated', locs);
            sendLog(io, id, `[AI] 📌 Đã đánh dấu toạ độ "${name}" tại (X:${newSpot.x.toFixed(1)}, Y:${newSpot.y.toFixed(1)}, Z:${newSpot.z.toFixed(1)})`);
        }

        if (message === '!setnpc') {
            const target = bot.players[sender] ? bot.players[sender].entity : null;
            if (!target) return sendLog(io, id, `[AI] Không tìm thấy toạ độ của ${sender}`);
            const locs = getLocations();
            locs.npc_trade = { x: target.position.x, y: target.position.y, z: target.position.z };
            saveLocations(locs);
            if (io) io.emit('locations_updated', locs);
            sendLog(io, id, `[AI] 📌 Đã đánh dấu toạ độ ông NPC vào bộ lưu trữ.`);
        }

        if (message === '!come') {
            const target = bot.players[sender] ? bot.players[sender].entity : null;
            if (!target) {
                sendLog(io, id, `[AI] Không tìm thấy toạ độ của ${sender}`);
                return;
            }
            const mcData = require('minecraft-data')(bot.version);
            const defaultMove = new Movements(bot, mcData);
            defaultMove.canDig = false;
            bot.pathfinder.setMovements(defaultMove);
            bot.pathfinder.setGoal(new goals.GoalFollow(target, 1), true);
            sendLog(io, id, `[AI] Đang chạy tới vị trí của ${sender}...`);
        }
        if (message === '!stop') {
            bot.pathfinder.setGoal(null);
            sendLog(io, id, `[AI] Đã ra lệnh đứng yên!`);
        }
    });

    // Vòng lặp kích hoạt Auto Trade 1 Tiếng / Lần
    // setInterval(() => startAutoTrade(bot, io, id), TRADE_CONFIG.intervalMs);
}

// ==========================================
// HÀM CHỨC NĂNG: SMART AFK (NÉ NGƯỜI)
// ==========================================
async function startSmartAFK(bot, io, id) {
    sendLog(io, id, `🗺️ [Smart AFK] Đang dò tìm vị trí an toàn...`);
    
    // Gắn logic PathFinder chuẩn bị di chuyển...
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    defaultMove.canDig = false;
    bot.pathfinder.setMovements(defaultMove);

    const locs = getLocations();
    const config = botConfigs[id] || {};
    let targetSpot = null;
    
    // Nếu có chọn góc cụ thể, thì ưu tiên tìm góc đó
    if (config.afkSpotId) {
        targetSpot = locs.afk_spots.find(s => s.id === config.afkSpotId);
    }
    // Nếu không hoặc góc bị xoá mất, lấy góc ưu tiên số 1
    if (!targetSpot && locs.afk_spots.length > 0) {
        targetSpot = locs.afk_spots[0];
    }

    if (targetSpot) {
        bot.pathfinder.setGoal(new goals.GoalBlock(targetSpot.x, targetSpot.y, targetSpot.z));
        sendLog(io, id, `🏃 Đang di chuyển tới Toạ độ: ${targetSpot.name} (X=${targetSpot.x}, Y=${targetSpot.y}, Z=${targetSpot.z})`);
    } else {
        sendLog(io, id, `⚠️ Không tìm thấy vị trí AFK nào được cấu hình trong hệ thống! Hãy thêm toạ độ trên Web.`);
    }
}

// ==========================================
// HÀM CHỨC NĂNG: RANDOM AFK (TẢN RA NGẪU NHIÊN)
// ==========================================
function startRandomAFK(bot, io, id) {
    sendLog(io, id, `🚶 [Random AFK] Đang tản ra ngẫu nhiên để có không gian...`);
    const yaw = Math.random() * Math.PI * 2;
    bot.look(yaw, 0);
    bot.setControlState('forward', true);
    bot.setControlState('jump', true);
    
    setTimeout(() => {
        bot.setControlState('forward', false);
        bot.setControlState('jump', false);
        sendLog(io, id, `Đã tìm được góc trống và vác gối ra ngủ. Bắt đầu TREO MÁY!`);
    }, 1500 + Math.random() * 2000);
}

// ==========================================
// HÀM CHỨC NĂNG: AUTO TRADE DYNAMIC (TỐC ĐỘ GÓT CAO)
// ==========================================
async function startAutoTrade(bot, io, id) {
    sendLog(io, id, `💸 [Auto Trade] Bắt đầu quy trình cày cuốc thần tốc... (Kho từ PV ${botConfigs[id].pvStart || 2} đến PV ${botConfigs[id].pvEnd || 5})`);
    let currentPv = botConfigs[id].pvStart || 2;
    let isWorking = false;
    
    // Tiêu diệt vòng lặp cũ tàn dư (nếu có)
    if (tradeLoops[id]) clearInterval(tradeLoops[id]);

    tradeLoops[id] = setInterval(async () => {
        // Kiểm tra xem bot còn sống và ở đúng chế độ không
        if (!bots[id] || !botConfigs[id] || botConfigs[id].mode !== 'trade') {
            clearInterval(tradeLoops[id]);
            delete tradeLoops[id];
            return;
        }
        if (isWorking) return; // Tránh tình trạng vòng lặp đè lên nhau nếu mạng quá lag
        isWorking = true;

        try {
            // Bước 1: Quét tất cả thực thể xung quanh 5 block
            const entities = Object.values(bot.entities).filter(e => 
                e && e !== bot.entity && 
                e.position && e.position.distanceTo(bot.entity.position) < 5 && 
                (e.type === 'player' || e.type === 'villager' || e.type === 'mob')
            );

            if (entities.length === 0) {
                sendLog(io, id, `[Auto Trade] Không tìm thấy thương nhân nào xung quanh 5 block cả! Xin hãy đứng đúng chỗ.`);
                isWorking = false;
                return;
            }

            sendLog(io, id, `[Auto Trade] 👉 Đang sờ thử ${entities.length} đối tượng xung quanh để tìm NPC...`);
            
            let npcWindow = null;
            for(const target of entities) {
                // Nhìn thẳng mặt để chọc mù Anti-cheat
                bot.lookAt(target.position.offset(0, target.height/2, 0));
                bot.activateEntity(target);
                
                // Chờ đợi giao diện mở
                for(let t = 0; t < 15; t++) {
                    await bot.waitForTicks(1);
                    if (bot.currentWindow) break;
                }

                if (bot.currentWindow) {
                    npcWindow = bot.currentWindow;
                    break; // Đã tìm trúng ông NPC
                }
            }

            if (!npcWindow) {
                sendLog(io, id, `[Auto Trade] Không thấy bảng đổi đồ hiện ra dù đã vỗ vai NPC!`);
                isWorking = false;
                return;
            }

            // Chọn Món số 1 (Menu Trái) bằng packet nguyên thủy
            bot._client.write('tr_sel', { slot: 0 });
            await bot.waitForTicks(5);

            // Bắt đầu Shift Click nhận thành phẩm ở ô ID 2
            let tradeCount = 0;
            for (let i = 0; i < 15; i++) {
                try {
                    await bot.clickWindow(2, 0, 1);
                    tradeCount++;
                    await bot.waitForTicks(2); // ≈ 100ms chống Anti-cheat
                } catch(err) {
                    break; // Cửa hàng hết hàng, không đủ Level, hoặc túi bot hết sạch nguyên liệu
                }
            }

            bot.closeWindow(npcWindow);
            sendLog(io, id, `[Auto Trade] 🔄 Tát đồ xong (${tradeCount} phát). Thu tay cất vô kho...`);
            await bot.waitForTicks(6);

            // Bước 2: Bấm lệnh mở PV và cất đồ
            bot.chat(`/pv ${currentPv}`);
            await new Promise(r => setTimeout(r, 1500)); // Chờ GUI PV bung ra thật mượt

            const window = bot.currentWindow;
            if (window) {
                const invStart = window.inventoryStart;
                for (let i = invStart; i < window.slots.length; i++) {
                    const item = window.slots[i];
                    // Bộ phận xử lý thông minh: CHỈ CẤT thành phẩm. Bỏ qua Hạt giống (seed) 
                    // Nếu là nguyên liệu để bot mua vòng lại, nhỡ cất mẹ đi thì toang.
                    if (item && (!item.name.toLowerCase().includes('seed'))) {
                        try {
                            await bot.clickWindow(i, 0, 1);
                            await bot.waitForTicks(1); // 50ms per item để xả tốc độ bàn thờ (Vứt dô PVP ít bị quét)
                        } catch(e) {}
                    }
                }
                sendLog(io, id, `[Auto Trade] 🎒 Đã xả đồ vào kho PV số ${currentPv}. Đóng rương lại.`);
                bot.closeWindow(window);

                // Cuốn chiếu lên PV kế tiếp
                const maxPv = botConfigs[id].pvEnd || 5;
                if (currentPv < maxPv) {
                    currentPv++;
                } else {
                    currentPv = botConfigs[id].pvStart || 2; // Rương full thì quay lại
                }
            } else {
                sendLog(io, id, `[Auto Trade] Mở PV thất bại do máy chủ lag. Dời công việc sang chu kỳ tiếp theo.`);
            }

        } catch(err) {
            sendLog(io, id, `[Auto Trade] 💥 Chướng ngại ngầm: ${err.message}`);
        }

        isWorking = false;
    }, 15000); // 15 giây cho một đợt thu hoạch tự động nhàn rỗi (Ngăn chặn Server ban vì Request Timeout)
}

function stopBot(id, io) {
    if (reconnectTimers[id]) {
        clearTimeout(reconnectTimers[id]);
        delete reconnectTimers[id];
        sendLog(io, id, "🛑 Đã can thiệp huỷ bỏ tiến trình Hồi sinh.");
    }

    if (bots[id]) {
        sendLog(io, id, "Đang ngắt kết nối Bot...");
        if (botConfigs[id]) botConfigs[id].manualStop = true;
        
        if (tradeLoops[id]) {
            clearInterval(tradeLoops[id]);
            delete tradeLoops[id];
        }

        bots[id].end(); // Tắt kết nối
    } else {
        io.emit('bot_status', { id, status: 'offline' });
    }
}

function updateBotConfig(id, mode, pvp, afkSpotId, pvStart, pvEnd, io) {
    if(botConfigs[id]) {
        botConfigs[id].mode = mode;
        botConfigs[id].pvpEnabled = pvp;
        botConfigs[id].afkSpotId = afkSpotId;
        botConfigs[id].pvStart = pvStart;
        botConfigs[id].pvEnd = pvEnd;
    }
    sendLog(io, id, `💾 Đã lưu và cập nhật cấu hình nóng (Mode: ${mode}, PvP: ${pvp ? 'Bật' : 'Tắt'})`);
    
    // Kích hoạt ngay lập tức luồng mới nếu bot đang sống (chuyển nóng qua lại giữa các mode)
    if (bots[id] && bots[id].status === 'online') {
        if (mode === 'trade') {
           if(!tradeLoops[id]) startAutoTrade(bots[id], io, id);
        } else {
            if (tradeLoops[id]) {
                clearInterval(tradeLoops[id]);
                delete tradeLoops[id];
            }
        }
    }
}

function chatBot(id, message, io) {
    if (bots[id] && bots[id].status === 'online') {
        bots[id].chat(message);
        sendLog(io, id, `Đã ra lệnh: ${message}`);
    } else {
        sendLog(io, id, '❌ Bot chưa online, không thể gửi lệnh.', 'error');
    }
}

function getBotStatus(id) {
    if (bots[id]) return bots[id].status || 'online';
    if (reconnectTimers[id]) return 'waiting';
    return 'offline';
}

module.exports = {
    startBot,
    stopBot,
    chatBot,
    getBotStatus,
    updateBotConfig
};
