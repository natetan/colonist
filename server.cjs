const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');
const rules = require('./game.cjs');
const turns = require('./turns.cjs');
const trading = require('./trading.cjs');
const development = require('./development.cjs');
const scoring = require('./scoring.cjs');
const boards = require('./board.cjs');
const {createStore} = require('./persistence.cjs');

function createApp(options = {}) {
  const random = options.random || crypto.randomInt;
  const store = createStore(options.saveFile);
  const rooms = store.load();
  let storageFailure=false;
  function persist(){
    try{store.save(rooms);}catch(error){storageFailure=true;console.error('Saving games failed: '+error.message);throw new Error('Saving failed. Moves are paused; restart the server after fixing storage.');}
  }
  const clients = new Set();
  const server = http.createServer((req, res) => {
    if (options.httpHandler) return options.httpHandler(req, res);
    const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/scoring.js':['scoring.js','text/javascript'], '/development.js':['development.js','text/javascript'], '/trading.js':['trading.js','text/javascript'], '/trading.css':['trading.css','text/css'] };
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
    if(g && g.turn!==undefined){game.bankRates=trading.rates(g,viewer.id);game.tradeOffer=g.tradeOffer;game.tradeDecline=g.tradeDecline||null;game.canAcceptTrade=!!g.tradeOffer&&g.tradeOffer.to===viewer.id&&trading.hasCards(g.resources[viewer.id]||{},g.tradeOffer.receive);}
    if(g && g.turn!==undefined){game.development=development.view(g,viewer.id,turns.roadLocations);game.scoring=scoring.view(g,viewer.id);}
    const state = { type: 'RoomState', persistence:!!options.saveFile, code: room.code, host: room.players[0].id, players: room.players.map(p => ({ id: p.id, name: p.name, bot: !!p.bot, online: !!p.ws || !!p.bot, playing: !!g && g.players.includes(p.id),points:g?scoring.publicPoints(g,p.id)+(g.winner===p.id?g.revealedVictoryPoints:0):0 })), board: room.board, harbors:room.harbors||[], game };
    for(const player of state.players){player.resourceCount=Object.values(g?.resources?.[player.id]||{}).reduce((a,b)=>a+b,0);player.developmentCount=g?.developmentHands?.[player.id]?.length||0;player.knightsPlayed=g?.knightsPlayed?.[player.id]||0;}
    // Optional presentation adapter receives only the already-redacted snapshot.
    if (options.boardPresentation) state.renderer = options.boardPresentation(state);
    return state;
  }
  function broadcast(room) { if(storageFailure)return;for (const player of room.players) if (player.ws) send(player.ws, snapshot(room, player)); }
  const botTimers=new Map();
  function playBotTurns(room) {
    if(botTimers.has(room)||storageFailure)return;
    if(room.game.phase==='complete'){turns.begin(room.game,room.board);persist();broadcast(room);}
    for(let actionCount=0;actionCount<200;actionCount++) {
      const regular=room.game.turn!==undefined;
      let current = room.players.find(p => p.id === (regular?turns.current(room.game):room.game.order[room.game.step]));
      if(regular&&room.game.phase==='discard')current=room.players.find(p=>p.bot&&room.game.discards[p.id]);
      if (!current || !current.bot) break;
      if(regular){const move=turns.botAction(room.game,room.board,current.id);if(!move)break;turns.act(room.game,room.board,current.id,move,random,options.developmentRandom);}
      else {const move = rules.botMove(room.game, room.board);rules.place(room.game, room.board, current.id, move.type, move.id);if(room.game.phase==='complete')turns.begin(room.game,room.board);}
      persist();broadcast(room);
      if(options.botDelayMs>0){const timer=setTimeout(()=>{botTimers.delete(room);if(room.players.some(p=>p.ws)){try{playBotTurns(room);}catch(error){console.error("Bot turn paused:",error.message);}}},options.botDelayMs);timer.unref();botTimers.set(room,timer);break;}
    }
  }
  wss.on('connection', ws => {
    clients.add(ws);
    const sessionId = crypto.randomUUID();
    send(ws, { type: 'Connected', userSessionId: sessionId });
    send(ws, { type: 'SessionEstablished' });
    ws.on('message', bytes => {
      try {
        if(storageFailure)throw new Error('Saving failed. Moves are paused; restart the server after fixing storage.');
        const message = JSON.parse(bytes.toString());
        if(message.type==='Chat'){
          if(!ws.room||!ws.player)throw new Error('Join a room before chatting.');
          if(typeof message.text!=='string'||!message.text.trim()||message.text.length>300)throw new Error('Chat messages must contain 1–300 characters.');
          if(ws.lastChat&&Date.now()-ws.lastChat<750)throw new Error('Wait a moment before sending another message.');
          ws.lastChat=Date.now();const chat={type:'Chat',player:ws.player.id,name:ws.player.name,text:message.text.trim()};for(const p of ws.room.players)if(p.ws)send(p.ws,chat);return;
        }
        if (['Rematch','StartGame','PlaceSettlement','PlaceRoad','RollDice','EndTurn','BuildRoad','BuildSettlement','BuildCity','MoveRobber','Steal','Discard',...trading.commands,...development.commands].includes(message.type)) {
          const room = ws.room;
          if (!room) throw new Error('Join a room first.');
          if(message.type==='Rematch'){
            if(room.players[0]!==ws.player)throw new Error('Only the host can start a rematch.');
            if(room.game?.phase!=='finished')throw new Error('Finish the current match before starting a rematch.');
            room.board=options.boardFactory?options.boardFactory():boards.generate(options.boardRandom);room.harbors=boards.harbors(room.board,options.boardRandom);room.game=null;room.players=room.players.filter(p=>!p.bot);
            persist();broadcast(room);return;
          }
          if (message.type === 'StartGame') {
            if (room.players[0] !== ws.player) throw new Error('Only the host can start.');
            if (room.game) throw new Error('The match has already started.');
            const ids = room.players.filter(p => p.ws).map(p => p.id);
            if(ids.length>4)throw new Error('The base game supports at most four players. The five/six-player extension is not implemented yet.');
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
            room.game = rules.start(room.board, ids, solo);room.game.harbors=room.harbors||[];
          } else {
            if (!room.game) throw new Error('The host must start the match first.');
            if(room.game.turn!==undefined)turns.act(room.game,room.board,ws.player.id,message,random,options.developmentRandom);
            else rules.place(room.game, room.board, ws.player.id, message.type, message.id);
          }
          persist();broadcast(room);
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
          persist();send(ws, { type: 'Joined', code: room.code, playerId: player.id, token: player.token }); broadcast(room);if(room.game)playBotTurns(room);return;
        }
        if (message.type !== 'CreateRoom' && message.type !== 'JoinRoom') throw new Error('Unknown command.');
        if (ws.room) throw new Error('Already in a room. Reload to reconnect.');
        if (typeof message.name !== 'string' || !message.name.trim() || message.name.trim().length > 24) throw new Error('Use a name of 1–24 characters.');
        let room;
        if (message.type === 'CreateRoom') {
          let code; do { code = crypto.randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
          room = { code, players: [], board: options.boardFactory ? options.boardFactory() : boards.generate(options.boardRandom) };room.harbors=boards.harbors(room.board,options.boardRandom);rooms.set(code, room);
        } else {
          room = rooms.get(String(message.code).trim().toUpperCase());
          if (!room) throw new Error('Room not found.');
          if (room.game) throw new Error('Match already started. Only existing players can reconnect.');
          if (room.players.length >= 6) throw new Error('This prototype supports six seats.');
        }
        const player = { id: sessionId, token: crypto.randomBytes(24).toString('hex'), name: message.name.trim(), ws };
        room.players.push(player); ws.room = room; ws.player = player;
        persist();send(ws, { type: 'Joined', code: room.code, playerId: player.id, token: player.token }); broadcast(room);
      } catch (error) { send(ws, { type: 'Error', message: error.message }); }
    });
    ws.on('close', () => {
      clients.delete(ws);
      if (ws.player) { ws.player.ws = null; broadcast(ws.room); }
      // Preserve disconnected seats for refresh/reconnect; discard fully empty rooms after ten minutes.
      if (!options.saveFile && ws.room && ws.room.players.every(p => !p.ws)) {
        const room = ws.room;
        const timer = setTimeout(() => { if (room.players.every(p => !p.ws)) rooms.delete(room.code); }, 600000); timer.unref();
      }
    });
  });
  return { server, close: () => new Promise((resolve,reject) => { for(const timer of botTimers.values())clearTimeout(timer);botTimers.clear();for (const ws of clients) ws.terminate(); wss.close(() => server.close(()=>{try{store.close();resolve();}catch(error){reject(error);}})); }) };
}
if (require.main === module) {
  const saveFile=process.env.SETTLERS_SAVE_FILE==='off'?undefined:process.env.SETTLERS_SAVE_FILE||path.join(__dirname,'data','prototype.json');
  const app = createApp({saveFile});
  let stopping=false;const stop=()=>{if(stopping)return;stopping=true;app.close().then(()=>process.exit(0));};process.on('SIGINT',stop);process.on('SIGTERM',stop);
  const port = Number(process.env.PORT || 3000);
  app.server.listen(port, '127.0.0.1', () => console.log(`Private Settlers: http://localhost:${app.server.address().port}`));
}
module.exports = { createApp };
