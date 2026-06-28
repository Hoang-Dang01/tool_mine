const mineflayer = require('mineflayer');
const UUID = require('uuid-1345');

console.log("Connecting with 1.20.3+ resourcePack download-flow handler...");
const bot = mineflayer.createBot({
    host: 'phasecore.pikamc.vn',
    port: 25230,
    username: 'yuevn',
    version: '1.21.10',
    viewDistance: 'tiny',
    physicsEnabled: false
});

bot._client.on('connect', () => {
    console.log("Client event: connect");
});

bot._client.on('add_resource_pack', (data) => {
    console.log("Custom RP Handler: received add_resource_pack", data);
    
    try {
        const uuidBuffer = new UUID(data.uuid);
        
        console.log("Sending ACCEPTED (3) status...");
        bot._client.write('resource_pack_receive', {
            uuid: uuidBuffer,
            result: 3
        });
        
        // Wait 500ms, then send DOWNLOADED (4)
        setTimeout(() => {
            console.log("Sending DOWNLOADED (4) status...");
            bot._client.write('resource_pack_receive', {
                uuid: uuidBuffer,
                result: 4
            });
            
            // Wait 500ms, then send SUCCESSFULLY_LOADED (0)
            setTimeout(() => {
                console.log("Sending SUCCESSFULLY_LOADED (0) status...");
                bot._client.write('resource_pack_receive', {
                    uuid: uuidBuffer,
                    result: 0
                });
                console.log("Custom RP response flow completed!");
            }, 500);
        }, 500);
    } catch (err) {
        console.error("Error sending custom RP response:", err);
    }
});

const events = [
    'spawn', 'login', 'kicked', 'error', 'end', 'stateChanged',
    'forcedMove', 'mount', 'dismount', 'playerJoined', 'playerLeft'
];

events.forEach(evt => {
    bot.on(evt, (...args) => {
        console.log(`Event: ${evt}`, args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(', '));
    });
});

bot.on('message', (jsonMsg) => {
    console.log("[Chat]", jsonMsg.toString());
});

bot._client.on('error', (err) => {
    console.log("Client error:", err);
});
bot._client.on('end', (reason) => {
    console.log("Client end:", reason);
});

setTimeout(() => {
    console.log("Timeout, closing bot.");
    bot.quit();
    process.exit(0);
}, 25000);
