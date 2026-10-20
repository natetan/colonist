const assert=require('assert/strict'),{WebSocket}=require('ws'),{createApp}=require('../server.cjs'),boards=require('../board.cjs');
assert.deepEqual(boards.classic(),boards.classic());
(async()=>{
 const app=createApp({orderRandom:n=>n-1});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const port=app.server.address().port;
 function client(){const ws=new WebSocket(`ws://127.0.0.1:${port}/socket`,{origin:`http://localhost:${port}`}),queue=[],waiting=[];
  ws.on('message',raw=>{const m=JSON.parse(raw),i=waiting.findIndex(w=>w.type===m.type);if(i<0)queue.push(m);else waiting.splice(i,1)[0].resolve(m);});
  return {send:m=>ws.send(JSON.stringify(m)),next:type=>new Promise((resolve,reject)=>{const i=queue.findIndex(m=>m.type===type);if(i>=0)return resolve(queue.splice(i,1)[0]);const timer=setTimeout(()=>reject(Error('Timeout '+type)),4000);waiting.push({type,resolve:m=>{clearTimeout(timer);resolve(m);}});})};
 }
 try{
  const host=client();await host.next('SessionEstablished');host.send({type:'CreateRoom',name:'Host'});const joined=await host.next('Joined'),initial=await host.next('RoomState');assert.equal(initial.mapType,'classic');assert.deepEqual(initial.board,boards.classic().board);
  const guest=client();await guest.next('SessionEstablished');guest.send({type:'JoinRoom',name:'Guest',code:joined.code});await guest.next('Joined');await host.next('RoomState');await guest.next('RoomState');
  guest.send({type:'SetMap',mapType:'random'});assert.match((await guest.next('Error')).message,/Only the host/);
  host.send({type:'SetMap',mapType:'invalid'});assert.match((await host.next('Error')).message,/Choose Classic/);
  async function select(type,mapSize='standard'){host.send({type:'SetMap',mapType:type,mapSize});const a=await host.next('RoomState'),b=await guest.next('RoomState');assert.equal(a.mapType,type);assert.deepEqual(a.board,b.board);assert.deepEqual(a.harbors,b.harbors);return a;}
  const first=await select('random'),second=await select('random');assert.notDeepEqual(first.board,second.board);
  for(const board of [first.board,second.board]){assert.deepEqual(board.map(t=>t.resource).sort(),[...boards.resourceBag].sort());for(const a of board.filter(t=>[6,8].includes(t.number)))for(const b of board.filter(t=>[6,8].includes(t.number)&&t!==a))assert(!boards.adjacent(a,b));}
  for(const type of ['star','crescent','long-island','china']){const shaped=await select(type);assert.deepEqual(shaped.board.map(t=>[t.q,t.r]),boards.shapeLayout(type).map(t=>[t.q,t.r]));const regenerated=await select(type);assert.notDeepEqual(regenerated.board,shaped.board);}
  const irregular=await select('random-plus');assert(boards.compact(irregular.board));const fresh=await select('random-plus');assert.notDeepEqual(fresh.board,irregular.board);
  for(const size of ['standard','extended']){const wild=await select('random-plus-plus',size);assert.equal(wild.board.length,size==='extended'?30:19);assert.equal(boards.coastline(wild.board).length>0,true);const fresh=await select('random-plus-plus',size);assert.notDeepEqual(fresh.board,wild.board);}
  const classic=await select('classic');assert.deepEqual(classic.board,initial.board);assert.deepEqual(classic.harbors,initial.harbors);
  const {encode,validate}=require('../persistence.cjs');const room={code:joined.code,mapType:'classic',board:classic.board,harbors:classic.harbors,players:[{id:joined.playerId,name:'Host',token:joined.token,bot:false}]};assert.equal(validate(encode(new Map([[room.code,room]]))).rooms[0].mapType,'classic');
  const extra=[];for(let i=0;i<2;i++){const c=client();extra.push(c);await c.next('SessionEstablished');c.send({type:'JoinRoom',name:'Extra '+i,code:joined.code});await c.next('Joined');await host.next('RoomState');await guest.next('RoomState');for(const p of extra)await p.next('RoomState');}
  const fifth=client();await fifth.next('SessionEstablished');fifth.send({type:'JoinRoom',name:'Fifth',code:joined.code});assert.match((await fifth.next('Error')).message,/four players/);
  host.send({type:'StartGame'});const started=await host.next('RoomState');assert.deepEqual(started.board,classic.board);assert.equal(started.game.players,undefined);host.send({type:'SetMap',mapType:'random'});assert.match((await host.next('Error')).message,/locked/);
  host.send({type:'LeaveRoom'});await host.next('LeftRoom');let takeover;do{takeover=await guest.next('RoomState');}while(takeover.host===joined.playerId);assert.equal(takeover.host,takeover.players.find(p=>p.name==='Guest').id);assert.equal(takeover.players.find(p=>p.id===joined.playerId).bot,true);assert.deepEqual(takeover.players.map(p=>p.id),started.players.map(p=>p.id),'Seat order and piece colors stay stable');
  host.send({type:'Resume',code:joined.code,token:joined.token});assert.match((await host.next('Error')).message,/unavailable/);
  for(const c of extra){c.send({type:'LeaveRoom'});await c.next('LeftRoom');}guest.send({type:'LeaveRoom'});await guest.next('LeftRoom');
  fifth.send({type:'JoinRoom',code:joined.code,name:'Late'});assert.match((await fifth.next('Error')).message,/Room not found/);
  host.send({type:'CreateRoom',name:'New table'});await host.next('Joined');await host.next('RoomState');host.send({type:'LeaveRoom'});await host.next('LeftRoom');
  console.log('PASS: quit acknowledgement, host transfer, bot takeover, stable seat colors, token revocation, last-human cleanup and new-room creation');
  console.log('PASS: fixed Classic, randomized constrained maps, shared previews, host-only changes, persistence metadata, four-seat cap and match lock');
 }finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
