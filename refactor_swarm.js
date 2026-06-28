const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src/server.js');
let code = fs.readFileSync(serverPath, 'utf-8');

// 1. Thay thế khai báo biến toàn cục
code = code.replace(
`let activeBot = null;
let botVaultManager = null;
let isDisconnecting = false;
let botStartTime = null;`,
`const activeBots = new Map();
const botVaultManagers = new Map();
const isDisconnecting = new Map();
const botStartTimes = new Map();`
);

// 2. Sửa GET /api/accounts
code = code.replace(
`        accounts.forEach(a => {
            const offsetMs = a.uptimeOffset || 0;
            if (activeBot && botConfig.username === a.username) {
                a.status = 'online';
                a.uptimeStart = botStartTime - offsetMs;
            } else {
                a.status = 'offline';
                a.uptimeStart = null;
            }
        });`,
`        accounts.forEach(a => {
            const offsetMs = a.uptimeOffset || 0;
            if (activeBots.has(a.id)) {
                a.status = 'online';
                a.uptimeStart = (botStartTimes.get(a.id) || Date.now()) - offsetMs;
            } else {
                a.status = 'offline';
                a.uptimeStart = null;
            }
        });`
);

// 3. Sửa route start/stop và thêm autorank
code = code.replace(
`app.post('/api/bots/:id/start', (req, res) => {
    // For now just set the config and start
    const { mode, pvp, afkSpotId, pvStart, pvEnd } = req.body;
    const account = loadAccountConfig(req.params.id) || { username: 'Bot' };
    botConfig.username = account.username;
    botConfig.mode = mode;
    botConfig.pvpEnabled = pvp;
    botConfig.afkSpotId = afkSpotId;
    startBot();
    res.json({ success: true });
});

app.post('/api/bots/:id/stop', (req, res) => {
    stopBot();
    res.json({ success: true });
});`,
`app.post('/api/bots/:id/start', (req, res) => {
    const { mode, pvp, afkSpotId } = req.body;
    const account = loadAccountConfig(req.params.id);
    if (!account) return res.status(404).json({error: "Not found"});
    startBot(account.id, account.username, afkSpotId);
    res.json({ success: true });
});

app.post('/api/bots/:id/stop', (req, res) => {
    stopBot(req.params.id);
    res.json({ success: true });
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
});`
);

// 4. Định nghĩa lại startBot để nhận tham số và hoạt động cục bộ
code = code.replace(
`function startBot() {
    if (activeBot) {
        console.log("[Bot Server] Bot đã hoạt động, không thể tạo thêm.");
        return;
    }

    console.log(\`[Bot Server] Đang kết nối vào \${botConfig.host}...\`);
    isDisconnecting = false;

    activeBot = mineflayer.createBot({
        host: botConfig.host,
        port: botConfig.port,
        username: botConfig.username,
        version: botConfig.version,
        fakeHost: botConfig.fakeHost,
        viewDistance: 'tiny', // Tối ưu RAM
        physicsEnabled: true
    });

    activeBot.loadPlugin(pathfinder);
    botVaultManager = new VaultManager(activeBot);`,
`function startBot(botId, username, afkSpotId) {
    if (activeBots.has(botId)) {
        console.log(\`[Bot Server] Bot \${username} đã hoạt động.\`);
        return;
    }

    console.log(\`[Bot Server] \${username} đang kết nối vào \${botConfig.host}...\`);
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
    bot.loadPlugin(pathfinder);
    const vaultMgr = new VaultManager(bot);
    botVaultManagers.set(botId, vaultMgr);`
);

// 5. Tìm tất cả \`activeBot\` bên trong startBot và đổi thành \`bot\`.
// Lưu ý: Regex cẩn thận.
// Chỉ đổi trong phạm vi hàm startBot và stopBot
code = code.replace(/activeBot/g, 'bot');
code = code.replace(/botConfig\.username/g, 'username');
code = code.replace(/botStartTime = Date\.now\(\);/g, 'botStartTimes.set(botId, Date.now());');
code = code.replace(/botStartTime = null;/g, 'botStartTimes.delete(botId);');
code = code.replace(/botVaultManager/g, 'vaultMgr');
code = code.replace(/isDisconnecting/g, 'isDisconnecting.get(botId)');
code = code.replace(/isDisconnecting\.get\(botId\) = false;/g, 'isDisconnecting.set(botId, false);');
code = code.replace(/isDisconnecting\.get\(botId\) = true;/g, 'isDisconnecting.set(botId, true);');
code = code.replace(/botConfig\.afkSpotId/g, 'afkSpotId');

// Sửa stopBot
code = code.replace(
`function stopBot(reason = 'User Requested') {
    isDisconnecting.set(botId, true);
    if (bot) {
        bot.quit(reason);
        bot = null;
        vaultMgr = null;
    }
}`,
`function stopBot(botId, reason = 'User Requested') {
    isDisconnecting.set(botId, true);
    const bot = activeBots.get(botId);
    if (bot) {
        bot.quit(reason);
        activeBots.delete(botId);
        botVaultManagers.delete(botId);
    }
}`
);

// Sửa updateVitals
code = code.replace(
`function updateVitals() {
    if (!bot) return;
    io.emit('bot_vitals', {
        health: bot.health,
        food: bot.food,
        position: bot.entity?.position || { x: 0, y: 0, z: 0 },
        playerCount: bot.players ? Object.keys(bot.players).length : 0
    });
}`,
`function updateVitals(bot) {
    if (!bot) return;
    io.emit('bot_vitals', {
        health: bot.health,
        food: bot.food,
        position: bot.entity?.position || { x: 0, y: 0, z: 0 },
        playerCount: bot.players ? Object.keys(bot.players).length : 0
    });
}`
);

// Fix updateVitals calls inside startBot
code = code.replace(/updateVitals\(\)/g, 'updateVitals(bot)');

// Fix scheduleNextFatigue signature
code = code.replace(/function scheduleNextFatigue\(\)/g, 'function scheduleNextFatigue(botId, bot)');
code = code.replace(/scheduleNextFatigue\(\)/g, 'scheduleNextFatigue(botId, bot)');
code = code.replace(/function triggerFakeFatigue\(\)/g, 'function triggerFakeFatigue(botId, bot)');
code = code.replace(/setTimeout\(triggerFakeFatigue, nextTimeMs\);/g, 'setTimeout(() => triggerFakeFatigue(botId, bot), nextTimeMs);');

// Fix checkAndStashInventory signature
code = code.replace(/async function checkAndStashInventory\(\)/g, 'async function checkAndStashInventory(botId, bot, vaultMgr)');
code = code.replace(/checkAndStashInventory\(\)/g, 'checkAndStashInventory(botId, bot, vaultMgr)');

// Fix the chat logic outside startBot
code = code.replace(
`app.post('/api/bots/:id/chat', (req, res) => {
    if (bot && req.body.message) {
        bot.chat(req.body.message);
    }
    res.json({ success: true });
});`,
`app.post('/api/bots/:id/chat', (req, res) => {
    const bot = activeBots.get(req.params.id);
    if (bot && req.body.message) {
        bot.chat(req.body.message);
    }
    res.json({ success: true });
});`
);

fs.writeFileSync(serverPath, code);
console.log("Refactored Swarm Mode Successfully!");
