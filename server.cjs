const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');
const rules = require('./game.cjs');
const turns = require('./turns.cjs');

function createApp(options = {}) {
  const random = options.random || crypto.randomInt;
  const rooms = new Map();
  const clients = new Set();
  const server = http.createServer((req, res) => {
    if (options.httpHandler) return options.httpHandler(req, res);
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
  function snapshot(room, viewer) {
    const g = room.game;
    const game = g ? { phase: g.phase, currentPlayer: g.order[g.step] || null, solo: g.solo, colors: g.colors, vertices: g.vertices, edges: g.edges, legalVertices: g.phase === 'settlement' ? rules.legalVertices(g) : [], legalEdges: g.phase === 'road' ? rules.legalEdges(g) : [], resources: g.resources[viewer.id] || null } : null;
    if(g && g.turn!==undefined){Object.assign(game,{currentPlayer:turns.current(g),dice:g.dice,robber:g.robber,discardCount:g.discards[viewer.id]||0,victims:g.phase==='steal'&&turns.current(g)===viewer.id?g.victims:[],builds:g.phase==='build'&&turns.current(g)===viewer.id?Object.fromEntries(Object.keys(turns.costs).map(type=>[type,turns.buildLocations(g,viewer.id,type)])):{},bank:g.bank});}
    const state = { type: 'RoomState', code: room.code, host: room.players[0].id, players: room.players.map(p => ({ id: p.id, name: p.name, bot: !!p.bot, online: !!p.ws || !!p.bot, playing: !!g && g.players.includes(p.id),points:g?g.vertices.filter(v=>v.owner===p.id).reduce((n,v)=>n+(v.city?2:1),0):0 })), board: room.board, game };
    // Optional presentation adapter receives only the already-redacted snapshot.
    if (options.boardPresentation) state.renderer = options.boardPresentation(state);
    return state;
  }
  function broadcast(room) { for (const player of room.players) if (player.ws) send(player.ws, snapshot(room, player)); }
  function playBotTurns(room) {
    if(room.game.phase==='complete'){turns.begin(room.game,room.board);broadcast(room);}
    for(let actionCount=0;actionCount<200;actionCount++) {
      const regular=room.game.turn!==undefined;
      let current = room.players.find(p => p.id === (regular?turns.current(room.game):room.game.order[room.game.step]));
      if(regular&&room.game.phase==='discard')current=room.players.find(p=>p.bot&&room.game.discards[p.id]);
      if (!current || !current.bot) break;
      if(regular){const move=turns.botAction(room.game,room.board,current.id);if(!move)break;turns.act(room.game,room.board,current.id,move,random);}
      else {const move = rules.botMove(room.game, room.board);rules.place(room.game, room.board, current.id, move.type, move.id);if(room.game.phase==='complete')turns.begin(room.game,room.board);}
      broadcast(room);
    }
  }
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
        if (['StartGame','PlaceSettlement','PlaceRoad','RollDice','EndTurn','BuildRoad','BuildSettlement','BuildCity','MoveRobber','Steal','Discard'].includes(message.type)) {
          const room = ws.room;
          if (!room) throw new Error('Join a room first.');
          if (message.type === 'StartGame') {
            if (room.players[0] !== ws.player) throw new Error('Only the host can start.');
            if (room.game) throw new Error('The match has already started.');
            const ids = room.players.filter(p => p.ws).map(p => p.id);
            const solo = message.solo === true;
            const bots = message.bots === true;
            if (solo && bots) throw new Error('Choose bots or solo placement test.');
            if (bots && ids.length > 4) throw new Error('Start with bots supports at most four online humans.');
            if (solo && ids.length !== 1) throw new Error('Solo test requires exactly one online player.');
            if (!solo && !bots && ids.length < 2) throw new Error('Join with another player or use Start with bots.');
            if (bots) {
              for (let i = 1; ids.length < 4; i++) {
                const bot = { id: crypto.randomUUID(), name: `Bot ${i}`, bot: true, ws: null };
                room.players.push(bot); ids.push(bot.id);
              }
            }
            room.game = rules.start(room.board, ids, solo);
          } else {
            if (!room.game) throw new Error('The host must start the match first.');
            if(room.game.turn!==undefined)turns.act(room.game,room.board,ws.player.id,message,random);
            else rules.place(room.game, room.board, ws.player.id, message.type, message.id);
          }
          broadcast(room);
          playBotTurns(room);
          return;
        }
        if (message.type === 'Resume') {
          if (ws.room) throw new Error('Already in a room.');
          const room = rooms.get(message.code);
          const player = room && typeof message.token === 'string' && room.players.find(p => !p.bot && p.token === message.token);
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
          if (room.game) throw new Error('Match already started. Only existing players can reconnect.');
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
