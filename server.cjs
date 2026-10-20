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
const turnTimer=require('./turn-timer.cjs');
const {createStore} = require('./persistence.cjs');

function createApp(options = {}) {
  const allowedOrigins = new Set(options.allowedOrigins || []);
  for (const origin of allowedOrigins) {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) throw new Error('Allowed origins must be exact HTTP(S) origins');
  }
  const random = options.random || crypto.randomInt;
  const store = createStore(options.saveFile);
  const botTradeTimers=new Map();
  const rooms = store.load(),turnTimers=new Map(),now=options.now||Date.now,setTurnTimeout=options.setTurnTimeout||setTimeout,clearTurnTimeout=options.clearTurnTimeout||clearTimeout;
  let storageFailure=false;
  function persist(){
    try{for(const room of rooms.values()){scheduleTurn(room);scheduleBotTrades(room);scheduleTakeovers(room);}store.save(rooms);}catch(error){storageFailure=true;console.error('Saving games failed: '+error.message);throw new Error('Saving failed. Moves are paused; restart the server after fixing storage.');}
  }
  const clients = new Set(),takeoverTimers=new Map();let closing=false;
  const isBot=p=>!!(p.bot||p.autopilot);
  function clearTakeover(player){const pending=takeoverTimers.get(player);if(pending)clearTimeout(pending.handle);takeoverTimers.delete(player);}
  function scheduleTakeovers(room){
    for(const player of room.players){
      const eligible=!closing&&!storageFailure&&rooms.has(room.code)&&room.game?.phase!=='finished'&&room.game?.players.includes(player.id)&&!player.ws&&!player.bot&&!player.autopilot&&room.players.some(p=>p.ws);
      if(!eligible){clearTakeover(player);continue;}if(takeoverTimers.has(player))continue;
      const handle=setTimeout(()=>{takeoverTimers.delete(player);if(closing||storageFailure||player.ws||player.bot||!rooms.has(room.code)||!room.players.some(p=>p.ws))return;try{player.autopilot=true;persist();broadcast(room);playBotTurns(room);}catch(error){console.error('Bot takeover paused: '+error.message);}},options.disconnectGraceMs??15000);
      handle.unref();takeoverTimers.set(player,{handle,room});
    }
  }
  // Detect vanished networks as well as cleanly closed tabs, so seats do not
  // remain occupied forever when a device loses its connection without a close.
  const heartbeat=setInterval(()=>{for(const ws of clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;if(ws.readyState===WebSocket.OPEN)ws.ping();}},options.heartbeatMs??30000);
  heartbeat.unref();
  const server = http.createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(storageFailure ? 503 : 200, {'Content-Type':'application/json','Cache-Control':'no-store'});
      return res.end(JSON.stringify({ok:!storageFailure}));
    }
    if (options.httpHandler) return options.httpHandler(req, res);
    const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/scoring.js':['scoring.js','text/javascript'], '/development.js':['development.js','text/javascript'], '/trading.js':['trading.js','text/javascript'], '/trading.css':['trading.css','text/css'] };
    const file = files[new URL(req.url, 'http://localhost').pathname];
    if (!file) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:" });
    res.end(fs.readFileSync(path.join(__dirname, 'public', file[0])));
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/socket' || !(allowedOrigins.has(req.headers.origin) || ['http://localhost:' + server.address().port, 'http://127.0.0.1:' + server.address().port].includes(req.headers.origin))) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  const send = (ws, message) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); };
  function snapshot(room, viewer) {
    const g = room.game;
    const game = g ? { phase: g.phase, currentPlayer: g.order[g.step] || null, solo: g.solo, colors: g.colors, vertices: g.vertices, edges: g.edges, legalVertices: g.phase === 'settlement' ? rules.legalVertices(g) : [], legalEdges: g.phase === 'road' ? rules.legalEdges(g) : [], resources: g.resources[viewer.id] || null } : null;
    if(g && g.turn!==undefined){Object.assign(game,{currentPlayer:turns.current(g),dice:g.dice,production:g.production||null,robber:g.robber,discardCount:g.discards[viewer.id]||0,victims:g.phase==='steal'&&turns.current(g)===viewer.id?g.victims:[],builds:g.phase==='build'&&turns.current(g)===viewer.id?Object.fromEntries(Object.keys(turns.costs).map(type=>[type,turns.buildLocations(g,viewer.id,type)])):{},bank:g.bank});}
    if(g){game.turnTimer=g.turnTimer||null;game.lastTimeout=g.lastTimeout||null;}
    if(g && g.turn!==undefined){game.bankRates=trading.rates(g,viewer.id);game.tradeOffer=g.tradeOffer;game.tradeDecline=g.tradeDecline||null;game.confirmableTradePlayers=trading.confirmable(g,viewer.id);game.canAcceptTrade=!!g.tradeOffer&&g.tradeOffer.responses?.[viewer.id]!=='accepted'&&trading.canRespond(g.tradeOffer,viewer.id)&&trading.hasCards(g.resources[g.tradeOffer.from]||{},g.tradeOffer.give)&&trading.hasCards(g.resources[viewer.id]||{},g.tradeOffer.receive);}
    if(g && g.turn!==undefined){game.development=development.view(g,viewer.id,turns.roadLocations);game.scoring=scoring.view(g,viewer.id);}
    const state = { type: 'RoomState', joiningPlayers:room.joiners?.size||0, persistence:!!options.saveFile, code: room.code, mapType:room.mapType||'random', mapSize:room.board.length===30?'extended':'standard', maxPlayers:room.board.length===30?6:4, turnSeconds:room.turnSeconds??60, serverTime:now(), host: room.hostId||room.players[0].id, players: room.players.map(p => ({ id: p.id, name: p.name, bot: isBot(p), autopilot:!!p.autopilot, online: !!p.ws || isBot(p), playing: !!g && g.players.includes(p.id),points:g?scoring.publicPoints(g,p.id)+(g.winner===p.id?g.revealedVictoryPoints:0):0 })), board: room.board, harbors:room.harbors||[], game };
    for(const player of state.players){player.resourceCount=Object.values(g?.resources?.[player.id]||{}).reduce((a,b)=>a+b,0);player.developmentCount=g?.developmentHands?.[player.id]?.length||0;player.knightsPlayed=g?.knightsPlayed?.[player.id]||0;}
    // Optional presentation adapter receives only the already-redacted snapshot.
    if (options.boardPresentation) state.renderer = options.boardPresentation(state);
    return state;
  }
  function broadcast(room) { if(storageFailure)return;scheduleTurn(room);for (const player of room.players) if (player.ws) send(player.ws, snapshot(room, player));if(!room.game)for(const ws of room.joiners||[])send(ws,{...snapshot(room,{id:null}),type:'LobbyPreview'}); }
  function detachPreview(ws){const room=ws.previewRoom;if(!room)return null;clearTimeout(ws.previewTimer);room.joiners?.delete(ws);ws.previewRoom=null;return room;}
  function closePreviews(room){for(const ws of [...(room.joiners||[])]){detachPreview(ws);send(ws,{type:'InviteClosed',message:'This room is no longer available.'});}}
  function scheduleTurn(room){
    const old=turnTimers.get(room);if(!room.players.some(p=>p.ws)){if(old)clearTurnTimeout(old.handle);turnTimers.delete(room);return;}
    const timer=turnTimer.sync(room,now());
    if(old&&(!timer||old.deadline!==timer.deadline||!room.players.some(p=>p.ws))){clearTurnTimeout(old.handle);turnTimers.delete(room);}
    if(!timer||turnTimers.has(room)||!room.players.some(p=>p.ws)||storageFailure)return;
    const handle=setTurnTimeout(()=>{turnTimers.delete(room);try{expireTurn(room);}catch(error){console.error('Turn timer paused: '+error.message);}},Math.min(2147483647,Math.max(1,timer.deadline-now())));handle.unref?.();turnTimers.set(room,{deadline:timer.deadline,handle});
  }
  function expireTurn(room){
    if(storageFailure||!rooms.has(room.code)||!room.players.some(p=>p.ws))return false;
    if(!turnTimer.expire(room,now(),random,options.developmentRandom)){scheduleTurn(room);return false;}
    const pending=botTimers.get(room);if(pending)clearTimeout(pending);botTimers.delete(room);
    persist();broadcast(room);playBotTurns(room);return true;
  }
  const botTimers=new Map();
  function scheduleBotTrades(room){
    const offer=room.game?.phase==='build'?room.game.tradeOffer:null,old=botTradeTimers.get(room);
    const pending=offer&&room.players.some(p=>isBot(p)&&trading.recipients(offer).includes(p.id)&&(offer.responses?.[p.id]||'pending')==='pending');
    if(old&&(!pending||old.offerId!==offer.id||!room.players.some(p=>p.ws))){clearTimeout(old.handle);botTradeTimers.delete(room);}
    if(!pending||botTradeTimers.has(room)||!room.players.some(p=>p.ws)||storageFailure)return;
    const handle=setTimeout(()=>{
      botTradeTimers.delete(room);
      if(storageFailure||!rooms.has(room.code)||room.game?.tradeOffer?.id!==offer.id||!room.players.some(p=>p.ws))return;
      try{
        if(expireTurn(room))return;
        for(const p of room.players){
          if(!isBot(p)||room.game.tradeOffer?.id!==offer.id)continue;
          let type=trading.botResponse(room.game,p.id);if(!type)continue;
          // Availability may have changed while the bot was thinking.
          if(type==='AcceptTrade'&&!trading.hasCards(room.game.resources[offer.from],offer.give))type='DeclineTrade';
          turns.act(room.game,room.board,p.id,{type,offerId:offer.id},random,options.developmentRandom);
        }
        persist();broadcast(room);
      }catch(error){console.error('Bot trade response failed: '+error.message);}
    },Math.max(0,options.botDelayMs??800));
    handle.unref?.();botTradeTimers.set(room,{offerId:offer.id,handle});
  }
  function playBotTurns(room,ready=false) {
    if(botTimers.has(room)||storageFailure)return;
    if(room.game.turnTimer?.deadline<=now()&&expireTurn(room))return;
    if(room.game.phase==='complete'){turns.begin(room.game,room.board);persist();broadcast(room);}
    for(let actionCount=0;actionCount<200;actionCount++) {
      const regular=room.game.turn!==undefined;
      let current = room.players.find(p => p.id === (regular?turns.current(room.game):room.game.order[room.game.step]));
      if(regular&&room.game.phase==='discard')current=room.players.find(p=>isBot(p)&&room.game.discards[p.id]);
      if (!current || !isBot(current)) break;
      if(options.botDelayMs>0&&!ready){const timer=setTimeout(()=>{botTimers.delete(room);if(room.players.some(p=>p.ws)){try{playBotTurns(room,true);}catch(error){console.error("Bot turn paused:",error.message);}}},options.botDelayMs);timer.unref();botTimers.set(room,timer);break;}
      const actionTurn=turnTimer.key(room.game);
      if(regular){const move=turns.botAction(room.game,room.board,current.id);if(!move)break;turns.act(room.game,room.board,current.id,move,random,options.developmentRandom);turnTimer.rewardAction(room,move.type,current.id,actionTurn,now());}
      else {const move = rules.botMove(room.game, room.board);rules.place(room.game, room.board, current.id, move.type, move.id);turnTimer.rewardAction(room,move.type,current.id,actionTurn,now());if(room.game.phase==='complete')turns.begin(room.game,room.board);}
      persist();broadcast(room);
      if(options.botDelayMs>0){playBotTurns(room);break;}
    }
  }
  wss.on('connection', ws => {
    clients.add(ws);
    ws.alive=true;ws.on('pong',()=>{ws.alive=true;});
    const sessionId = crypto.randomUUID();
    send(ws, { type: 'Connected', userSessionId: sessionId });
    send(ws, { type: 'SessionEstablished' });
    ws.on('message', bytes => {
      try {
        if(storageFailure)throw new Error('Saving failed. Moves are paused; restart the server after fixing storage.');
        const message = JSON.parse(bytes.toString());
        if(ws.room&&expireTurn(ws.room)&&!['Chat','LeaveRoom'].includes(message.type))throw new Error('Time expired. The turn has advanced.');
        if(message.type==='PreviewRoom'){
          if(ws.room)throw new Error('You are already in a room.');
          const room=rooms.get(String(message.code).trim().toUpperCase());if(!room)throw new Error('Room not found.');
          if(room.game)throw new Error('The match has started. Use your saved seat or private recovery key to return.');
          if(ws.previewRoom===room){send(ws,{...snapshot(room,{id:null}),type:'LobbyPreview'});return;}
          const capacity=room.board.length===30?6:4;if(room.players.length+(room.joiners?.size||0)>=capacity)throw new Error('This table is full.');
          const old=detachPreview(ws);if(old)broadcast(old);
          room.joiners??=new Set();room.joiners.add(ws);ws.previewRoom=room;
          ws.previewTimer=setTimeout(()=>{if(detachPreview(ws)){send(ws,{type:'InviteClosed',message:'Your joining reservation expired. You can try joining again.'});broadcast(room);}},options.joinTimeoutMs??90000);ws.previewTimer.unref();broadcast(room);return;
        }
        if(message.type==='CancelPreview'){const room=detachPreview(ws);if(room)broadcast(room);return;}
        if(message.type==='LeaveRoom'){
          const room=ws.room,player=ws.player;if(!room||!player)throw new Error('You are not in a room.');
          clearTakeover(player);const humans=room.players.filter(p=>p!==player&&!p.bot);
          if(!humans.length){for(const p of room.players)clearTakeover(p);closePreviews(room);rooms.delete(room.code);const clock=turnTimers.get(room);if(clock)clearTurnTimeout(clock.handle);turnTimers.delete(room);const timer=botTimers.get(room);if(timer)clearTimeout(timer);botTimers.delete(room);}
          else{
            if(room.game?.players.includes(player.id)){player.bot=true;delete player.autopilot;player.ws=null;delete player.token;}
            else room.players=room.players.filter(p=>p!==player);
            // Host authority follows a remaining human, never the replacement bot.
            if((room.hostId||room.players[0]?.id)===player.id)room.hostId=humans[0].id;
          }
          ws.room=null;ws.player=null;persist();send(ws,{type:'LeftRoom'});
          if(rooms.has(room.code)){broadcast(room);if(room.game&&room.players.some(p=>p.ws))playBotTurns(room);}
          return;
        }
        if(message.type==='Chat'){
          if(!ws.room||!ws.player)throw new Error('Join a room before chatting.');
          if(typeof message.text!=='string'||!message.text.trim()||message.text.length>300)throw new Error('Chat messages must contain 1–300 characters.');
          if(ws.lastChat&&Date.now()-ws.lastChat<750)throw new Error('Wait a moment before sending another message.');
          ws.lastChat=Date.now();const chat={type:'Chat',player:ws.player.id,name:ws.player.name,text:message.text.trim()};for(const p of ws.room.players)if(p.ws)send(p.ws,chat);return;
        }
        if(message.type==='SetTurnTimer'){
          const room=ws.room;if(!room||(room.hostId||room.players[0].id)!==ws.player.id)throw new Error('Only the host can change the turn timer.');
          if(room.game)throw new Error('Timer settings are locked after starting.');
          if(!turnTimer.choices.includes(message.seconds))throw new Error('Choose a supported turn duration.');
          room.turnSeconds=message.seconds;persist();broadcast(room);return;
        }
        if(message.type==='SetMap'){
          const room=ws.room;if(!room||(room.hostId||room.players[0].id)!==ws.player.id)throw new Error('Only the host can change the map.');
          if(room.game)throw new Error('The map is locked after starting.');
          if(!boards.mapTypes.includes(message.mapType))throw new Error('Choose Classic, Random, Random+, Random++, Star, Crescent, Long Island, or China.');
          const size=message.mapSize||(room.board.length===30?'extended':'standard');if(!['standard','extended'].includes(size))throw new Error('Choose a supported island size.');
          const extended=size==='extended';if(room.players.length+(room.joiners?.size||0)>(extended?6:4))throw new Error('Too many seats for that island size.');
          const next=message.mapType==='classic'?boards.classic(extended):(()=>{const board=boards.generate(options.boardRandom,extended,message.mapType);return {board,harbors:boards.harbors(board,options.boardRandom)};})();
          room.mapType=message.mapType;room.board=next.board;room.harbors=next.harbors;persist();broadcast(room);return;
        }
        if (['Rematch','StartGame','PlaceSettlement','PlaceRoad','RollDice','EndTurn','BuildRoad','BuildSettlement','BuildCity','MoveRobber','Steal','Discard',...trading.commands,...development.commands].includes(message.type)) {
          const room = ws.room;
          if (!room) throw new Error('Join a room first.');
          if(message.type==='Rematch'){
            if((room.hostId||room.players[0].id)!==ws.player.id)throw new Error('Only the host can start a rematch.');
            if(room.game?.phase!=='finished')throw new Error('Finish the current match before starting a rematch.');
            room.game=null;room.players=room.players.filter(p=>!p.bot);for(const p of room.players)delete p.autopilot;
            persist();broadcast(room);return;
          }
          if (message.type === 'StartGame') {
            if ((room.hostId||room.players[0].id) !== ws.player.id) throw new Error('Only the host can start.');
            if (room.game) throw new Error('The match has already started.');
            if(room.joiners?.size)throw new Error('Wait for joining players to enter their names before starting.');
            const ids = room.players.filter(p => p.ws).map(p => p.id);
            const capacity=room.board.length===30?6:4;if(ids.length>capacity)throw new Error('Too many players for this island.');
            const solo = message.solo === true;
            const bots = message.bots === true;
            if (solo && bots) throw new Error('Choose bots or solo placement test.');
            const target=message.targetPlayers??capacity;if(bots&&(!Number.isInteger(target)||target<Math.max(2,ids.length)||target>capacity))throw new Error('Choose a valid number of players for bots.');
            if (solo && ids.length !== 1) throw new Error('Solo test requires exactly one online player.');
            if (!solo && !bots && ids.length < 2) throw new Error('Join with another player or use Start with bots.');
            if (bots) {
              for (let i = 1; ids.length < target; i++) {
                const bot = { id: crypto.randomUUID(), name: `Bot ${i}`, bot: true, ws: null };
                room.players.push(bot); ids.push(bot.id);
              }
            }
            room.game = rules.start(room.board, ids, solo);const order=rules.randomOrder(ids,options.orderRandom);room.game.players=order;room.game.order=[...order,...order.slice().reverse()];room.game.harbors=room.harbors||[];
          } else {
            if (!room.game) throw new Error('The host must start the match first.');
            const actionTurn=turnTimer.key(room.game);
            if(room.game.turn!==undefined)turns.act(room.game,room.board,ws.player.id,message,random,options.developmentRandom,room.players.filter(p=>room.game.players.includes(p.id)).map(p=>p.id));
            else rules.place(room.game, room.board, ws.player.id, message.type, message.id);
            turnTimer.rewardAction(room,message.type,ws.player.id,actionTurn,now());
          }
          persist();broadcast(room);
          playBotTurns(room);
          return;
        }
        if (message.type === 'Resume' || message.type==='JoinRoom' && message.token!==undefined) {
          if (ws.room) throw new Error('Already in a room.');
          const room = rooms.get(String(message.code).trim().toUpperCase());
          const player = room && typeof message.token === 'string' && room.players.find(p => !p.bot && p.token === message.token);
          if (!player) throw new Error('Saved session is unavailable. Create or join a room.');
          if (player.ws) throw new Error('This player is already connected in another window.');
          const preview=detachPreview(ws);if(preview)broadcast(preview);
          clearTakeover(player);delete player.autopilot;player.ws = ws; ws.room = room; ws.player = player;
          persist();send(ws, { type: 'Joined', code: room.code, playerId: player.id, token: player.token }); broadcast(room);if(room.game)playBotTurns(room);return;
        }
        if (message.type !== 'CreateRoom' && message.type !== 'JoinRoom') throw new Error('Unknown command.');
        if (ws.room) throw new Error('Already in a room. Reload to reconnect.');
        if (typeof message.name !== 'string' || !message.name.trim() || message.name.trim().length > 24) throw new Error('Use a name of 1–24 characters.');
        let room;
        if (message.type === 'CreateRoom') {
          let code; do { code = crypto.randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
          const fixed=boards.classic();room = { code, players: [], turnSeconds:60, mapType:options.boardFactory?'random':'classic',board:options.boardFactory?options.boardFactory():fixed.board };room.harbors=options.boardFactory?boards.harbors(room.board,options.boardRandom):fixed.harbors;rooms.set(code, room);
        } else {
          room = rooms.get(String(message.code).trim().toUpperCase());
          if (!room) throw new Error('Room not found.');
          if (room.game) throw new Error('Match already started. Only existing players can reconnect.');
          if (room.players.length+(room.joiners?.size||0)-(ws.previewRoom===room?1:0) >= (room.board.length===30?6:4)) throw new Error(room.board.length===30?'This table supports six players.':'This table supports four players.');
        }
        const preview=detachPreview(ws);if(preview&&preview!==room)broadcast(preview);
        const player = { id: sessionId, token: crypto.randomBytes(24).toString('hex'), name: message.name.trim(), ws };
        room.players.push(player); ws.room = room; ws.player = player;
        persist();send(ws, { type: 'Joined', code: room.code, playerId: player.id, token: player.token }); broadcast(room);
      } catch (error) { send(ws, { type: 'Error', message: error.message }); }
    });
    ws.on('close', () => {
      clients.delete(ws);const preview=detachPreview(ws);if(preview)broadcast(preview);
      if (ws.player&&ws.player.ws===ws) { ws.player.ws = null; broadcast(ws.room);if(!closing)scheduleTakeovers(ws.room); }
      // Preserve disconnected seats for refresh/reconnect; discard fully empty rooms after ten minutes.
      if (!options.saveFile && ws.room && ws.room.players.every(p => !p.ws)) {
        const room = ws.room;
        const timer = setTimeout(() => { if (room.players.every(p => !p.ws)) rooms.delete(room.code); }, 600000); timer.unref();
      }
    });
  });
  return { server, close: () => new Promise((resolve,reject) => { closing=true;clearInterval(heartbeat);for(const pending of takeoverTimers.values())clearTimeout(pending.handle);takeoverTimers.clear();for(const timer of turnTimers.values())clearTurnTimeout(timer.handle);turnTimers.clear();for(const timer of botTimers.values())clearTimeout(timer);botTimers.clear();for(const timer of botTradeTimers.values())clearTimeout(timer.handle);botTradeTimers.clear();for (const ws of clients){detachPreview(ws);ws.terminate();} wss.close(() => server.close(()=>{try{store.close();resolve();}catch(error){reject(error);}})); }) };
}
if (require.main === module) {
  const saveFile=process.env.SETTLERS_SAVE_FILE==='off'?undefined:process.env.SETTLERS_SAVE_FILE||path.join(__dirname,'data','prototype.json');
  const app = createApp({saveFile});
  let stopping=false;const stop=()=>{if(stopping)return;stopping=true;app.close().then(()=>process.exit(0));};process.on('SIGINT',stop);process.on('SIGTERM',stop);
  const port = Number(process.env.PORT || 3000);
  app.server.listen(port, '127.0.0.1', () => console.log(`Private Settlers: http://localhost:${app.server.address().port}`));
}
module.exports = { createApp };
