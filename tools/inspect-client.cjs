const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../research');
const summary = [];
for (const name of fs.readdirSync(root).filter(n => n.endsWith('.js'))) {
  const code = fs.readFileSync(path.join(root, name), 'utf8');
  const terms = ['WebSocket', 'gameStateUpdated', 'applyStateUpdate', 'mapValidator', 'canPlayerBuyDevelopmentCard', 'initializeSocket', 'sourceMappingURL', 'PIXI', 'Phaser'];
  summary.push({ file: name, bytes: Buffer.byteLength(code), signals: Object.fromEntries(terms.map(term => [term, code.split(term).length - 1])), urls: [...new Set(code.match(/https?:\/\/[^\s"'`<>\\]+/g) || [])].filter(url => !url.includes('w3.org')).slice(0, 40) });
}
fs.writeFileSync(path.join(root, 'client-inventory.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(summary.map(s => `${s.file}: ${s.bytes} bytes; ${Object.entries(s.signals).filter(([, n]) => n).map(([k, n]) => `${k}=${n}`).join(', ')}`).join('\n'));
