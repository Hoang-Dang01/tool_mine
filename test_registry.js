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
        console.log(`[OUTBOUND] Name: ${name}`, JSON.stringify(params));
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
                    enableServerListing: true
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

bot._client.on('registry_data', (packet) => {
    console.log(`[Registry Data] ID: ${packet.id} | Entries count: ${packet.entries ? packet.entries.length : 'none'}`);
    if (packet.entries && packet.entries.length > 0) {
        console.log("First entry keys:", Object.keys(packet.entries[0]));
        console.log("First entry sample:", JSON.stringify(packet.entries[0]).substring(0, 500));
    }
});

bot.on('spawn', () => {
    console.log("✨✨ BOT SPAWNED IN GAME SUCCESSFULLY! ✨✨");
});

bot._client.on('add_resource_pack', (data) => {
    console.log("Received add_resource_pack", data);
    try {
        console.log("Sending resource_pack_receive ACCEPTED...");
        bot._client.write('resource_pack_receive', {
            uuid: data.uuid,
            result: 3
        });
        
        setTimeout(() => {
            console.log("Sending resource_pack_receive SUCCESSFULLY_LOADED...");
            bot._client.write('resource_pack_receive', {
                uuid: data.uuid,
                result: 0
            });
        }, 250);
    } catch (e) {
        console.error("Resource pack error: ", e);
    }
});

bot._client.on('error', (err) => {
    console.log("Client error:", err);
});

bot.on('message', (msg) => {
    console.log("[Chat]", msg.toString());
});

setTimeout(() => {
    console.log("Exiting test.");
    bot.quit();
    process.exit(0);
}, 60000);
