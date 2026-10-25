const assert=require('assert/strict'),{WebSocket}=require('ws'),{createApp}=require('../server.cjs');
(async()=>{
 const app=createApp({orderRandom:n=>n-1,colorRandom:n=>n-1});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=app.server.address().port;
 function client(){const ws=new WebSocket(`ws://127.0.0.1:${port}/socket`,{origin:`http://localhost:${port}`}),queue=[],waiters=[];ws.on('message',raw=>{const m=JSON.parse(raw),i=waiters.findIndex(w=>w.type===m.type);if(i<0)queue.push(m);else waiters.splice(i,1)[0].resolve(m);});return {send:m=>ws.send(JSON.stringify(m)),next:type=>new Promise((resolve,reject)=>{const i=queue.findIndex(m=>m.type===type);if(i>=0)return resolve(queue.splice(i,1)[0]);const timer=setTimeout(()=>reject(Error('Timeout '+type)),5000);waiters.push({type,resolve:m=>{clearTimeout(timer);resolve(m);}});})};}
 try{
  const host=client();await host.next('SessionEstablished');host.send({type:'CreateRoom',name:'Host'});const joined=await host.next('Joined');await host.next('RoomState');
  for(const type of ['star','crescent','long-island']){host.send({type:'SetMap',mapType:type,mapSize:'jumbo'});assert.match((await host.next('Error')).message,/7–8/);}
  for(const type of ['classic','random','random-plus','random-plus-plus','china']){host.send({type:'SetMap',mapType:type,mapSize:'jumbo'});const s=await host.next('RoomState');assert.equal(s.maxPlayers,8);assert.equal(s.mapSize,'jumbo');assert.equal(s.board.length,type==='china'?90:37);assert.equal(s.rules.pieceSupply,type==='china'?'epic':'expanded');}
  host.send({type:'SetMap',mapType:'classic',mapSize:'jumbo'});await host.next('RoomState');const clients=new Map([[joined.playerId,host]]);
  for(let i=1;i<8;i++){const c=client();await c.next('SessionEstablished');c.send({type:'JoinRoom',name:'Player '+i,code:joined.code});const j=await c.next('Joined');clients.set(j.playerId,c);await c.next('RoomState');await host.next('RoomState');}
  const ninth=client();await ninth.next('SessionEstablished');ninth.send({type:'JoinRoom',name:'Ninth',code:joined.code});assert.match((await ninth.next('Error')).message,/eight players/);
  host.send({type:'SetMap',mapType:'classic',mapSize:'extended'});assert.match((await host.next('Error')).message,/Too many seats/);
  host.send({type:'StartGame'});let state=await host.next('RoomState');assert.equal(state.players.length,8);assert.equal(new Set(Object.values(state.game.colors)).size,8);assert.equal(state.game.turnOrder.length,8);
  while(['settlement','road'].includes(state.game.phase)){
   const g=state.game,c=clients.get(g.currentPlayer);c.send(g.phase==='settlement'?{type:'PlaceSettlement',id:g.legalVertices[0]}:{type:'PlaceRoad',id:g.legalEdges[0]});state=await host.next('RoomState');
  }
  if(state.game.phase==='complete')state=await host.next('RoomState');assert.equal(state.game.phase,'roll');assert.equal(state.game.scoring.target,15);assert.deepEqual(state.game.pieceLimits,{roads:25,settlements:7,cities:6});assert.equal(state.game.development.remaining,43);
  for(const p of state.players)assert.equal(state.game.vertices.filter(v=>v.owner===p.id).length,2);
  console.log('PASS: eight real clients, all supported sizes, incompatible-map rejection, ninth-seat/downgrade protection, unique colors and full setup with Expanded rules');
 }finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
