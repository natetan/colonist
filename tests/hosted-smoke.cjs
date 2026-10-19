// Explicitly targets a deployed server; creates and removes its own test room.
const assert=require('assert/strict'),https=require('https');
const {WebSocket}=require('ws');
const origin=process.argv[2];
if(!origin||new URL(origin).origin!==origin||!origin.startsWith('https://'))throw Error('Pass the exact HTTPS origin');
function get(route){return new Promise((resolve,reject)=>{const req=https.get(origin+route,res=>{let bytes=0;res.on('data',b=>bytes+=b.length);res.on('end',()=>resolve({status:res.statusCode,bytes}));});req.setTimeout(15000,()=>req.destroy(Error('HTTP timeout')));req.on('error',reject);});}
function client(){
 const ws=new WebSocket(origin.replace('https:','wss:')+'/socket',{origin}),queue=[],waiting=[];
 ws.on('error',()=>{});
 ws.on('message',raw=>{const m=JSON.parse(raw),i=waiting.findIndex(w=>w.type===m.type);if(i<0)queue.push(m);else waiting.splice(i,1)[0].resolve(m);});
 return {ws,send:m=>ws.send(JSON.stringify(m)),next:type=>new Promise((resolve,reject)=>{const i=queue.findIndex(m=>m.type===type);if(i>=0)return resolve(queue.splice(i,1)[0]);const timer=setTimeout(()=>reject(Error('Timeout '+type)),15000);waiting.push({type,resolve:m=>{clearTimeout(timer);resolve(m);}});})};
}
(async()=>{
 for(const route of ['/','/healthz','/lab.js','/factories.js','/sprites.css','/development-cards.json','/audio/dice-roll-sound.mp3']){const r=await get(route);assert.equal(r.status,200,route);assert(r.bytes>0);}
 const clients=[];
 try{
  for(let i=0;i<2;i++){
   const c=client();clients.push(c);await c.next('SessionEstablished');c.send(i?{type:'JoinRoom',name:'Deployment QA guest',code:clients[0].session.code}:{type:'CreateRoom',name:'Deployment QA host'});c.session=await c.next('Joined');for(const p of clients)await p.next('RoomState');
  }
  const all=()=>Promise.all(clients.map(c=>c.next('RoomState')));
  clients[0].send({type:'SetTurnTimer',seconds:0});await all();
  clients[0].send({type:'StartGame'});let states=await all();
  while(['settlement','road'].includes(states[0].game.phase)){
   const g=states[0].game,c=clients.find(c=>c.session.playerId===g.currentPlayer);
   c.send({type:g.phase==='settlement'?'PlaceSettlement':'PlaceRoad',id:(g.phase==='settlement'?g.legalVertices:g.legalEdges)[0]});states=await all();
  }
  while(states[0].game.phase==='complete')states=await all();
  assert.equal(states[0].game.phase,'roll');
  assert(states.every((s,i)=>s.game.resources&&s.players.length===2&&s.renderer));
  // Reconnect to the existing seat without exposing its token in output.
  const session=clients[1].session;await new Promise(r=>{clients[1].ws.once('close',r);clients[1].ws.close();});await clients[0].next('RoomState');
  clients[1]=client();await clients[1].next('SessionEstablished');clients[1].send({type:'Resume',code:session.code,token:session.token});assert.equal((await clients[1].next('Joined')).playerId,session.playerId);await all();
  console.log('PASS: public HTTPS assets, secure WebSockets, two-player lobby/setup, renderer state, authenticated seat reconnect');
 }finally{
  // Leave in reverse order so the last human removes the QA room.
  for(const c of [...clients].reverse()){if(c.ws.readyState===WebSocket.OPEN){c.send({type:'LeaveRoom'});await c.next('LeftRoom');c.ws.close();}else c.ws.terminate();}
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
