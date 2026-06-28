const net = require('net');

console.log("Testing TCP connection to phasecore.pikamc.vn:25230...");
const client = net.createConnection({ host: 'phasecore.pikamc.vn', port: 25230 }, () => {
    console.log("SUCCESS: Connected to port 25230!");
    client.end();
});

client.on('error', (err) => {
    console.error("FAILURE: Could not connect to port 25230. Error:", err.message);
});
