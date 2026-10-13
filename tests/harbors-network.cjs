const assert=require('assert/strict'),{WebSocket}=require('ws');
const {createApp}=require('../server.cjs');
const tiles=[];for(let r=-2;r<=2;r++)for(let q=Math.max(-2,-r-2);q<=Math.min(2,-r+2);q++)tiles.push({q,r,resource:tiles.length===18?'desert':['wood','brick','sheep','wheat','ore'][tiles.length%5],number:6});
async function run(){
  const app=createApp({boardRandom:()=>0,random:()=>3,boardFactory:()=>tiles});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const port=app.server.address().port;
  function client(){const ws=new WebSocket(`ws://127.0.0.1:${port}/socket`,{origin:`http://localhost:${port}`}),queue=[],waiters=[];ws.on('message',bytes=>{const m=JSON.parse(bytes),i=waiters.findIndex(w=>w.type===m.type);if(i<0)queue.push(m);else waiters.splice(i,1)[0].resolve(m);});return{ws,send:m=>ws.send(JSON.stringify(m)),next:type=>new Promise((resolve,reject)=>{const i=queue.findIndex(m=>m.type===type);if(i>=0)return resolve(queue.splice(i,1)[0]);const timer=setTimeout(()=>reject(new Error('Timed out '+type)),3000);waiters.push({type,resolve:m=>{clearTimeout(timer);resolve(m);}});})};}
  try{
    const a=client(),b=client();await a.next('SessionEstablished');await b.next('SessionEstablished');a.send({type:'CreateRoom',name:'A'});const ja=await a.next('Joined');await a.next('RoomState');b.send({type:'JoinRoom',name:'B',code:ja.code});const jb=await b.next('Joined');await a.next('RoomState');await b.next('RoomState');
    a.send({type:'StartGame'});let sa=await a.next('RoomState'),sb=await b.next('RoomState');
    async function both(){sa=await a.next('RoomState');sb=await b.next('RoomState');assert.deepEqual(sa.game.tradeOffer,sb.game.tradeOffer);assert(!JSON.stringify(sb).includes(ja.token));}
    let aSettlements=0;
    while(['settlement','road'].includes(sa.game.phase)){
      const mine=sa.game.currentPlayer===ja.playerId,c=mine?a:b;let id=(sa.game.phase==='settlement'?sa.game.legalVertices:sa.game.legalEdges)[0];
      if(mine&&sa.game.phase==='settlement'){
        const candidates=sa.harbors.filter(h=>aSettlements===0?h.resource==='wood':h.resource===null).flatMap(h=>{const e=sa.game.edges[h.edge];return[e.a,e.b];}).filter(v=>sa.game.legalVertices.includes(v));assert(candidates.length);id=candidates[0];aSettlements++;
      }
      c.send({type:sa.game.phase==='settlement'?'PlaceSettlement':'PlaceRoad',id});await both();
    }
    while(sa.game.phase!=='roll')await both();
    a.send({type:'RollDice'});await both();
    assert.equal(sa.harbors.length,9);assert.equal(sa.game.bankRates.wood,2);assert.equal(sa.game.bankRates.ore,3);assert(Object.values(sb.game.bankRates).every(n=>n>=2));
    async function bankTrade(give,receive,cost){const hand={...sa.game.resources},bank={...sa.game.bank};a.send({type:'BankTrade',give,receive,rate:1});await both();assert.equal(sa.game.resources[give],hand[give]-cost);assert.equal(sa.game.resources[receive],hand[receive]+1);assert.equal(sa.game.bank[give],bank[give]+cost);assert.equal(sa.game.bank[receive],bank[receive]-1);}
    for(let round=0;sa.game.resources.wood<2&&round<12;round++){
      const give=Object.keys(sa.game.resources).find(r=>r!=='wood'&&sa.game.resources[r]>=sa.game.bankRates[r]&&sa.game.bank.wood>0);if(give)await bankTrade(give,'wood',sa.game.bankRates[give]);
      else{a.send({type:'EndTurn'});await both();b.send({type:'RollDice'});await both();b.send({type:'EndTurn'});await both();a.send({type:'RollDice'});await both();}
    }
    assert(sa.game.resources.wood>=2);const wanted=Object.keys(sa.game.bank).find(r=>r!=='wood'&&sa.game.bank[r]>0);assert(wanted);await bankTrade('wood',wanted,2);
    let generic;for(let round=0;!generic&&round<12;round++){
      generic=Object.keys(sa.game.resources).find(r=>r!=='wood'&&sa.game.resources[r]>=3);if(generic)break;
      a.send({type:'EndTurn'});await both();b.send({type:'RollDice'});await both();b.send({type:'EndTurn'});await both();a.send({type:'RollDice'});await both();
    }
    assert(generic);const receive=Object.keys(sa.game.bank).find(r=>r!==generic&&sa.game.bank[r]>0);assert(receive);await bankTrade(generic,receive,3);
    b.send({type:'BankTrade',give:generic,receive});assert.match((await b.next('Error')).message,/another player/);
    for(const p of sa.players){const hand=p.id===ja.playerId?sa.game.resources:sb.game.resources;assert.equal(p.resourceCount,Object.values(hand).reduce((a,b)=>a+b,0));}
    console.log('PASS: real harbor settlement ownership, public rates/counts, 2:1 and 3:1 exchanges, resource conservation, client-rate spoof ignored, turn enforcement');
  }finally{await app.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
