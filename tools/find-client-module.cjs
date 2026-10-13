const fs = require('fs');
const path = require('path');
const query = process.argv[2];
if (!query) {
  console.error('Usage: npm run inspect:module -- <module-id-or-text>');
  process.exit(1);
}
const root = path.resolve(__dirname, '../research');
let found = 0;
for (const file of fs.readdirSync(root).filter(name => name.endsWith('.js'))) {
  const code = fs.readFileSync(path.join(root, file), 'utf8');
  // Index minified webpack module declarations without executing downloaded code.
  const modules = [...code.matchAll(/(?:^|[,\{])(\d+):\([\w$,]*\)=>\{/g)];
  for (let i = 0; i < modules.length; i++) {
    const start = modules[i].index + (code[modules[i].index] === ',' || code[modules[i].index] === '{' ? 1 : 0);
    const end = i + 1 < modules.length ? modules[i + 1].index : code.length;
    const body = code.slice(start, end);
    if (/^\d+$/.test(query) ? modules[i][1] === query : body.includes(query)) {
      found++;
      const offset = /^\d+$/.test(query) ? 0 : body.indexOf(query);
      console.log(`${file} :: module ${modules[i][1]} :: byte offset ${Buffer.byteLength(code.slice(0, start))}`);
      console.log(body.slice(Math.max(0, offset - 200), offset + 1600) + '\n');
    }
  }
}
if (!found) {
  console.error('No matching module found in the downloaded bundles.');
  process.exitCode = 1;
}
