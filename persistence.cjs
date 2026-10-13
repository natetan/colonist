const fs=require('fs'),path=require('path'),crypto=require('crypto');
const rules=require('./game.cjs'),development=require('./development.cjs'),{resources}=require('./trading.cjs');
function check(ok){if(!ok)throw new Error('Invalid or incompatible saved-game file; preserve it and restore a valid backup.');}
const integer=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isInteger(n)&&n>=min&&n<=max;
function validate(data){
  check(data&&data.version===1&&Array.isArray(data.rooms));const codes=new Set();
  for(const room of data.rooms){
    check(room&&/^[A-F0-9]{6}$/.test(room.code)&&!codes.has(room.code));codes.add(room.code);
    check(Array.isArray(room.players)&&room.players.length>0&&room.players.length<=9);
    const ids=new Set();for(const p of room.players){check(p&&typeof p.id==='string'&&p.id.length>0&&!ids.has(p.id)&&typeof p.name==='string'&&p.name.length>0&&p.name.length<=24&&typeof p.bot==='boolean'&&(p.bot||typeof p.token==='string'&&/^[a-f0-9]{48}$/.test(p.token)));ids.add(p.id);}
    check(!room.players[0].bot&&room.players.filter(p=>!p.bot).length<=6&&room.players.filter(p=>p.bot).length<=3);
    check(Array.isArray(room.board)&&room.board.length===19);
    const locations=new Set();for(const t of room.board){check(t&&integer(t.q,-2,2)&&integer(t.r,-2,2)&&Math.abs(t.q+t.r)<=2&&[...resources,'desert'].includes(t.resource)&&(t.resource==='desert'?t.number===null||integer(t.number,2,12):integer(t.number,2,12)&&t.number!==7));locations.add(`${t.q},${t.r}`);}check(locations.size===19&&room.board.filter(t=>t.resource==='desert').length===1);
    if(room.harbors!==undefined){
      const coast=require('./board.cjs').coastline(room.board),ends=new Set();check(Array.isArray(room.harbors)&&room.harbors.length===9);
      for(const h of room.harbors){check(h&&coast.includes(h.edge)&&(h.resource===null||resources.includes(h.resource)));const e=rules.topology(room.board).edges[h.edge];check(!ends.has(e.a)&&!ends.has(e.b));ends.add(e.a);ends.add(e.b);}
      check(room.harbors.filter(h=>h.resource===null).length===4&&resources.every(r=>room.harbors.filter(h=>h.resource===r).length===1));
    }
    const g=room.game;if(!g)continue;
    if(room.harbors!==undefined)check(JSON.stringify(g.harbors)===JSON.stringify(room.harbors));
    check(Array.isArray(g.players)&&g.players.length>0&&g.players.length<=6&&new Set(g.players).size===g.players.length&&g.players.every(id=>ids.has(id))&&g.colors&&g.players.every(id=>typeof g.colors[id]==='string'));
    const geometry=rules.topology(room.board);check(Array.isArray(g.vertices)&&g.vertices.length===geometry.vertices.length&&Array.isArray(g.edges)&&g.edges.length===geometry.edges.length);
    const owner=id=>id===null||g.players.includes(id);
    for(const [i,v]of g.vertices.entries()){const expected=geometry.vertices[i];check(v&&v.id===i&&v.x===expected.x&&v.y===expected.y&&JSON.stringify(v.tiles)===JSON.stringify(expected.tiles)&&owner(v.owner)&&(v.city===undefined||typeof v.city==='boolean'));}
    for(const [i,e]of g.edges.entries())check(e&&e.id===i&&e.a===geometry.edges[i].a&&e.b===geometry.edges[i].b&&owner(e.owner));
    check(JSON.stringify(g.order)===JSON.stringify([...g.players,...g.players.slice().reverse()])&&integer(g.step,0,g.order.length));
    check(['settlement','road','complete','roll','build','discard','robber','steal','free-road','finished'].includes(g.phase));
    check(g.resources&&g.players.every(id=>g.resources[id]&&resources.every(r=>integer(g.resources[id][r],0,19))));
    if(g.turn===undefined){check(['settlement','road','complete'].includes(g.phase)&&(g.phase==='complete'?g.step===g.order.length:g.step<g.order.length));check(g.phase!=='road'||integer(g.pendingVertex,0,g.vertices.length-1));continue;}
    check(g.step===g.order.length&&!['settlement','road','complete'].includes(g.phase));
    check(integer(g.turn,0,g.players.length-1)&&integer(g.turnNumber)&&integer(g.robber,0,18)&&g.bank&&resources.every(r=>integer(g.bank[r],0,19)&&g.bank[r]+g.players.reduce((n,id)=>n+g.resources[id][r],0)===19));
    check(g.dice===null||Array.isArray(g.dice)&&g.dice.length===2&&g.dice.every(n=>integer(n,1,6)));
    check(g.discards&&Object.entries(g.discards).every(([id,n])=>g.players.includes(id)&&integer(n,1,47))&&Array.isArray(g.victims)&&g.victims.every(id=>g.players.includes(id)));
    check(Array.isArray(g.developmentDeck)&&Array.isArray(g.developmentDiscard)&&g.developmentHands&&g.knightsPlayed&&integer(g.nextDevelopmentId)&&typeof g.developmentPlayed==='boolean'&&integer(g.freeRoadsRemaining,0,2));
    check(g.developmentReturnPhase===undefined||['roll','build'].includes(g.developmentReturnPhase)&&['robber','steal','free-road'].includes(g.phase));
    check(g.phase!=='free-road'||g.freeRoadsRemaining>0&&g.developmentReturnPhase!==undefined);
    const all=[...g.developmentDeck,...g.developmentDiscard],cardIds=new Set();
    for(const id of g.players){check(Array.isArray(g.developmentHands[id])&&integer(g.knightsPlayed[id],0,14));for(const c of g.developmentHands[id]){check(c&&integer(c.id,1,g.nextDevelopmentId)&&!cardIds.has(c.id)&&integer(c.boughtTurn,0,g.turnNumber));cardIds.add(c.id);all.push(c.type);}}
    check(all.length===25&&Object.entries(development.counts).every(([type,count])=>all.filter(t=>t===type).length===count));
    check(g.players.reduce((n,id)=>n+g.knightsPlayed[id],0)===g.developmentDiscard.filter(t=>t==='Knight').length);
    if(g.tradeOffer){const t=g.tradeOffer;check(integer(t.id,1,g.tradeSequence)&&g.players.includes(t.from)&&g.players.includes(t.to)&&t.from!==t.to&&g.phase==='build');for(const h of [t.give,t.receive])check(h&&Object.keys(h).length>0&&Object.entries(h).every(([r,n])=>resources.includes(r)&&integer(n,1,19)));}
    check(!g.winner||g.phase==='finished'&&g.players.includes(g.winner)&&integer(g.winningPoints,10,20)&&integer(g.revealedVictoryPoints,0,5));check(g.phase!=='finished'||!!g.winner);
  }
  return data;
}
function encode(rooms){return {version:1,rooms:[...rooms.values()].map(room=>({code:room.code,board:room.board,...(room.harbors!==undefined?{harbors:room.harbors}:{}),game:room.game||null,players:room.players.map(p=>({id:p.id,name:p.name,bot:!!p.bot,...(!p.bot?{token:p.token}:{})}))}))};}
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
