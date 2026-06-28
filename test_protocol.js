const mc = require('minecraft-protocol');
const UUID = require('uuid-1345');

console.log("Connecting directly using minecraft-protocol...");
const client = mc.createClient({
    host: 'phasecore.pikamc.vn',
    port: 25230,
    username: 'yuevn',
    version: '1.21.10'
});

client.on('connect', () => {
    console.log("TCP Connected! Patching write to log outbound packets...");
    const originalWrite = client.write.bind(client);
    client.write = (name, params) => {
        if (name === 'select_known_packs') {
            console.log("[INTERCEPT] Overriding select_known_packs payload!");
            params = {
                packs: [
                    { namespace: 'minecraft', id: 'core', version: '1.21.10' }
                ]
            };
        }
        
        const result = originalWrite(name, params);
        
        if (name === 'login_acknowledged') {
            console.log("[INTERCEPT] login_acknowledged detected. Sending settings and brand...");
            setTimeout(() => {
                client.write('settings', {
                    locale: 'en_US',
                    viewDistance: 10,
                    chatFlags: 0,
                    chatColors: true,
                    skinParts: 127,
                    mainHand: 1,
                    enableTextFiltering: false,
                    enableServerListing: true
                });
                
                client.write('custom_payload', {
                    channel: 'minecraft:brand',
                    data: Buffer.from([7, 118, 97, 110, 105, 108, 108, 97]) // 'vanilla'
                });
            }, 100);
        }
        
        console.log(`[OUTBOUND] State: ${client.state} | Name: ${name}`, JSON.stringify(params));
        return result;
    };
});

client.on('packet', (data, metadata) => {
    if (metadata.name !== 'keep_alive' && metadata.name !== 'registry_data' && metadata.name !== 'tags') {
        console.log(`[INBOUND] State: ${client.state} | Name: ${metadata.name}`, JSON.stringify(data));
    }
});

client.on('add_resource_pack', (data) => {
    console.log("Custom RP Handler: received add_resource_pack", data);
    try {
        const uuidBuffer = new UUID(data.uuid);
        console.log("Sending ACCEPTED (3) status...");
        client.write('resource_pack_receive', {
            uuid: uuidBuffer,
            result: 3
        });
        
        setTimeout(() => {
            console.log("Sending DOWNLOADED (4) status...");
            client.write('resource_pack_receive', {
                uuid: uuidBuffer,
                result: 4
            });
            
            setTimeout(() => {
                console.log("Sending SUCCESSFULLY_LOADED (0) status...");
                client.write('resource_pack_receive', {
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

client.on('error', (err) => {
    console.log("Client error:", err);
});
client.on('end', (reason) => {
    console.log("Client end:", reason);
});

setTimeout(() => {
    console.log("Timeout, closing.");
    client.end();
    process.exit(0);
}, 25000);
