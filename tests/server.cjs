const assert = require('assert');
const http = require('http');
const { WebSocket } = require('ws');
const { createApp } = require('../server.cjs');
async function run() {
  const app = createApp();
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const port = app.server.address().port;
  const connections = [];
  function client() {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/socket`, { origin: `http://localhost:${port}` });
    connections.push(ws);
    const queue = [], waiters = [];
    ws.on('message', data => { const m = JSON.parse(data); const i = waiters.findIndex(w => w.type === m.type); if (i >= 0) waiters.splice(i, 1)[0].resolve(m); else queue.push(m); });
    return { ws, send: m => ws.send(JSON.stringify(m)), next: type => new Promise((resolve, reject) => {
      const index = queue.findIndex(m => m.type === type); if (index >= 0) return resolve(queue.splice(index, 1)[0]);
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 3000);
      waiters.push({ type, resolve: m => { clearTimeout(timer); resolve(m); } });
    }) };
  }
  try {
    const a = client(); await a.next('SessionEstablished');
    a.send({ type: 'CreateRoom', name: 'Host' }); const joined = await a.next('Joined'); const first = await a.next('RoomState');
    assert.equal(first.board.length, 19); assert.equal(first.board.filter(t => t.resource === 'desert').length, 1);
    const b = client(); await b.next('SessionEstablished');
    b.send({ type: 'JoinRoom', code: 'BAD', name: 'Guest' }); assert.equal((await b.next('Error')).message, 'Room not found.');
    b.send({ type: 'JoinRoom', code: joined.code, name: '<script>guest</script>' }); await b.next('Joined');
    const state = await b.next('RoomState'); assert.deepStrictEqual(state.board, first.board); assert.equal(state.players.length, 2); assert(!JSON.stringify(state).includes(joined.token));
    await a.next('RoomState');
    const closed = new Promise(resolve => a.ws.once('close', resolve)); a.ws.close(); await closed;
    const offline = await b.next('RoomState'); assert.equal(offline.players[0].online, false);
    const resume = client(); await resume.next('SessionEstablished'); resume.send({ type: 'Resume', code: joined.code, token: joined.token }); assert.equal((await resume.next('Joined')).playerId, joined.playerId); assert.equal((await resume.next('RoomState')).players.length, 2);
    const html = await new Promise(resolve => http.get(`http://127.0.0.1:${port}/`, res => { let text=''; res.on('data', data => text += data); res.on('end', () => resolve(text)); })); assert(html.includes('Private Settlers'));
    console.log('PASS: handshake, room creation/join, shared board, missing room, token privacy, disconnect/reconnect, HTTP page');
  } finally { await app.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
