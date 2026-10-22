const fs=require('fs'),path=require('path'),crypto=require('crypto');
const rules=require('./game.cjs'),development=require('./development.cjs'),{resources}=require('./trading.cjs');
function check(ok){if(!ok)throw new Error('Invalid or incompatible saved-game file; preserve it and restore a valid backup.');}
const integer=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isInteger(n)&&n>=min&&n<=max;
function validate(data){
  check(data&&data.version===1&&Array.isArray(data.rooms));const codes=new Set();
  for(const room of data.rooms){
    check(room&&/^[A-F0-9]{6}$/.test(room.code)&&!codes.has(room.code));codes.add(room.code);
    check(room.turnSeconds===undefined||require('./turn-timer.cjs').choices.includes(room.turnSeconds));
    check(room.mapType===undefined||require('./board.cjs').mapTypes.includes(room.mapType));
    check(Array.isArray(room.players)&&room.players.length>0&&room.players.length<=11);
    const ids=new Set();for(const p of room.players){check(p&&typeof p.id==='string'&&p.id.length>0&&!ids.has(p.id)&&typeof p.name==='string'&&p.name.length>0&&p.name.length<=24&&typeof p.bot==='boolean'&&(p.autopilot===undefined||typeof p.autopilot==='boolean'&&!p.bot)&&(p.bot||typeof p.token==='string'&&/^[a-f0-9]{48}$/.test(p.token)));ids.add(p.id);}
    check((room.hostId?room.players.some(p=>p.id===room.hostId&&!p.bot):!room.players[0].bot)&&room.players.filter(p=>!p.bot).length<=6&&room.players.filter(p=>p.bot).length<=5);
    check(Array.isArray(room.board)&&[19,30,90].includes(room.board.length));
    check(room.board.length!==90||room.mapType==='china');
    const extended=room.board.length>=30,supply=room.board.length===90?72:extended?24:19,deckCounts=extended?development.extendedCounts:development.counts;
    const boards=require('./board.cjs'),legacyLayout=room.mapType==='star'?boards.legacyStarLayout:room.mapType==='china'?boards.legacyChinaLayout:null;
    const previousChina=room.mapType==='china'&&room.board.length===30?boards.previousChinaLayout():null;
    const oldLocations=previousChina&&room.board.every(t=>previousChina.some(p=>p.q===t.q&&p.r===t.r))?previousChina:legacyLayout?.(extended);
    const legacy=oldLocations?new Set(oldLocations.map(t=>t.q+','+t.r)):null;
    const expectedLocations=legacy&&room.board.every(t=>legacy.has(t.q+','+t.r))?legacy:new Set((['random-plus','random-plus-plus'].includes(room.mapType)?room.board:boards.shapeLayout(room.mapType||'random',extended)).map(t=>t.q+','+t.r)),locations=new Set();
    for(const t of room.board){check(t&&Number.isInteger(t.q)&&Number.isInteger(t.r)&&expectedLocations.has(t.q+','+t.r)&&[...resources,'desert'].includes(t.resource)&&(t.resource==='desert'?t.number===null||integer(t.number,2,12):integer(t.number,2,12)&&t.number!==7));locations.add(t.q+','+t.r);}check(locations.size===room.board.length&&room.board.filter(t=>t.resource==='desert').length===(room.board.length===90?6:extended?2:1));
    if(['random-plus','random-plus-plus'].includes(room.mapType)){check(room.board.every(t=>Math.abs(t.q)<=8&&Math.abs(t.r)<=8));if(room.mapType==='random-plus')check(boards.compact(room.board));boards.coastline(room.board);}
    if(room.harbors!==undefined){
      const coast=require('./board.cjs').coastline(room.board),ends=new Set();check(Array.isArray(room.harbors)&&room.harbors.length===(extended?11:9));
      for(const h of room.harbors){check(h&&coast.includes(h.edge)&&(h.resource===null||resources.includes(h.resource)));const e=rules.topology(room.board).edges[h.edge];check(!ends.has(e.a)&&!ends.has(e.b));ends.add(e.a);ends.add(e.b);}
      check(room.harbors.filter(h=>h.resource===null).length===(extended?5:4)&&resources.every(r=>room.harbors.filter(h=>h.resource===r).length===(extended&&r==='sheep'?2:1)));
    }
    const g=room.game;if(!g)continue;
    if(g.lastTheft)check(integer(g.lastTheft.sequence,1)&&ids.has(g.lastTheft.thief)&&ids.has(g.lastTheft.victim)&&g.lastTheft.thief!==g.lastTheft.victim);
    if(g.turnTimer)check(typeof g.turnTimer.key==='string'&&integer(g.turnTimer.deadline,1));
    if(g.lastTimeout)check(ids.has(g.lastTimeout.player)&&typeof g.lastTimeout.setup==='boolean'&&integer(g.lastTimeout.sequence,1));
    if(room.harbors!==undefined)check(JSON.stringify(g.harbors)===JSON.stringify(room.harbors));
    check(Array.isArray(g.players)&&g.players.length>0&&g.players.length<=6&&new Set(g.players).size===g.players.length&&g.players.every(id=>ids.has(id))&&g.colors&&g.players.every(id=>typeof g.colors[id]==='string'));
    const geometry=rules.topology(room.board);check(Array.isArray(g.vertices)&&g.vertices.length===geometry.vertices.length&&Array.isArray(g.edges)&&g.edges.length===geometry.edges.length);
    const owner=id=>id===null||g.players.includes(id);
    for(const [i,v]of g.vertices.entries()){const expected=geometry.vertices[i];check(v&&v.id===i&&v.x===expected.x&&v.y===expected.y&&JSON.stringify(v.tiles)===JSON.stringify(expected.tiles)&&owner(v.owner)&&(v.city===undefined||typeof v.city==='boolean'));}
    for(const [i,e]of g.edges.entries())check(e&&e.id===i&&e.a===geometry.edges[i].a&&e.b===geometry.edges[i].b&&owner(e.owner));
    check(JSON.stringify(g.order)===JSON.stringify([...g.players,...g.players.slice().reverse()])&&integer(g.step,0,g.order.length));
    check(['settlement','road','complete','roll','build','discard','robber','steal','free-road','finished'].includes(g.phase));
    check(g.resources&&g.players.every(id=>g.resources[id]&&resources.every(r=>integer(g.resources[id][r],0,supply))));
    if(g.turn===undefined){check(['settlement','road','complete'].includes(g.phase)&&(g.phase==='complete'?g.step===g.order.length:g.step<g.order.length));check(g.phase!=='road'||integer(g.pendingVertex,0,g.vertices.length-1));continue;}
    check((g.resourceSupply??19)===supply);
    check(g.step===g.order.length&&!['settlement','road','complete'].includes(g.phase));
    check(integer(g.turn,0,g.players.length-1)&&integer(g.turnNumber)&&integer(g.robber,0,room.board.length-1)&&g.bank&&resources.every(r=>integer(g.bank[r],0,supply)&&g.bank[r]+g.players.reduce((n,id)=>n+g.resources[id][r],0)===supply));
    check(g.dice===null||Array.isArray(g.dice)&&g.dice.length===2&&g.dice.every(n=>integer(n,1,6)));
    check(g.discards&&Object.entries(g.discards).every(([id,n])=>g.players.includes(id)&&integer(n,1,Math.floor(supply*5/2)))&&Array.isArray(g.victims)&&g.victims.every(id=>g.players.includes(id)));
    check(Array.isArray(g.developmentDeck)&&Array.isArray(g.developmentDiscard)&&g.developmentHands&&g.knightsPlayed&&integer(g.nextDevelopmentId)&&typeof g.developmentPlayed==='boolean'&&integer(g.freeRoadsRemaining,0,2));
    check(g.developmentReturnPhase===undefined||['roll','build'].includes(g.developmentReturnPhase)&&['robber','steal','free-road'].includes(g.phase));
    check(g.phase!=='free-road'||g.freeRoadsRemaining>0&&g.developmentReturnPhase!==undefined);
    const all=[...g.developmentDeck,...g.developmentDiscard],cardIds=new Set();
    for(const id of g.players){check(Array.isArray(g.developmentHands[id])&&integer(g.knightsPlayed[id],0,deckCounts.Knight));for(const c of g.developmentHands[id]){check(c&&integer(c.id,1,g.nextDevelopmentId)&&!cardIds.has(c.id)&&integer(c.boughtTurn,0,g.turnNumber));cardIds.add(c.id);all.push(c.type);}}
    check(all.length===Object.values(deckCounts).reduce((a,b)=>a+b,0)&&Object.entries(deckCounts).every(([type,count])=>all.filter(t=>t===type).length===count));
    check(g.players.reduce((n,id)=>n+g.knightsPlayed[id],0)===g.developmentDiscard.filter(t=>t==='Knight').length);
    if(g.tradeOffer){const t=g.tradeOffer;check(integer(t.id,1,g.tradeSequence)&&g.players.includes(t.from)&&(t.to===null||g.players.includes(t.to))&&t.from!==t.to&&g.phase==='build');if(t.to===null||t.recipients!==undefined){check(Array.isArray(t.recipients)&&t.recipients.length>0&&new Set(t.recipients).size===t.recipients.length&&t.recipients.every(id=>g.players.includes(id)&&id!==t.from));check(t.responses&&Object.keys(t.responses).length===t.recipients.length&&Object.entries(t.responses).every(([id,value])=>t.recipients.includes(id)&&['pending','accepted','declined'].includes(value)));}for(const h of [t.give,t.receive])check(h&&Object.keys(h).length>0&&Object.entries(h).every(([r,n])=>resources.includes(r)&&integer(n,1,supply)));}
    check(!g.winner||g.phase==='finished'&&g.players.includes(g.winner)&&integer(g.winningPoints,10,20)&&integer(g.revealedVictoryPoints,0,5));check(g.phase!=='finished'||!!g.winner);
  }
  return data;
}
function encode(rooms){return {version:1,rooms:[...rooms.values()].map(room=>({code:room.code,board:room.board,...(room.turnSeconds!==undefined?{turnSeconds:room.turnSeconds}:{}),...(room.hostId?{hostId:room.hostId}:{}),...(room.mapType?{mapType:room.mapType}:{}),...(room.harbors!==undefined?{harbors:room.harbors}:{}),game:room.game||null,players:room.players.map(p=>({id:p.id,name:p.name,bot:!!p.bot,...(p.autopilot?{autopilot:true}:{}),...(!p.bot?{token:p.token}:{})}))}))};}
function createStore(file){
  if(!file)return {load:()=>new Map(),save:()=>{},close:()=>{}};
  file=path.resolve(file);fs.mkdirSync(path.dirname(file),{recursive:true});const lock=file+'.lock';
  try{const previous=JSON.parse(fs.readFileSync(lock,'utf8'));check(integer(previous.pid,1));try{process.kill(previous.pid,0);throw new Error('Another server owns this saved-game file. Choose a different SETTLERS_SAVE_FILE.');}catch(error){if(error.code!=='ESRCH')throw error;}fs.unlinkSync(lock);}catch(error){if(error.code!=='ENOENT')throw error;}
  const lockId=crypto.randomUUID();fs.writeFileSync(lock,JSON.stringify({pid:process.pid,id:lockId}),{flag:'wx',mode:0o600});let closed=false;
  function close(){if(closed)return;closed=true;const current=JSON.parse(fs.readFileSync(lock,'utf8'));if(current.id===lockId)fs.unlinkSync(lock);}
  function load(){
    try{const data=validate(JSON.parse(fs.readFileSync(file,'utf8')));return new Map(data.rooms.map(room=>[room.code,{...room,players:room.players.map(p=>({...p,ws:null}))}]));}
    catch(error){if(error.code==='ENOENT')return new Map();close();throw new Error('Unable to load saved games: '+error.message);}
  }
  function save(rooms){
    if(closed)throw new Error('Saved-game store is closed.');
    const text=JSON.stringify(encode(rooms));const temp=file+'.'+lockId+'.tmp';let fd;
    try{fd=fs.openSync(temp,'w',0o600);fs.writeFileSync(fd,text,'utf8');fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;if(fs.existsSync(file))fs.copyFileSync(file,file+'.bak');fs.renameSync(temp,file);}
    finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(temp))fs.unlinkSync(temp);}
  }
  return {load,save,close};
}
module.exports={createStore,encode,validate};
