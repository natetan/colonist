const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');

function createApp() {
  const rooms = new Map();
  const clients = new Set();
  const server = http.createServer((req, res) => {
    const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
    const file = files[new URL(req.url, 'http://localhost').pathname];
    if (!file) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:" });
    res.end(fs.readFileSync(path.join(__dirname, 'public', file[0])));
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/socket' || !['http://localhost:' + server.address().port, 'http://127.0.0.1:' + server.address().port].includes(req.headers.origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  const send = (ws, message) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); };
  function snapshot(room) {
    return { type: 'RoomState', code: room.code, host: room.players[0].id, players: room.players.map(p => ({ id: p.id, name: p.name, online: !!p.ws })), board: room.board };
  }
  function broadcast(room) { for (const player of room.players) if (player.ws) send(player.ws, snapshot(room)); }
  function board() {
    const resources = ['wood','wood','wood','wood','sheep','sheep','sheep','sheep','wheat','wheat','wheat','wheat','brick','brick','brick','ore','ore','ore','desert'];
    for (let i = resources.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [resources[i], resources[j]] = [resources[j], resources[i]]; }
    const numbers = [5,2,6,3,8,10,9,12,11,4,8,10,9,4,5,6,3,11];
    const tiles = [];
    for (let r = -2; r <= 2; r++) for (let q = Math.max(-2, -r - 2); q <= Math.min(2, -r + 2); q++) {
      const resource = resources.pop(); tiles.push({ q, r, resource, number: resource === 'desert' ? null : numbers.pop() });
    }
    return tiles;
  }
  wss.on('connection', ws => {
    clients.add(ws);
    const sessionId = crypto.randomUUID();
    send(ws, { type: 'Connected', userSessionId: sessionId });
    send(ws, { type: 'SessionEstablished' });
    ws.on('message', bytes => {
      try {
        const message = JSON.parse(bytes.toString());
        if (message.type === 'Resume') {
          if (ws.room) throw new Error('Already in a room.');
          const room = rooms.get(message.code);
          const player = room && room.players.find(p => p.token === message.token);
          if (!player) throw new Error('Saved session is unavailable. Create or join a room.');
          if (player.ws) throw new Error('This player is already connected in another window.');
          player.ws = ws; ws.room = room; ws.player = player;
          send(ws, { type: 'Joined', code: room.code, playerId: player.id, token: player.token }); return broadcast(room);
        }
        if (message.type !== 'CreateRoom' && message.type !== 'JoinRoom') throw new Error('Unknown command.');
        if (ws.room) throw new Error('Already in a room. Reload to reconnect.');
        if (typeof message.name !== 'string' || !message.name.trim() || message.name.trim().length > 24) throw new Error('Use a name of 1–24 characters.');
        let room;
        if (message.type === 'CreateRoom') {
          let code; do { code = crypto.randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
          room = { code, players: [], board: board() }; rooms.set(code, room);
        } else {
          room = rooms.get(String(message.code).trim().toUpperCase());
          if (!room) throw new Error('Room not found.');
          if (room.players.length >= 6) throw new Error('This prototype supports six seats.');
        }
        const player = { id: sessionId, token: crypto.randomBytes(24).toString('hex'), name: message.name.trim(), ws };
        room.players.push(player); ws.room = room; ws.player = player;
        send(ws, { type: 'Joined', code: room.code, playerId: player.id, token: player.token }); broadcast(room);
      } catch (error) { send(ws, { type: 'Error', message: error.message }); }
    });
    ws.on('close', () => {
      clients.delete(ws);
      if (ws.player) { ws.player.ws = null; broadcast(ws.room); }
      // Preserve disconnected seats for refresh/reconnect; discard fully empty rooms after ten minutes.
      if (ws.room && ws.room.players.every(p => !p.ws)) {
        const room = ws.room;
        const timer = setTimeout(() => { if (room.players.every(p => !p.ws)) rooms.delete(room.code); }, 600000); timer.unref();
      }
    });
  });
  return { server, close: () => new Promise(resolve => { for (const ws of clients) ws.terminate(); wss.close(() => server.close(resolve)); }) };
}
if (require.main === module) {
  const app = createApp();
  const port = Number(process.env.PORT || 3000);
  app.server.listen(port, '127.0.0.1', () => console.log(`Private Settlers: http://localhost:${app.server.address().port}`));
}
module.exports = { createApp };
