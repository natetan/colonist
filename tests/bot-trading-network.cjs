const assert=require('assert/strict'),{WebSocket}=require('ws'),{createApp}=require('../server.cjs');
const board=[];for(let r=-2;r<=2;r++)for(let q=Math.max(-2,-r-2);q<=Math.min(2,-r+2);q++)board.push({q,r,resource:board.length===18?'desert':['wood','brick','sheep','wheat','ore'][board.length%5],number:6});
(async()=>{
 const app=createApp({random:()=>3,boardFactory:()=>board,botDelayMs:10});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const port=app.server.address().port,ws=new WebSocket(`ws://127.0.0.1:${port}/socket`,{origin:`http://localhost:${port}`}),queue=[],waiting=[];
 ws.on('message',raw=>{const m=JSON.parse(raw),i=waiting.findIndex(w=>w.type===m.type);if(i<0)queue.push(m);else waiting.splice(i,1)[0].resolve(m);});
 const send=m=>ws.send(JSON.stringify(m)),next=type=>new Promise((resolve,reject)=>{const i=queue.findIndex(m=>m.type===type);if(i>=0)return resolve(queue.splice(i,1)[0]);const timeout=setTimeout(()=>reject(Error('Timeout '+type)),4000);waiting.push({type,resolve:m=>{clearTimeout(timeout);resolve(m);}});});
 try{
  await next('SessionEstablished');send({type:'CreateRoom',name:'Human'});const seat=await next('Joined');await next('RoomState');send({type:'StartGame',bots:true});let state=await next('RoomState');
  while(state.game.phase!=='roll'){
   if(state.game.currentPlayer===seat.playerId&&['settlement','road'].includes(state.game.phase))send({type:state.game.phase==='settlement'?'PlaceSettlement':'PlaceRoad',id:(state.game.phase==='settlement'?state.game.legalVertices:state.game.legalEdges)[0]});
   state=await next('RoomState');
  }
  send({type:'RollDice'});state=await next('RoomState');assert.equal(state.game.phase,'build');
  const originalHand={...state.game.resources},deadline=state.game.turnTimer.deadline,bots=state.players.filter(p=>p.bot);assert.equal(bots.length,3);
  const offered=Object.keys(originalHand).find(r=>originalHand[r]>0),requested=Object.keys(originalHand).find(r=>r!==offered);
  async function offer(give,receive){
   send({type:'OfferTrade',player:'all',give:{[give]:1},receive});state=await next('RoomState');assert.equal(state.game.tradeOffer.recipients.length,3);
   while(Object.values(state.game.tradeOffer.responses).includes('pending'))state=await next('RoomState');
   assert.deepEqual(state.game.resources,originalHand);assert.equal(state.game.turnTimer.deadline,deadline);return state.game.tradeOffer;
  }
  const rejected=await offer(offered,{[requested]:19});assert(Object.values(rejected.responses).every(r=>r==='declined'));
  let accepted;
  for(const give of Object.keys(originalHand).filter(r=>originalHand[r]>0)){
   for(const receive of Object.keys(originalHand).filter(r=>r!==give)){
    const candidate=await offer(give,{[receive]:1});const willing=Object.keys(candidate.responses).filter(id=>candidate.responses[id]==='accepted');
    if(willing.length){accepted={candidate,player:willing.at(-1),give,receive};break;}
   }
   if(accepted)break;
  }
  assert(accepted,'At least one fair useful offer should interest a bot');
  assert(state.game.confirmableTradePlayers.includes(accepted.player));send({type:'ConfirmTrade',offerId:accepted.candidate.id,player:accepted.player});state=await next('RoomState');
  assert.equal(state.game.tradeOffer,null);assert.equal(state.game.resources[accepted.give],originalHand[accepted.give]-1);assert.equal(state.game.resources[accepted.receive],originalHand[accepted.receive]+1);assert.equal(state.game.turnTimer.deadline,deadline+20000);
  assert(Object.values(state.game.resources).every(n=>typeof n==='number'),'Only the human hand is exposed');
  console.log('PASS: three bots receive broadcast offers, decline impossible offers, consent to useful trades, wait for owner selection, conserve the private hand and credit only completion');
 }finally{ws.terminate();await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
