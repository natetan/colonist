const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const root = path.resolve(__dirname, '..');
const runtime = process.env.REA_NODE || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe');
const cli = path.join(root, '.rea-tools/node_modules/rea-agents/scripts/rea.mjs');
if (!fs.existsSync(runtime) || !fs.existsSync(cli)) {
  console.error('REA runtime not installed. See research/rea-setup.md. Override REA_NODE with a supported Node executable if necessary.');
  process.exit(1);
}
const report = path.join(root, '.rea-tools/colonist-analysis.json');
const output = fs.openSync(report, 'w');
const child = spawn(runtime, [cli, 'analyze-javascript-application', path.join(root, 'research'), '--json'], { cwd: root, stdio: ['ignore', output, 'inherit'], windowsHide: true });
fs.closeSync(output);
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code === null ? 1 : code; if (code === 0) console.log(`REA report saved: ${report}`); });
