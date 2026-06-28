const mc = require('minecraft-protocol');
console.log("Pinging phasecore.pikamc.vn:25230...");
mc.ping({ host: 'phasecore.pikamc.vn', port: 25230 }, (err, response) => {
    if (err) {
        console.error("Ping failed:", err);
    } else {
        console.log("Version:", JSON.stringify(response.version, null, 2));
    }
    process.exit(0);
});
