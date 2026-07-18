const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const VaultManager = require('./VaultManager');
const DungeonManager = require('./DungeonManager');
const TradeManager = require('./TradeManager');
const pvp = require('mineflayer-pvp').plugin;
const autoeat = require('mineflayer-auto-eat').loader;
const UUID = require('uuid-1345');

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

function loadLocations() {
    try {
        const dataPath = path.join(__dirname, '../locations.json');
        const data = fs.readFileSync(dataPath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`[Bot Server] Lỗi đọc locations.json: ${err.message}`);
        return null;
    }
}

function loadAccountConfig(username) {
    try {
        const dataPath = path.join(__dirname, '../accounts.json');
        const data = fs.readFileSync(dataPath, 'utf-8');
        const accounts = JSON.parse(data);
        return accounts.find(acc => acc.username === username);
    } catch (err) {
        console.error(`[Bot Server] Lỗi đọc accounts.json: ${err.message}`);
        return null;
    }
}

function loadServerProfile(profileName) {
    try {
        const dataPath = path.join(__dirname, '../server_profiles.json');
        if (!fs.existsSync(dataPath)) return null;
        const data = fs.readFileSync(dataPath, 'utf-8');
        const profiles = JSON.parse(data);
        return profiles[profileName] || null;
    } catch (err) {
        console.error(`[Bot Server] Lỗi đọc server_profiles.json: ${err.message}`);
        return null;
    }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use(express.json());

app.get('/api/accounts', (req, res) => {
    try {
        const accountsPath = path.join(__dirname, '../accounts.json');
        const accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
        accounts.forEach(a => {
            const offsetMs = a.uptimeOffset || 0;
            if (activeBots.has(a.id)) {
                a.status = 'online';
                a.uptimeStart = (botStartTimes.get(a.id) || Date.now()) - offsetMs;
            } else {
                a.status = 'offline';
                a.uptimeStart = null;
            }
        });
        res.json(accounts);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/config', (req, res) => {
    res.json(botConfig);
});

app.post('/api/config', (req, res) => {
    botConfig = { ...botConfig, ...req.body };
    res.json({ success: true });
});

app.post('/api/accounts', (req, res) => {
    try {
        const accountsPath = path.join(__dirname, '../accounts.json');
        const accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
        accounts.push({
            id: `acc-${Date.now()}`,
            username: req.body.username,
            pass: req.body.pass,
            mode: "random",
            pvpEnabled: false,
            afkSpotId: "",
            uptimeOffset: 0,
            autoReconnect: false
        });
        fs.writeFileSync(accountsPath, JSON.stringify(accounts, null, 4));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/accounts/:id', (req, res) => {
    try {
        const accountsPath = path.join(__dirname, '../accounts.json');
        let accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
        accounts = accounts.filter(a => a.id !== req.params.id);
        fs.writeFileSync(accountsPath, JSON.stringify(accounts, null, 4));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/accounts/:id/boost', (req, res) => {
    try {
        const accountsPath = path.join(__dirname, '../accounts.json');
        let accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
        const idx = accounts.findIndex(a => a.id === req.params.id);
        if (idx !== -1) {
            accounts[idx].uptimeOffset = (req.body.hours || 0) * 3600000;
            fs.writeFileSync(accountsPath, JSON.stringify(accounts, null, 4));
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/accounts/autorank', (req, res) => {
    try {
        const accountsPath = path.join(__dirname, '../accounts.json');
        let accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
        const offsets = [15, 12, 9, 6, 3]; // 15h, 12h, 9h, 6h, 3h
        accounts.forEach((acc, i) => {
            acc.uptimeOffset = (i < 5) ? offsets[i] * 3600000 : 0;
        });
        fs.writeFileSync(accountsPath, JSON.stringify(accounts, null, 4));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/locations', (req, res) => {
    res.json(loadLocations() || { afk_spots: [] });
});

app.post('/api/locations/afk', (req, res) => {
    try {
        const locationsPath = path.join(__dirname, '../locations.json');
        let data = { afk_spots: [] };
        if (fs.existsSync(locationsPath)) {
            data = JSON.parse(fs.readFileSync(locationsPath, 'utf-8'));
        }
        data.afk_spots.push({
            id: `spot-${Date.now()}`,
            name: req.body.name,
            x: req.body.x,
            y: req.body.y,
            z: req.body.z
        });
        fs.writeFileSync(locationsPath, JSON.stringify(data, null, 4));
        io.emit('locations_updated', data);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/locations/afk/:id', (req, res) => {
    try {
        const locationsPath = path.join(__dirname, '../locations.json');
        if (fs.existsSync(locationsPath)) {
            let data = JSON.parse(fs.readFileSync(locationsPath, 'utf-8'));
            data.afk_spots = data.afk_spots.filter(s => s.id !== req.params.id);
            fs.writeFileSync(locationsPath, JSON.stringify(data, null, 4));
            io.emit('locations_updated', data);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/bots/:id/start', (req, res) => {
    const { mode, pvp: pvpVal, afkSpotId, autoReconnect } = req.body;
    try {
        const accountsPath = path.join(__dirname, '../accounts.json');
        let accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
        const account = accounts.find(a => a.id === req.params.id || a.username === req.params.id);
        if (account) {
            account.mode = mode;
            account.pvpEnabled = pvpVal;
            account.afkSpotId = afkSpotId;
            if (autoReconnect !== undefined) account.autoReconnect = autoReconnect;
            fs.writeFileSync(accountsPath, JSON.stringify(accounts, null, 4));
            
            startBot(account.id, account.username, afkSpotId);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Account not found" });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/bots/:id/stop', (req, res) => {
    stopBot(req.params.id);
    res.json({ success: true });
});

app.post('/api/bots/:id/config', (req, res) => {
    const { mode, pvp: pvpVal, afkSpotId, pvStart, pvEnd, autoReconnect } = req.body;
    try {
        const accountsPath = path.join(__dirname, '../accounts.json');
        let accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
        const account = accounts.find(a => a.id === req.params.id || a.username === req.params.id);
        if (account) {
            account.mode = mode;
            account.pvpEnabled = pvpVal;
            account.afkSpotId = afkSpotId;
            if (autoReconnect !== undefined) account.autoReconnect = autoReconnect;
            if (pvStart !== undefined) account.pvStart = pvStart;
            if (pvEnd !== undefined) account.pvEnd = pvEnd;
            fs.writeFileSync(accountsPath, JSON.stringify(accounts, null, 4));
            
            const bot = activeBots.get(account.id);
            if (bot) {
                bot.pvpEnabled = pvpVal;
                tacticalLog(`💾 Đã cập nhật cấu hình nóng cho ${bot.username} (PvP: ${pvpVal ? 'Bật' : 'Tắt'})`, 'success');
            }
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Account not found" });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/bots/:id/chat', (req, res) => {
    const bot = activeBots.get(req.params.id);
    if (bot && req.body.message) {
        bot.chat(req.body.message);
    }
    res.json({ success: true });
});

app.get('/api/debug/:id', (req, res) => {
    const bot = activeBots.get(req.params.id);
    if (!bot) return res.status(404).json({ error: "Bot not found" });
    res.json({
        username: bot.username,
        health: bot.health,
        food: bot.food,
        position: bot.entity?.position,
        currentWindow: bot.currentWindow ? {
            title: bot.currentWindow.title,
            slots: bot.currentWindow.slots.filter(s => s).map(s => ({
                slot: s.slot,
                name: s.name,
                displayName: s.displayName
            }))
        } : null,
        inventory: bot.inventory.items().map(i => ({
            slot: i.slot,
            name: i.name,
            count: i.count
        }))
    });
});

const activeBots = new Map();
const botVaultManagers = new Map();
const isDisconnecting = new Map();
const botStartTimes = new Map();
const farmIntervals = new Map();
const dungeonManagers = new Map();
const tradeManagers = new Map();
const moneyIntervals = new Map();

function startFarming(botId, bot) {
    if (farmIntervals.has(botId)) {
        clearInterval(farmIntervals.get(botId));
    }
    
    tacticalLog(`⚔️ Kích hoạt chế độ TỰ ĐỘNG CLICK / FARM SPAWNER cho ${bot.username}!`, 'success');
    try {
        bot.setQuickBarSlot(0); // Chuyển sang ô 1 (chứa vũ khí/kiếm)
    } catch (e) {}
    
    const interval = setInterval(() => {
        if (!bot || !bot.entity) return;
        try {
            bot.setQuickBarSlot(0); // Đảm bảo luôn cầm ô 1
        } catch (e) {}
        
        // Quét quái thú hoặc động vật xung quanh trong bán kính 4 block
        const entity = bot.nearestEntity(e => 
            (e.type === 'mob' || e.type === 'animal') && 
            bot.entity.position.distanceTo(e.position) < 4
        );
        
        if (entity) {
            // Xoay đầu nhìn thẳng vào quái vật trước khi tấn công để trông tự nhiên (legit)
            const targetPos = entity.position.offset(0, entity.height ? entity.height / 2 : 1, 0);
            bot.lookAt(targetPos, true);
            bot.attack(entity);
        } else {
            bot.swingArm('right');
        }
    }, 1000); // Tần suất click: 1 giây / lần
    
    farmIntervals.set(botId, interval);
}

function startFarmingBow(botId, bot) {
    if (farmIntervals.has(botId)) {
        clearInterval(farmIntervals.get(botId));
    }
    
    tacticalLog(`🏹 Kích hoạt chế độ TỰ ĐỘNG BẮN CUNG cho ${bot.username}!`, 'success');
    try {
        bot.setQuickBarSlot(0); // Chuyển sang ô 1 (chứa cung)
    } catch (e) {}
    
    function runBowLoop() {
        if (!bot || !bot.entity) return;
        
        try {
            bot.setQuickBarSlot(0); // Đảm bảo luôn cầm ô 1 (chứa cung)
        } catch (e) {}
        
        // Quét mục tiêu xung quanh trong bán kính rộng hơn (ví dụ 16 block cho tầm xa)
        const entity = bot.nearestEntity(e => 
            (e.type === 'mob' || e.type === 'animal') && 
            bot.entity.position.distanceTo(e.position) < 16
        );
        
        if (entity) {
            // Xoay đầu nhìn thẳng mục tiêu
            const targetPos = entity.position.offset(0, entity.height ? entity.height / 2 : 1, 0);
            bot.lookAt(targetPos, true);
            
            // Kéo cung (ấn giữ chuột phải)
            try {
                bot.activateItem(); 
            } catch (e) {}
            
            // Chờ 2 giây để kéo căng cung rồi thả
            const shootTimeout = setTimeout(() => {
                if (!bot || !bot.entity) return;
                try {
                    bot.deactivateItem(); // Nhả chuột phải => Bắn tên
                } catch (e) {}
                
                // Nghỉ 1 giây trước khi bắn phát tiếp theo
                const nextTimeout = setTimeout(runBowLoop, 1000);
                farmIntervals.set(botId, nextTimeout);
            }, 2000);
            
            farmIntervals.set(botId, shootTimeout);
        } else {
            // Nếu không có quái, nghỉ 1 giây rồi quét lại
            const idleTimeout = setTimeout(runBowLoop, 1000);
            farmIntervals.set(botId, idleTimeout);
        }
    }
    
    runBowLoop();
}

function tacticalLog(message, type = 'info') {
    console.log(message);
    io.emit('bot_log', { message, type });
}

let serverProfile = loadServerProfile('luckyvn') || {
    host: 'localhost', port: 25565, version: false, fakeHost: '', loginDelayMs: 3000, antibotTriggers: [], antibotFreezeDurationMs: 0, targetItems: ['diamond']
};

let botConfig = {
    ...serverProfile
};

function startBot(botId, username, afkSpotId) {
    if (activeBots.has(botId)) {
        tacticalLog(`[Bot Server] Bot ${username} đã hoạt động.`, 'info');
        return;
    }

    // --- SWARM HIERARCHY LOCK DISABLED BY USER REQUEST ---

    let hasNavigatedLobby = false;
    let gameCheckInterval = null;

    tacticalLog(`[Bot Server] ${username} đang kết nối vào ${botConfig.host}...`, 'info');
    isDisconnecting.set(botId, false);

    const bot = mineflayer.createBot({
        host: botConfig.host,
        port: botConfig.port,
        username: username,
        version: botConfig.version,
        fakeHost: botConfig.fakeHost,
        viewDistance: 'tiny',
        physicsEnabled: true
    });

    activeBots.set(botId, bot);

    // --- 1.21.1 CONFIGURATION AND RESOURCE PACK STABILITY PATCH ---
    bot._client.on('connect', () => {
        const originalWrite = bot._client.write.bind(bot._client);
        bot._client.write = (name, params) => {
            if (name === 'select_known_packs') {
                params = {
                    packs: [
                        { namespace: 'minecraft', id: 'core', version: '1.21.1' }
                    ]
                };
            }
            
            const result = originalWrite(name, params);
            
            if (name === 'login_acknowledged') {
                setTimeout(() => {
                    bot._client.write('settings', {
                        locale: 'en_US',
                        viewDistance: 10,
                        chatFlags: 0,
                        chatColors: true,
                        skinParts: 127,
                        mainHand: 1,
                        enableTextFiltering: false,
                        enableServerListing: true,
                        particleStatus: 0 // all
                    });
                    
                    bot._client.write('custom_payload', {
                        channel: 'minecraft:brand',
                        data: Buffer.from([7, 118, 97, 110, 105, 108, 108, 97])
                    });
                }, 100);
            }
            return result;
        };
    });

    bot._client.on('add_resource_pack', (data) => {
        try {
            // Step 1: Send ACCEPTED (3)
            bot._client.write('resource_pack_receive', {
                uuid: data.uuid,
                result: 3
            });
            
            // Step 2: Send SUCCESSFULLY_LOADED (0) after 250ms
            setTimeout(() => {
                bot._client.write('resource_pack_receive', {
                    uuid: data.uuid,
                    result: 0
                });
            }, 250);
        } catch (err) {
            console.error("Resource pack response error:", err);
        }
    });
    bot.loadPlugin(pathfinder);
    bot.loadPlugin(pvp);
    bot.loadPlugin(autoeat);

    const accInfo = loadAccountConfig(username) || {};
    bot.pvpEnabled = accInfo.pvpEnabled !== false;
    bot.enableTrivia = accInfo.enableTrivia === true;

    bot.once('inject_allowed', () => {
        tacticalLog(`[Bot Server] Bot ${username} using Minecraft version: ${bot.registry.version.minecraftVersion}`, 'info');
    });

    bot.once('spawn', () => {
        bot.autoEat.opts.priority = "foodPoints";
        bot.autoEat.opts.bannedFood = [];
        bot.autoEat.opts.eatingTimeout = 3000;
        bot.autoEat.enableAuto();
    });

    const vaultMgr = new VaultManager(bot);
    botVaultManagers.set(botId, vaultMgr);

    let gameLogicActivated = false;
    let connectionTime = Date.now();
    gameCheckInterval = setInterval(() => {
        if (Date.now() - connectionTime < 5000) return; // Đợi 5 giây cho bot load hết dữ liệu ban đầu
        if (!bot || !bot.entity) return;

        let isLobby = false;
        
        // 1. Kiểm tra tiêu đề bảng điểm (Scoreboard) xem có chứa các từ khóa liên quan đến Sảnh Chờ không
        const scoreboards = bot.scoreboards || bot.scoreboard;
        if (!scoreboards || Object.keys(scoreboards).length === 0) {
            isLobby = true;
        } else {
            const sbValues = Object.values(scoreboards).map(s => s.name ? s.name.toLowerCase() : "");
            if (sbValues.some(name => name.includes('lobby') || name.includes('sảnh') || name.includes('chờ') || name.includes('luckyvn'))) {
                isLobby = true;
            }
        }
        if (bot.scoreboard) {
            for (const key in bot.scoreboard) {
                const sb = bot.scoreboard[key];
                if (sb && sb.title) {
                    let titleStr = "";
                    if (typeof sb.title === 'string') {
                        titleStr = sb.title;
                    } else if (typeof sb.title.toString === 'function') {
                        titleStr = sb.title.toString();
                    } else {
                        titleStr = JSON.stringify(sb.title);
                    }
                    const titleLower = titleStr.toLowerCase();
                    if (titleLower.includes('lobby') || titleLower.includes('sảnh') || titleLower.includes('chờ') || titleLower.includes('luckyvn')) {
                        isLobby = true;
                    }
                }
            }
        }

        // 2. Kiểm tra nếu có Compass trong ô phím nhanh (đặc trưng của Sảnh Chờ)
        const quickbarSlots = bot.inventory.slots.slice(36, 45);
        if (quickbarSlots.some(item => item && item.name === 'compass')) {
            isLobby = true;
        }

        // 3. Nếu không còn ở Sảnh Chờ và logic game chưa được kích hoạt, chạy logic!
        if (!isLobby && !gameLogicActivated) {
            gameLogicActivated = true;
            hasNavigatedLobby = true;
            clearInterval(gameCheckInterval);

            tacticalLog(`🍁 Đã phát hiện Bot ${username} đang ở trong máy chủ game! Bắt đầu chạy logic...`, 'success');

            const accInfoLocal = loadAccountConfig(username);
            if (accInfoLocal) {
                if (accInfoLocal.mode === 'farm' || accInfoLocal.mode === 'farm_bow') {
                    const homeCmd = accInfoLocal.homeCmd || '/home';
                    setTimeout(() => {
                        tacticalLog(`🏠 ${username} đang chạy lệnh dịch chuyển về khu farm: ${homeCmd}`, 'info');
                        bot.chat(homeCmd);
                        
                        setTimeout(() => {
                            if (accInfoLocal.mode === 'farm_bow') {
                                startFarmingBow(botId, bot);
                            } else {
                                startFarming(botId, bot);
                            }
                        }, 2000);
                    }, 4000);
                } else if (accInfoLocal.mode === 'afk') {
                    const homeCmd = accInfoLocal.homeCmd || '/home';
                    setTimeout(() => {
                        tacticalLog(`🏠 ${username} đang chạy lệnh dịch chuyển về khu AFK: ${homeCmd}`, 'info');
                        bot.chat(homeCmd);
                    }, 4000);
                } else if (accInfoLocal.mode === 'sell') {
                    const startMoneyCheck = () => {
                        if (moneyIntervals.has(botId)) clearInterval(moneyIntervals.get(botId));
                        const interval = setInterval(() => {
                            if (bot && bot.entity) bot.chat('/money');
                        }, 15000);
                        moneyIntervals.set(botId, interval);
                    };
                    const homeCmd = accInfoLocal.homeCmd;
                    if (homeCmd) {
                        setTimeout(() => {
                            tacticalLog(`🏠 ${username} đang chạy lệnh dịch chuyển trước khi giao dịch: ${homeCmd}`, 'info');
                            bot.chat(homeCmd);
                            setTimeout(() => {
                                const tradeMgr = new TradeManager(bot, botId, username, io, tacticalLog);
                                tradeManagers.set(botId, tradeMgr);
                                tradeMgr.start();
                                startMoneyCheck();
                            }, 6000); // Đợi 6 giây dịch chuyển
                        }, 4000);
                    } else {
                        setTimeout(() => {
                            const tradeMgr = new TradeManager(bot, botId, username, io, tacticalLog);
                            tradeManagers.set(botId, tradeMgr);
                            tradeMgr.start();
                            startMoneyCheck();
                        }, 4000);
                    }
                } else if (accInfoLocal.mode === 'phoban') {
                    setTimeout(() => {
                        const dungeonMgr = new DungeonManager(bot, botId, username, io, tacticalLog);
                        dungeonManagers.set(botId, dungeonMgr);
                        dungeonMgr.start();
                    }, 4000);
                } else {
                    setTimeout(() => {
                        const locations = loadLocations();
                        if (locations && locations.afk_spots && locations.afk_spots.length > 0) {
                            const targetSpotId = afkSpotId || accInfoLocal.afkSpotId;
                            const spot = locations.afk_spots.find(s => s.id === targetSpotId) || locations.afk_spots[0];
                            tacticalLog(`🚶 ${username} đang di chuyển đến: ${spot.name}`, 'info');
                            const defaultMove = new Movements(bot);
                            defaultMove.allowFreeClearance = true;
                            bot.pathfinder.setMovements(defaultMove);
                            bot.pathfinder.setGoal(new goals.GoalBlock(spot.x, spot.y, spot.z));
                        }
                    }, 4000);
                }
                if (vaultMgr && accInfoLocal.pvStart && accInfoLocal.pvEnd) {
                    vaultMgr.setVaultBounds(accInfoLocal.pvStart, accInfoLocal.pvEnd);
                }
            }
        }
    }, 2000);

    async function clickDutKhoat(slot) {
        if (slot === null || slot === undefined) return;
        tacticalLog(`[GUI] Đang nhắm bắn vào Slot ${slot}...`, 'info');
        try {
            await bot.clickWindow(slot, 0, 0);
            tacticalLog(`[+] Đã click Packet thành công vào slot ${slot}!`, 'success');
        } catch (err) {
            tacticalLog(`[-] Server từ chối lệnh click: ${err.message}`, 'error');
        }
    }

    bot.on('windowOpen', async (window) => {
        if (gameLogicActivated) return;
        tacticalLog(`[>] Bảng hiện ra: ${JSON.stringify(window.title)}`, 'info');
        await new Promise(res => setTimeout(res, 2000));
        const title = extractText(window.title).toUpperCase();
        if (title.includes('LUCKYVN') || title.includes('NETWORK') || title.includes('MENU')) {
            let slotTarget = 12; 
            for (let i = 0; i < window.slots.length; i++) {
                const item = window.slots[i];
                if (item) {
                    const customText = extractText(item.customName).toUpperCase();
                    const vanillaText = extractText(item.displayName).toUpperCase();
                    if (customText.includes('SKYBLOCK') || vanillaText.includes('SKYBLOCK')) {
                        slotTarget = i;
                        break;
                    }
                }
            }
            await clickDutKhoat(slotTarget);
        }
        else if (title.includes('SKYBLOCK') || title.includes('SERVER')) {
            let slotTarget = 22; 
            for (let i = 0; i < window.slots.length; i++) {
                const item = window.slots[i];
                if (item) {
                    const customText = extractText(item.customName).toUpperCase();
                    const vanillaText = extractText(item.displayName).toUpperCase();
                    if (customText.includes('SPRING') || vanillaText.includes('SPRING')) {
                        slotTarget = i;
                        break;
                    }
                }
            }
            await clickDutKhoat(slotTarget);
        }
    });

    bot.on('spawn', () => {
        botStartTimes.set(botId, Date.now());
        tacticalLog(`🚀 Bot ${username} đã vào server thành công!`, 'success');
        io.emit('bot_status', { status: 'connected', username: username });

        const accInfo = loadAccountConfig(username);
        if (accInfo) {
            if (accInfo.pass && !hasNavigatedLobby) {
                setTimeout(() => {
                    bot.chat(`/login ${accInfo.pass}`);
                    tacticalLog(`[Bot Server] 🔑 Đã tự động gửi lệnh /login cho ${username}`, 'info');
                    
                    setTimeout(() => {
                        tacticalLog(`[Lobby] Bấm Phím 5 (Compass) để mở Menu...`, 'info');
                        bot.setQuickBarSlot(4);
                        setTimeout(() => {
                            bot.look(0, 0);
                            bot.activateItem();
                            hasNavigatedLobby = true;
                        }, 1000);
                    }, 12000);
                }, botConfig.loginDelayMs || 5000);
            } else if (hasNavigatedLobby && !gameLogicActivated) {
                gameLogicActivated = true;
                if (gameCheckInterval) {
                    clearInterval(gameCheckInterval);
                }
                if (accInfo.mode === 'farm' || accInfo.mode === 'farm_bow') {
                    const homeCmd = accInfo.homeCmd || '/home';
                    setTimeout(() => {
                        tacticalLog(`🏠 ${username} đang chạy lệnh dịch chuyển về khu farm: ${homeCmd}`, 'info');
                        bot.chat(homeCmd);
                        
                        setTimeout(() => {
                            if (accInfo.mode === 'farm_bow') {
                                startFarmingBow(botId, bot);
                            } else {
                                startFarming(botId, bot);
                            }
                        }, 2000);
                    }, 4000);
                } else if (accInfo.mode === 'afk') {
                    const homeCmd = accInfo.homeCmd || '/home';
                    setTimeout(() => {
                        tacticalLog(`🏠 ${username} đang chạy lệnh dịch chuyển về khu AFK: ${homeCmd}`, 'info');
                        bot.chat(homeCmd);
                    }, 4000);
                } else if (accInfo.mode === 'sell') {
                    const startMoneyCheck = () => {
                        if (moneyIntervals.has(botId)) clearInterval(moneyIntervals.get(botId));
                        const interval = setInterval(() => {
                            if (bot && bot.entity) bot.chat('/money');
                        }, 15000);
                        moneyIntervals.set(botId, interval);
                    };
                    const homeCmd = accInfo.homeCmd;
                    if (homeCmd) {
                        setTimeout(() => {
                            tacticalLog(`🏠 ${username} đang chạy lệnh dịch chuyển trước khi giao dịch: ${homeCmd}`, 'info');
                            bot.chat(homeCmd);
                            setTimeout(() => {
                                const tradeMgr = new TradeManager(bot, botId, username, io, tacticalLog);
                                tradeManagers.set(botId, tradeMgr);
                                tradeMgr.start();
                                startMoneyCheck();
                            }, 6000); // Đợi 6 giây dịch chuyển
                        }, 4000);
                    } else {
                        setTimeout(() => {
                            const tradeMgr = new TradeManager(bot, botId, username, io, tacticalLog);
                            tradeManagers.set(botId, tradeMgr);
                            tradeMgr.start();
                            startMoneyCheck();
                        }, 4000);
                    }
                } else if (accInfo.mode === 'phoban') {
                    setTimeout(() => {
                        const dungeonMgr = new DungeonManager(bot, botId, username, io, tacticalLog);
                        dungeonManagers.set(botId, dungeonMgr);
                        dungeonMgr.start();
                    }, 4000);
                } else {
                    setTimeout(() => {
                        const locations = loadLocations();
                        if (locations && locations.afk_spots && locations.afk_spots.length > 0) {
                            const targetSpotId = afkSpotId || accInfo.afkSpotId;
                            const spot = locations.afk_spots.find(s => s.id === targetSpotId) || locations.afk_spots[0];
                            tacticalLog(`🚶 ${username} đang di chuyển đến: ${spot.name}`, 'info');
                            const defaultMove = new Movements(bot);
                            defaultMove.allowFreeClearance = true;
                            bot.pathfinder.setMovements(defaultMove);
                            bot.pathfinder.setGoal(new goals.GoalBlock(spot.x, spot.y, spot.z));
                        }
                    }, 4000);
                }
            }
            if (vaultMgr && accInfo.pvStart && accInfo.pvEnd) {
                vaultMgr.setVaultBounds(accInfo.pvStart, accInfo.pvEnd);
            }
        }

        updateVitals(bot);
        scheduleNextFatigue(botId, bot);

        bot.on('playerJoined', () => updateVitals(bot));
        bot.on('playerLeft', () => updateVitals(bot));

        bot.on('message', (jsonMsg) => {
            const text = jsonMsg.toString().trim();
            if (text) {
                tacticalLog(`💬 [${username}] Chat: ${text}`, 'info');
                
                const textLower = text.toLowerCase();
                if ((textLower.includes('dịch chuyển') || textLower.includes('teleport') || textLower.includes('tpa')) && 
                    textLower.includes('mc_hlonggg')) {
                    tacticalLog(`⚡ [${username}] Phát hiện yêu cầu TPA từ MC_hlonggg, đang chấp nhận...`, 'warning');
                    bot.chat('/tpaccept');
                }
            }
        });
    });

    let lastHealth = 20;
    bot.on('health', () => {
        updateVitals(bot);
        if (gameLogicActivated && bot.health < 6) {
            tacticalLog(`⚠️ ${username}: Báo động đỏ! Máu quá thấp. Đang disconnect!`, 'error');
            stopBot(botId, 'Low Health Panic');
            return;
        }

        if (bot.pvpEnabled && bot.health < lastHealth) {
            const filter = e => e.type === 'player' && e.username !== bot.username && e.position.distanceTo(bot.entity.position) < 4;
            const attacker = bot.nearestEntity(filter);
            
            if (attacker && bot.pvp) {
                tacticalLog(`⚔️ Bot ${username} bị ${attacker.username} tấn công! Đang phản kích...`, 'warning');
                bot.pvp.attack(attacker);
            }
        }
        lastHealth = bot.health;
    });

    bot.on('death', () => {
        tacticalLog(`💀 ${username} đã chết! Đang hồi sinh...`, 'warning');
        try {
            bot.respawn();
        } catch (e) {}
    });

    bot.once('inject_allowed', () => {
        bot.inventory.on('updateSlot', () => {
            if (!bot || !bot.inventory) return;

            io.emit('bot_inventory', {
                botId: botId,
                emptySlots: bot.inventory.emptySlotCount(),
                items: bot.inventory.items().map(i => ({ name: i.name, count: i.count }))
            });

            checkAndStashInventory(botId, bot, vaultMgr);
        });
    });

    bot.on('message', (jsonMsg) => {
        const message = jsonMsg.toString();
        
        // --- AUTO TRIVIA QUIZ SOLVER & LEARNER ---
        handleQuizQuestion(bot, message);
        // -----------------------------------------
        
        // Target balance check (30 Million Target)
        const match = message.match(/Balance:\s*\$([\d,]+)/i);
        if (match) {
            const currentBal = parseInt(match[1].replace(/,/g, ''), 10);
            const targetBalance = 30000000; // 30 Million Target
            
            // Phát sự kiện cập nhật số dư lên web dashboard
            io.emit('balance_update', {
                botId,
                username,
                balance: currentBal,
                target: targetBalance
            });
            
            if (currentBal >= targetBalance) {
                tacticalLog(`🎯 ${username} ĐẠT MỤC TIÊU SỐ DƯ: $${currentBal.toLocaleString()}! Đang ngắt kết nối...`, 'success');
                stopBot(botId, 'Target Balance Reached');
            }
        }
        
        if (message.toLowerCase().includes('/register') || message.toLowerCase().includes('đăng ký')) {
            const accInfo = loadAccountConfig(username);
            const pass = accInfo ? accInfo.pass : '15112009';
            bot.chat(`/register ${pass} ${pass}`);
            tacticalLog(`Đã đăng ký tự động cho ${username}`, 'success');
        }

        if (botConfig.antibotTriggers && botConfig.antibotTriggers.length > 0) {
            const isTriggered = botConfig.antibotTriggers.every(trigger => message.includes(trigger));
            if (isTriggered) {
                tacticalLog(`🛑 ${username}: Xác Minh Anti-Bot! Đang né tránh...`, 'warning');
                bot.clearControlStates();
                if (bot.pathfinder) {
                    bot.pathfinder.setGoal(null);
                }
            }
        }

        if (message.trim()) {
            io.emit('bot_chat', { message: `[${username}] ${message}`, timestamp: Date.now() });
        }
    });

    bot.on('error', (err) => {
        tacticalLog(`❌ Lỗi ${username}: ${err.message}`, 'error');
        io.emit('bot_error', { message: err.message });
        
        // Tự động ngắt kết nối để kích hoạt vòng lặp reconnect nếu gặp lỗi
        if (!isDisconnecting.get(botId)) {
            tacticalLog(`🔄 Phát hiện lỗi kết nối của ${username}. Đang ngắt kết nối để tự động chạy lại...`, 'warning');
            try {
                bot.quit('Connection Error Force Quit');
            } catch (e) {}
        }
    });

    bot.on('end', (reason) => {
        tacticalLog(`🔴 ${username} đã thoát. Lý do: ${reason}`, 'warning');
        io.emit('bot_status', { status: 'disconnected', reason, username });

        if (farmIntervals.has(botId)) {
            clearInterval(farmIntervals.get(botId));
            farmIntervals.delete(botId);
        }

        if (dungeonManagers.has(botId)) {
            dungeonManagers.get(botId).stop();
            dungeonManagers.delete(botId);
        }

        if (tradeManagers.has(botId)) {
            tradeManagers.get(botId).stop();
            tradeManagers.delete(botId);
        }

        if (moneyIntervals.has(botId)) {
            clearInterval(moneyIntervals.get(botId));
            moneyIntervals.delete(botId);
        }

        if (gameCheckInterval) {
            clearInterval(gameCheckInterval);
        }

        const sessionStart = botStartTimes.get(botId);
        if (sessionStart) {
            const sessionTimeMs = Date.now() - sessionStart;
            try {
                const accountsPath = path.join(__dirname, '../accounts.json');
                let accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
                const idx = accounts.findIndex(a => a.id === botId);
                if (idx !== -1) {
                    accounts[idx].uptimeOffset = (accounts[idx].uptimeOffset || 0) + sessionTimeMs;
                    fs.writeFileSync(accountsPath, JSON.stringify(accounts, null, 4));
                }
            } catch (e) {
                console.error("Lỗi lưu session time: ", e);
            }
        }

        activeBots.delete(botId);
        botVaultManagers.delete(botId);
        botStartTimes.delete(botId);

        // --- SWARM CASCADING DISCONNECT DISABLED BY USER REQUEST ---
        /*
        try {
            const accountsPath = path.join(__dirname, '../accounts.json');
            const accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
            const disconnectedIndex = accounts.findIndex(a => a.id === botId);
            
            if (disconnectedIndex !== -1 && disconnectedIndex < 5) {
                for (let i = disconnectedIndex + 1; i < Math.min(5, accounts.length); i++) {
                    if (!accounts[i]) continue;
                    const lowerRankId = accounts[i].id;
                    const lowerBot = activeBots.get(lowerRankId);
                    if (lowerBot) {
                        tacticalLog(`[Hierarchy Lock] 🛡️ Kéo Bot ${accounts[i].username} (Rank ${i+1}) xuống offline để giữ khoảng cách với Rank ${disconnectedIndex+1}!`, 'warning');
                        lowerBot.quit('Hierarchy Protection');
                    }
                }
            }
        } catch (e) {
            console.error("Cascade disconnect error:", e);
        }
        */
        // ------------------------------------------------------------

        if (!isDisconnecting.get(botId)) {
            const accInfo = loadAccountConfig(username);
            const shouldReconnect = accInfo ? accInfo.autoReconnect === true : false;
            if (shouldReconnect) {
                const reconnectDelay = Math.floor(Math.random() * (45000 - 15000 + 1) + 15000);
                tacticalLog(`⏳ ${username} đang đợi kết nối lại sau ${Math.round(reconnectDelay / 1000)} giây.`, 'info');
                setTimeout(() => startBot(botId, username, afkSpotId), reconnectDelay);
            } else {
                tacticalLog(`ℹ️ ${username} đã dừng hẳn (Không tự động kết nối lại).`, 'info');
            }
        }
    });
}

function stopBot(botId, reason = 'User Requested') {
    isDisconnecting.set(botId, true);
    
    if (farmIntervals.has(botId)) {
        clearInterval(farmIntervals.get(botId));
        farmIntervals.delete(botId);
    }

    if (dungeonManagers.has(botId)) {
        dungeonManagers.get(botId).stop();
        dungeonManagers.delete(botId);
    }

    if (tradeManagers.has(botId)) {
        tradeManagers.get(botId).stop();
        tradeManagers.delete(botId);
    }

    if (moneyIntervals.has(botId)) {
        clearInterval(moneyIntervals.get(botId));
        moneyIntervals.delete(botId);
    }

    const bot = activeBots.get(botId);
    if (bot) {
        bot.quit(reason);
        activeBots.delete(botId);
        botVaultManagers.delete(botId);
    }
}

function scheduleNextFatigue(botId, bot) {
    if (!bot || isDisconnecting.get(botId)) return;
    const nextTimeMs = Math.floor(Math.random() * (40 - 10 + 1) + 10) * 60 * 1000;
    setTimeout(() => triggerFakeFatigue(botId, bot), nextTimeMs);
}

function triggerFakeFatigue(botId, bot) {
    if (!bot || isDisconnecting.get(botId)) return;
    
    const actions = [
        () => {
            bot.setControlState('sneak', true);
            setTimeout(() => bot.setControlState('sneak', false), 800);
        },
        () => bot.look(bot.entity.yaw + (Math.random() - 0.5), bot.entity.pitch, true)
    ];

    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    randomAction();
    scheduleNextFatigue(botId, bot);
}

function updateVitals(bot) {
    if (!bot) return;
    io.emit('bot_vitals', {
        health: bot.health,
        food: bot.food,
        position: bot.entity?.position || { x: 0, y: 0, z: 0 },
        playerCount: bot.players ? Object.keys(bot.players).length : 0
    });
}

function cleanString(str) {
    return str.replace(/<[^>]*>/g, '') // remove XML/HTML tags
              .toLowerCase()
              .replace(/[?.,!']/g, '') // remove punctuation
              .trim()
              .replace(/\s+/g, ' ');   // normalize spaces
}

const currentQuestions = new Map();
const expectingQuizQuestion = new Map();

function updateQuizDatabase(question, answer) {
    try {
        const quizPath = path.join(__dirname, '../quiz.json');
        let quizData = {};
        if (fs.existsSync(quizPath)) {
            quizData = JSON.parse(fs.readFileSync(quizPath, 'utf-8'));
        }
        
        const cleanedQuestion = cleanString(question);
        let exists = false;
        for (const key in quizData) {
            if (cleanString(key) === cleanedQuestion) {
                exists = true;
                if (quizData[key] !== answer) {
                    quizData[key] = answer;
                    fs.writeFileSync(quizPath, JSON.stringify(quizData, null, 2));
                    tacticalLog(`📝 [Trivia] Cập nhật đáp án mới cho câu hỏi: "${question}" -> "${answer}"`, 'success');
                }
                break;
            }
        }
        
        if (!exists) {
            const formattedKey = question.startsWith('<yellow>') ? question : `<yellow>${question}</yellow>`;
            quizData[formattedKey] = answer;
            fs.writeFileSync(quizPath, JSON.stringify(quizData, null, 2));
            tacticalLog(`✨ [Trivia] Tự động học câu hỏi mới: "${question}" -> "${answer}"`, 'success');
        }
    } catch (e) {
        console.error("Lỗi cập nhật quiz database:", e);
    }
}

function handleQuizQuestion(bot, message) {
    try {
        const text = message.trim();
        if (!text) return;

        // 1. Phát hiện tiêu đề đố vui
        if (text.includes('Trả lời nhanh câu hỏi sau đây!')) {
            expectingQuizQuestion.set(bot.username, true);
            return;
        }

        // 2. Phát hiện đáp án từ server để học tự động
        const answerMatch = text.match(/Answer:\s*(.+)/i);
        if (answerMatch) {
            const answer = answerMatch[1].trim();
            const question = currentQuestions.get(bot.username);
            if (question) {
                updateQuizDatabase(question, answer);
                currentQuestions.delete(bot.username);
            }
            return;
        }

        // 3. Nếu đang đợi câu hỏi thực tế từ server
        if (expectingQuizQuestion.get(bot.username)) {
            expectingQuizQuestion.set(bot.username, false);
            currentQuestions.set(bot.username, text);
            
            // Xử lý tự động trả lời nếu tính năng trivia được bật cho bot này và bot là vicente1
            if (bot.enableTrivia && bot.username === 'vicente1') {
                const cleanedQuestion = cleanString(text);
                const quizPath = path.join(__dirname, '../quiz.json');
                if (fs.existsSync(quizPath)) {
                    const quizData = JSON.parse(fs.readFileSync(quizPath, 'utf-8'));
                    let foundAnswer = null;
                    for (const key in quizData) {
                        const cleanedKey = cleanString(key);
                        if (cleanedQuestion === cleanedKey || (cleanedKey.length > 10 && cleanedQuestion.includes(cleanedKey))) {
                            foundAnswer = quizData[key];
                            break;
                        }
                    }
                    
                    if (foundAnswer) {
                        tacticalLog(`❓ [${bot.username}] Phát hiện câu hỏi: "${text}"`, 'info');
                        const delay = Math.floor(Math.random() * 1500) + 1500;
                        tacticalLog(`🎯 [${bot.username}] Khớp câu trả lời thành công: "${foundAnswer}". Sẽ gửi sau ${delay}ms...`, 'success');
                        setTimeout(() => {
                            bot.chat(foundAnswer);
                            tacticalLog(`💬 [${bot.username}] Đã trả lời: "${foundAnswer}"`, 'success');
                        }, delay);
                    } else {
                        tacticalLog(`❓ [${bot.username}] Chưa biết câu trả lời cho: "${text}". Đang đợi server công bố đáp án để học...`, 'warning');
                    }
                }
            }
        }
    } catch (e) {
        console.error("Lỗi xử lý câu hỏi trivia:", e);
    }
}

async function checkAndStashInventory(botId, bot, vaultMgr) {
    if (!bot || !vaultMgr) return;
    const accInfo = loadAccountConfig(bot.username);
    if (accInfo && accInfo.mode === 'sell') return; // Bỏ qua nếu đang tự động giao dịch
    
    const emptySlots = bot.inventory.emptySlotCount();
    if (emptySlots < 2) {
        tacticalLog(`📦 ${bot.username}: Balo đầy. Đang gọi Robot cất đồ...`, 'info');
        const stashQueue = bot.inventory.items()
            .filter(i => botConfig.targetItems.includes(i.name))
            .map(i => i.name);
        if (stashQueue.length > 0) {
            await vaultMgr.openAndStash([...new Set(stashQueue)]);
        }
    }
}

const SECRET_KEY = "SANTINO_AI_AGENT_2026";

io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token || SECRET_KEY;
    if (token === SECRET_KEY) {
        next();
    } else {
        next(new Error("Unauthorized"));
    }
});

io.on('connection', (socket) => {
    console.log(`[Socket] Trình duyệt đã kết nối an toàn (ID: ${socket.id})`);

    // Gửi ACK lại cho Frontend
    socket.emit('bot_status', { status: 'connected' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`⛏️  MINECRAFT AFK ENGINE ĐÃ CHẠY TẠI PORT ${PORT}`);
    console.log(`=========================================`);

    // Tự động chạy các bot có cấu hình autoReconnect = true khi khởi động server
    try {
        const accountsPath = path.join(__dirname, '../accounts.json');
        if (fs.existsSync(accountsPath)) {
            const accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
            let activeCount = 0;
            accounts.forEach((acc) => {
                if (acc.autoReconnect === true) {
                    const startDelay = activeCount * 5000; // Giãn cách 5 giây mỗi bot để tránh trùng lặp kết nối
                    activeCount++;
                    setTimeout(() => {
                        tacticalLog(`[Auto Start] Kích hoạt tự động bot: ${acc.username}`, 'info');
                        startBot(acc.id, acc.username, acc.afkSpotId);
                    }, startDelay);
                }
            });
        }
    } catch (e) {
        console.error("[Auto Start] Lỗi khi tự động khởi chạy bot:", e);
    }
});
