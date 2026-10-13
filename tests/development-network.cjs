const assert=require('assert/strict'),{WebSocket}=require('ws');
const {createApp}=require('../server.cjs');
const tiles=[];for(let r=-2;r<=2;r++)for(let q=Math.max(-2,-r-2);q<=Math.min(2,-r+2);q++)tiles.push({q,r,resource:tiles.length===18?'desert':['wood','brick','sheep','wheat','ore'][tiles.length%5],number:6});
async function run(){
  const app=createApp({random:()=>3,developmentRandom:()=>0,boardFactory:()=>tiles});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const port=app.server.address().port;
  function client(){const ws=new WebSocket(`ws://127.0.0.1:${port}/socket`,{origin:`http://localhost:${port}`}),queue=[],waiters=[];ws.on('message',bytes=>{const m=JSON.parse(bytes),i=waiters.findIndex(w=>w.type===m.type);if(i<0)queue.push(m);else waiters.splice(i,1)[0].resolve(m);});return{ws,send:m=>ws.send(JSON.stringify(m)),next:type=>new Promise((resolve,reject)=>{const i=queue.findIndex(m=>m.type===type);if(i>=0)return resolve(queue.splice(i,1)[0]);const timer=setTimeout(()=>reject(new Error('Timed out '+type)),3000);waiters.push({type,resolve:m=>{clearTimeout(timer);resolve(m);}});})};}
  try{
    const a=client(),b=client();await a.next('SessionEstablished');await b.next('SessionEstablished');a.send({type:'CreateRoom',name:'A'});const ja=await a.next('Joined');await a.next('RoomState');b.send({type:'JoinRoom',name:'B',code:ja.code});const jb=await b.next('Joined');await a.next('RoomState');await b.next('RoomState');
    a.send({type:'StartGame'});let sa=await a.next('RoomState'),sb=await b.next('RoomState');
    async function both(){sa=await a.next('RoomState');sb=await b.next('RoomState');assert.deepEqual(sa.game.tradeOffer,sb.game.tradeOffer);assert(!JSON.stringify(sb).includes(ja.token));}
    while(['settlement','road'].includes(sa.game.phase)){const c=sa.game.currentPlayer===ja.playerId?a:b;c.send({type:sa.game.phase==='settlement'?'PlaceSettlement':'PlaceRoad',id:(sa.game.phase==='settlement'?sa.game.legalVertices:sa.game.legalEdges)[0]});await both();}
    while(sa.game.phase!=='roll')await both();
    a.send({type:'RollDice'});await both();
    // Obtain purchase resources through real production and bank trades.
    for(let round=0;!sa.game.development.canBuy&&round<15;round++){
      for(const receive of ['sheep','wheat','ore'])if(!sa.game.resources[receive]){
        const give=Object.keys(sa.game.resources).find(r=>sa.game.resources[r]>=(['sheep','wheat','ore'].includes(r)?5:4));
        if(give){a.send({type:'BankTrade',give,receive});await both();}
      }
      if(sa.game.development.canBuy)break;
      a.send({type:'EndTurn'});await both();b.send({type:'RollDice'});await both();b.send({type:'EndTurn'});await both();a.send({type:'RollDice'});await both();
    }
    assert(sa.game.development.canBuy);
    const resources={...sa.game.resources};a.send({type:'BuyDevelopmentCard'});await both();
    const card=sa.game.development.cards[0];assert.equal(card.type,'Knight');assert(card.newThisTurn);assert(!card.playable);assert.equal(sa.game.development.remaining,24);
    assert.deepEqual(sb.game.development.cards,[]);assert.equal(sb.players.find(p=>p.id===ja.playerId).developmentCount,1);
    assert(!JSON.stringify(sb).includes('boughtTurn'));assert(!JSON.stringify(sb).includes('developmentDeck'));assert(!JSON.stringify(sb).includes('"type":"Knight"'));
    for(const r of ['sheep','wheat','ore'])assert.equal(sa.game.resources[r],resources[r]-1);
    a.send({type:'PlayDevelopmentCard',cardId:card.id});assert.match((await a.next('Error')).message,/older/);
    b.send({type:'PlayDevelopmentCard',cardId:card.id});assert.match((await b.next('Error')).message,/another player/);
    a.send({type:'EndTurn'});await both();b.send({type:'RollDice'});await both();b.send({type:'EndTurn'});await both();
    assert(sa.game.development.cards[0].playable);a.send({type:'PlayDevelopmentCard',cardId:card.id});await both();assert.equal(sa.game.phase,'robber');assert.deepEqual(sa.game.development.cards,[]);assert.equal(sb.game.development.lastPlayed.type,'Knight');
    const tile=sa.board.findIndex((_,i)=>i!==sa.game.robber&&!sa.game.vertices.some(v=>v.owner===jb.playerId&&v.tiles.includes(i)));
    assert(tile>=0);a.send({type:'MoveRobber',id:tile});await both();assert.equal(sa.game.phase,'roll');
    a.send({type:'PlayDevelopmentCard',cardId:card.id});assert.match((await a.next('Error')).message,/older/);
    console.log('PASS: real WebSocket purchase, private card snapshots, costs, age/ownership restrictions, public knight play, pre-roll return, replay rejection');
  }finally{await app.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});

