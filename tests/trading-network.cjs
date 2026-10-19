const assert=require('assert/strict'),{WebSocket}=require('ws');
const {createApp}=require('../server.cjs');
const tiles=[];for(let r=-2;r<=2;r++)for(let q=Math.max(-2,-r-2);q<=Math.min(2,-r+2);q++)tiles.push({q,r,resource:tiles.length===18?'desert':['wood','brick','sheep','wheat','ore'][tiles.length%5],number:6});
async function run(){
  const app=createApp({orderRandom:n=>n-1,random:()=>3,boardFactory:()=>tiles});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const port=app.server.address().port;
  function client(){const ws=new WebSocket(`ws://127.0.0.1:${port}/socket`,{origin:`http://localhost:${port}`}),queue=[],waiters=[];ws.on('message',bytes=>{const m=JSON.parse(bytes),i=waiters.findIndex(w=>w.type===m.type);if(i<0)queue.push(m);else waiters.splice(i,1)[0].resolve(m);});return{ws,send:m=>ws.send(JSON.stringify(m)),next:type=>new Promise((resolve,reject)=>{const i=queue.findIndex(m=>m.type===type);if(i>=0)return resolve(queue.splice(i,1)[0]);const timer=setTimeout(()=>reject(new Error('Timed out '+type)),3000);waiters.push({type,resolve:m=>{clearTimeout(timer);resolve(m);}});})};}
  try{
    const a=client(),b=client();await a.next('SessionEstablished');await b.next('SessionEstablished');a.send({type:'CreateRoom',name:'A'});const ja=await a.next('Joined');await a.next('RoomState');b.send({type:'JoinRoom',name:'B',code:ja.code});const jb=await b.next('Joined');await a.next('RoomState');await b.next('RoomState');
    a.send({type:'StartGame'});let sa=await a.next('RoomState'),sb=await b.next('RoomState');
    const replayA=[],replayB=[];
    async function both(){sa=await a.next('RoomState');sb=await b.next('RoomState');assert.deepEqual(sa.game.tradeOffer,sb.game.tradeOffer);assert(!JSON.stringify(sb).includes(ja.token));if(process.env.SETTLERS_RECORD_QA){replayA.push(sa);replayB.push(sb);}}
    while(['settlement','road'].includes(sa.game.phase)){const c=sa.game.currentPlayer===ja.playerId?a:b;c.send({type:sa.game.phase==='settlement'?'PlaceSettlement':'PlaceRoad',id:(sa.game.phase==='settlement'?sa.game.legalVertices:sa.game.legalEdges)[0]});await both();}
    while(sa.game.phase!=='roll')await both();
    a.send({type:'RollDice'});await both();
    let give=Object.keys(sa.game.resources).find(r=>sa.game.resources[r]>0&&Object.keys(sb.game.resources).some(s=>s!==r&&sb.game.resources[s]>0));assert(give);
    const receive=Object.keys(sb.game.resources).find(r=>r!==give&&sb.game.resources[r]>0);
    const offerMessage={type:'OfferTrade',player:jb.playerId,give:{[give]:1},receive:{[receive]:1}};
    a.send(offerMessage);await both();const offer=sa.game.tradeOffer,bank={...sa.game.bank},handA={...sa.game.resources},handB={...sb.game.resources};assert(sb.game.canAcceptTrade);assert(!sa.game.canAcceptTrade);
    assert.equal(sa.game.resources[give],handA[give]);assert.deepEqual(Object.keys(sb.game.resources).sort(),['brick','ore','sheep','wheat','wood']);
    b.send({type:'DeclineTrade',offerId:offer.id});await both();assert.equal(sa.game.tradeDecline.declinedBy,jb.playerId);assert.deepEqual(sa.game.tradeDecline,sb.game.tradeDecline);
    a.send(offerMessage);await both();assert.equal(sa.game.tradeDecline,null);offer.id=sa.game.tradeOffer.id;
    b.send({type:'AcceptTrade',offerId:offer.id});await both();assert.equal(sa.game.tradeOffer.responses[jb.playerId],'accepted');assert.deepEqual(sa.game.resources,handA);assert.deepEqual(sb.game.resources,handB);a.send({type:'ConfirmTrade',offerId:offer.id,player:jb.playerId});await both();assert.equal(sa.game.tradeOffer,null);assert.equal(sa.game.resources[give],handA[give]-1);assert.equal(sa.game.resources[receive],handA[receive]+1);assert.equal(sb.game.resources[give],handB[give]+1);assert.equal(sb.game.resources[receive],handB[receive]-1);assert.deepEqual(sa.game.bank,bank);
    b.send({type:'AcceptTrade',offerId:offer.id});assert.match((await b.next('Error')).message,/no longer/);
    // Alternate real turns until a 4:1 bank trade is affordable.
    for(let i=0;!Object.values(sa.game.resources).some(n=>n>=4)&&i<5;i++){
      a.send({type:'EndTurn'});await both();b.send({type:'RollDice'});await both();b.send({type:'EndTurn'});await both();a.send({type:'RollDice'});await both();
    }
    give=Object.keys(sa.game.resources).find(r=>sa.game.resources[r]>=4);assert(give);const wanted=Object.keys(sa.game.bank).find(r=>r!==give&&sa.game.bank[r]>0);assert(wanted);
    const cost=sa.game.bankRates[give],bankBefore={...sa.game.bank},aBefore={...sa.game.resources};a.send({type:'BankTrade',give,receive:wanted});await both();assert.equal(sa.game.resources[give],aBefore[give]-cost);assert.equal(sa.game.resources[wanted],aBefore[wanted]+1);assert.equal(sa.game.bank[give],bankBefore[give]+cost);assert.equal(sa.game.bank[wanted],bankBefore[wanted]-1);
    b.send({type:'BankTrade',give,receive:wanted});assert.match((await b.next('Error')).message,/another player/);
    a.send({type:'OfferTrade',player:jb.playerId,give:{[wanted]:1},receive:{[give]:1}});await both();const stale=sa.game.tradeOffer.id;
    a.send({type:'EndTurn'});await both();assert.equal(sb.game.tradeOffer,null);b.send({type:'AcceptTrade',offerId:stale});assert.match((await b.next('Error')).message,/Trade only/);
    if(process.env.SETTLERS_RECORD_QA)require('fs').writeFileSync(require('path').resolve(__dirname,'../.rea-tools/trading-qa.json'),JSON.stringify([{viewerId:ja.playerId,states:replayA},{viewerId:jb.playerId,states:replayB}]));
    console.log('PASS: two-human WebSocket offer/consent/final confirmation and redacted snapshots, duplicate rejection, bank exchange, turn enforcement, offer expiry');
  }finally{await app.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
