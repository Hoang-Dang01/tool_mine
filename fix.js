const fs = require('fs');
let code = fs.readFileSync('src/server.js', 'utf-8');
code = code.replace(/\\`/g, '`');
code = code.replace(/\\\$/g, '$');
fs.writeFileSync('src/server.js', code);
console.log("Fixed syntax errors in server.js!");
