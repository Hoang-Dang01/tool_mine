const mineflayer = require('mineflayer');

const username = 'Acetazolamid';
console.log(`Connecting as ${username} to phasecore.pikamc.vn:25230...`);

const bot = mineflayer.createBot({
    host: 'phasecore.pikamc.vn',
    port: 25230,
    username: username,
    version: '1.21.10',
    viewDistance: 'tiny',
    physicsEnabled: false
});

bot._client.on('connect', () => {
    console.log("Client connected. Applying brand/settings patch...");
    const originalWrite = bot._client.write.bind(bot._client);
    bot._client.write = (name, params) => {
        if (name === 'select_known_packs') {
            params = {
                packs: [
                    { namespace: 'minecraft', id: 'core', version: '1.21.10' }
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

bot._client.on('add_resource_pack', (data) => {
    console.log("Received resource pack request:", data);
    try {
        bot._client.write('resource_pack_receive', {
            uuid: data.uuid,
            result: 3 // ACCEPTED
        });
        
        setTimeout(() => {
            bot._client.write('resource_pack_receive', {
                uuid: data.uuid,
                result: 0 // SUCCESSFULLY_LOADED
            });
            console.log("Resource pack responses sent.");
        }, 250);
    } catch (e) {
        console.error("Resource pack handle error:", e);
    }
});

bot.on('spawn', () => {
    console.log("✨ Bot successfully spawned in game! ✨");
    setTimeout(() => {
        console.log("Disconnecting bot...");
        bot.quit();
        process.exit(0);
    }, 5000);
});

bot.on('message', (msg) => {
    console.log("[Chat]", msg.toString());
});

bot.on('kicked', (reason) => {
    console.log("Bot kicked. Reason:", reason);
});

bot.on('error', (err) => {
    console.log("Bot error:", err.message);
});

bot.on('end', (reason) => {
    console.log("Connection ended. Reason:", reason);
    process.exit(0);
});

setTimeout(() => {
    console.log("Timeout, closing.");
    bot.quit();
    process.exit(0);
}, 20000);
