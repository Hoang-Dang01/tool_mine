const mineflayer = require('mineflayer');

console.log("Connecting and inspecting registry_data...");
const bot = mineflayer.createBot({
    host: 'phasecore.pikamc.vn',
    port: 25230,
    username: 'yuevn',
    version: '1.21.10',
    viewDistance: 'tiny',
    physicsEnabled: false
});

bot._client.on('connect', () => {
    console.log("Client connected. Patching write...");
    const originalWrite = bot._client.write.bind(bot._client);
    bot._client.write = (name, params) => {
        if (name === 'select_known_packs') {
            params = {
                packs: [
                    { namespace: 'minecraft', id: 'core', version: '1.21.10' }
                ]
            };
        }
        return originalWrite(name, params);
    };
});

bot._client.on('registry_data', (packet) => {
    console.log(`[Registry Data] ID: ${packet.id} | Entries count: ${packet.entries ? packet.entries.length : 'none'}`);
    if (packet.entries && packet.entries.length > 0) {
        console.log("First entry keys:", Object.keys(packet.entries[0]));
        console.log("First entry sample:", JSON.stringify(packet.entries[0]).substring(0, 500));
    }
});

bot._client.on('error', (err) => {
    console.log("Client error:", err);
});

setTimeout(() => {
    bot.quit();
    process.exit(0);
}, 25000);
