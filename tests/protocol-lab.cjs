const assert = require('assert/strict');
const WebSocket = require('ws');
const { decode } = require('@msgpack/msgpack');
const { startLab } = require('../tools/protocol-lab.cjs');
const { createActionSequence, encodeActionPacket, applyStateDiffs } = require('../protocol.cjs');

(async () => {
  const lab = await startLab();
  try {
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${lab.port}`);
      const timer = setTimeout(() => { socket.terminate(); reject(new Error('Fixture timed out')); }, 5000);
      let step = 0;
      const state = {};
      socket.on('error', error => { clearTimeout(timer); socket.terminate(); reject(error); });
      socket.on('message', (bytes, binary) => {
        try {
          step++;
          if (step <= 2) {
            assert.equal(binary, false);
            assert.equal(JSON.parse(bytes.toString()).type, step === 1 ? 'Connected' : 'SessionEstablished');
            return;
          }
          assert.equal(binary, true);
          const message = decode(bytes);
          assert.equal(message.id, 130);
          assert.equal(message.data.sequence, step - 2);
          if (step === 3) {
            assert.equal(message.data.type, 1);
            assert.equal(message.data.payload.serverId, 'local-lab');
          } else {
            assert.equal(message.data.type, 91);
            applyStateDiffs(state, [message.data.payload.diff]);
            if (step === 4) socket.send(encodeActionPacket('local-lab', createActionSequence()('roll')));
            else {
              assert.deepEqual(state.currentState, { fixture: true, lastFixtureAction: 2 });
              clearTimeout(timer);
              socket.close();
              resolve();
            }
          }
        } catch (error) { clearTimeout(timer); socket.terminate(); reject(error); }
      });
    });
    for (const invalid of [
      'text command',
      Buffer.from([3, 1, 8]),
      encodeActionPacket('wrong-server', createActionSequence()('roll')),
    ]) {
      await new Promise((resolve, reject) => {
        const socket = new WebSocket(`ws://127.0.0.1:${lab.port}`);
        const timer = setTimeout(() => { socket.terminate(); reject(new Error('Invalid command was not rejected')); }, 5000);
        socket.on('open', () => socket.send(invalid));
        socket.on('error', error => { clearTimeout(timer); socket.terminate(); reject(error); });
        socket.on('close', code => {
          clearTimeout(timer);
          try { assert.equal(code, 1008); resolve(); } catch (error) { reject(error); }
        });
      });
    }
    console.log('PASS: local JSON handshake, binary game events, action packet, state update');
    console.log('PASS: rejection of text commands, truncated packets, and wrong recipients');
  } finally { await lab.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
