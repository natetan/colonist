const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {createStore,encode,validate}=require('../persistence.cjs'),rules=require('../game.cjs'),turns=require('../turns.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'settlers-save-test-')),file=path.join(dir,'games.json');
const tiles=[];for(let r=-2;r<=2;r++)for(let q=Math.max(-2,-r-2);q<=Math.min(2,-r+2);q++)tiles.push({q,r,resource:tiles.length===18?'desert':'wood',number:6});
const players=['A','B'].map(id=>({id,name:id,token:(id==='A'?'a':'b').repeat(48),bot:false,ws:{private:'socket'}}));const room={code:'ABC123',board:tiles,players},rooms=new Map([[room.code,room]]);
let store;
try{
 const roster=[{id:'host',name:'Host',bot:false,token:'c'.repeat(48)},...Array.from({length:5},(_,i)=>({id:'offline'+i,name:'Offline',bot:false,token:String(i).repeat(48)})),...Array.from({length:3},(_,i)=>({id:'bot'+i,name:'Bot',bot:true}))];
 validate(encode(new Map([['ABC124',{code:'ABC124',board:tiles,players:roster,game:rules.start(tiles,['host','bot0','bot1','bot2'])}]])));
 store=createStore(file);assert.equal(store.load().size,0);assert.throws(()=>createStore(file),/Another server/);store.save(rooms);assert(!fs.readFileSync(file,'utf8').includes('socket'));
 room.game=rules.start(tiles,['A','B']);const g=room.game;
 while(g.phase!=='complete'){const move=rules.botMove(g,tiles);rules.place(g,tiles,g.order[g.step],move.type,move.id);store.save(rooms);assert.deepEqual(validate(JSON.parse(fs.readFileSync(file,'utf8'))),encode(rooms));}
 turns.begin(g,tiles);store.save(rooms);turns.act(g,tiles,'A',{type:'RollDice'},()=>3);store.save(rooms);
 // Save in the middle of both mandatory multi-step effects.
 g.phase='roll';g.turnNumber=2;g.resources.A.wood=9;g.resources.B.wood=2;g.bank.wood=8;let die=0;turns.act(g,tiles,'A',{type:'RollDice'},()=>++die===1?3:4);assert.equal(g.phase,'discard');store.save(rooms);validate(JSON.parse(fs.readFileSync(file,'utf8')));
 turns.act(g,tiles,'A',{type:'Discard',cards:{wood:4}});assert.equal(g.phase,'robber');store.save(rooms);validate(JSON.parse(fs.readFileSync(file,'utf8')));
 g.phase='roll';g.developmentDeck.splice(g.developmentDeck.indexOf('RoadBuilding'),1);g.developmentHands.A.push({id:++g.nextDevelopmentId,type:'RoadBuilding',boughtTurn:0});turns.act(g,tiles,'A',{type:'PlayDevelopmentCard',cardId:g.nextDevelopmentId});
 assert.equal(g.phase,'free-road');store.save(rooms);validate(JSON.parse(fs.readFileSync(file,'utf8')));turns.act(g,tiles,'A',{type:'PlaceFreeRoad',id:turns.roadLocations(g,'A')[0]});assert.equal(g.freeRoadsRemaining,1);store.save(rooms);validate(JSON.parse(fs.readFileSync(file,'utf8')));
 store.close();store=createStore(file);const restored=store.load().get(room.code);assert.deepEqual(restored.game,g);assert.equal(restored.players[0].token,players[0].token);assert.equal(restored.players[0].ws,null);
 const before=fs.readFileSync(file,'utf8'),rename=fs.renameSync;fs.renameSync=()=>{throw new Error('simulated disk failure');};try{assert.throws(()=>store.save(rooms),/simulated/);}finally{fs.renameSync=rename;}assert.equal(fs.readFileSync(file,'utf8'),before);assert(!fs.readdirSync(dir).some(f=>f.endsWith('.tmp')));assert.equal(fs.readFileSync(file+'.bak','utf8'),before);
 const broken=JSON.parse(before);broken.rooms[0].game.bank.wood++;assert.throws(()=>validate(broken),/Invalid/);broken.version=999;assert.throws(()=>validate(broken),/Invalid/);
 store.close();fs.writeFileSync(file,'{"version":999,"rooms":[]}');assert.throws(()=>createStore(file).load(),/Unable to load/);assert.equal(fs.readFileSync(file,'utf8'),'{"version":999,"rooms":[]}');assert(!fs.existsSync(file+'.lock'));
 const pid=2147483647;fs.writeFileSync(file+'.lock',JSON.stringify({pid,id:'stale'}));fs.writeFileSync(file,before);store=createStore(file);assert.equal(store.load().size,1);store.close();
 console.log('PASS: all setup phases and regular-state round trips, socket omission/token preservation, save locking/stale recovery, failed replacement preserves prior save, backup/temp cleanup, incompatible/corrupt-state refusal');
}finally{store?.close();fs.rmSync(dir,{recursive:true,force:true});}
