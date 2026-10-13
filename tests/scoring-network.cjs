const assert=require('assert/strict'),{WebSocket}=require('ws');
const {createApp}=require('../server.cjs');
const tiles=[];for(let r=-2;r<=2;r++)for(let q=Math.max(-2,-r-2);q<=Math.min(2,-r+2);q++)tiles.push({q,r,resource:tiles.length===18?'desert':['wood','brick','sheep','wheat','ore'][tiles.length%5],number:6});
async function run(){
  const app=createApp({random:()=>3,developmentRandom:n=>n>20?14:0,boardFactory:()=>tiles});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const port=app.server.address().port;
  function client(){const ws=new WebSocket(`ws://127.0.0.1:${port}/socket`,{origin:`http://localhost:${port}`}),queue=[],waiters=[];ws.on('message',bytes=>{const m=JSON.parse(bytes),i=waiters.findIndex(w=>w.type===m.type);if(i<0)queue.push(m);else waiters.splice(i,1)[0].resolve(m);});return{ws,send:m=>ws.send(JSON.stringify(m)),next:type=>new Promise((resolve,reject)=>{const i=queue.findIndex(m=>m.type===type);if(i>=0)return resolve(queue.splice(i,1)[0]);const timer=setTimeout(()=>reject(new Error('Timed out '+type)),3000);waiters.push({type,resolve:m=>{clearTimeout(timer);resolve(m);}});})};}
  try{
    const a=client(),b=client();await a.next('SessionEstablished');await b.next('SessionEstablished');a.send({type:'CreateRoom',name:'A'});const ja=await a.next('Joined');await a.next('RoomState');b.send({type:'JoinRoom',name:'B',code:ja.code});const jb=await b.next('Joined');await a.next('RoomState');await b.next('RoomState');
    a.send({type:'StartGame'});let sa=await a.next('RoomState'),sb=await b.next('RoomState');
    async function both(){sa=await a.next('RoomState');sb=await b.next('RoomState');assert.deepEqual(sa.game.tradeOffer,sb.game.tradeOffer);assert(!JSON.stringify(sb).includes(ja.token));}
    while(['settlement','road'].includes(sa.game.phase)){const c=sa.game.currentPlayer===ja.playerId?a:b;c.send({type:sa.game.phase==='settlement'?'PlaceSettlement':'PlaceRoad',id:(sa.game.phase==='settlement'?sa.game.legalVertices:sa.game.legalEdges)[0]});await both();}
    while(sa.game.phase!=='roll')await both();
    const score=require('../scoring.cjs');
    for(let action=0;sa.game.phase!=='finished'&&action<600;action++){
      const mine=sa.game.currentPlayer===ja.playerId,c=mine?a:b,state=mine?sa:sb,g=state.game;
      assert.equal(sa.game.scoring.yourPoints,sa.players.find(p=>p.id===ja.playerId).points+sa.game.development.privateVictoryPoints);
      assert.equal(sb.game.scoring.yourPoints,sb.players.find(p=>p.id===jb.playerId).points+sb.game.development.privateVictoryPoints);
      assert.equal(g.scoring.revealedVictoryPoints,0);
      let move;
      const knight=g.development.cards.find(c=>c.type==='Knight'&&c.playable);
      if(knight)move={type:'PlayDevelopmentCard',cardId:knight.id};
      else if(g.phase==='robber')move={type:'MoveRobber',id:state.board.findIndex((_,i)=>i!==g.robber)};
      else if(g.phase==='steal')move={type:'Steal',player:g.victims[0]};
      else if(g.phase==='roll')move={type:'RollDice'};
      else if(g.phase==='build'){
        if(g.development.canBuy&&g.development.privateVictoryPoints<5)move={type:'BuyDevelopmentCard'};
        else if(g.builds.BuildCity.length)move={type:'BuildCity',id:g.builds.BuildCity[0]};
        else if(g.builds.BuildSettlement.length)move={type:'BuildSettlement',id:g.builds.BuildSettlement[0]};
        else if(g.builds.BuildRoad.length&&g.scoring.longestRoad!==g.currentPlayer){
          const roads=g.builds.BuildRoad.slice().sort((a,b)=>{
            const length=id=>{const clone={vertices:g.vertices,edges:g.edges.map(e=>({...e,owner:e.id===id?g.currentPlayer:e.owner}))};return score.longestRoad(clone,g.currentPlayer);};return length(b)-length(a);
          });move={type:'BuildRoad',id:roads[0]};
        }else{
          const wanted=g.development.privateVictoryPoints<5?{sheep:1,wheat:1,ore:1}:{wheat:2,ore:3};
          const receive=Object.keys(wanted).find(r=>g.resources[r]<wanted[r]&&g.bank[r]>0);
          const give=Object.keys(g.resources).find(r=>r!==receive&&g.resources[r]>=(wanted[r]||0)+4);
          move=receive&&give?{type:'BankTrade',give,receive}:{type:'EndTurn'};
        }
      }else throw new Error('Unexpected phase '+g.phase);
      c.send(move);await both();
    }
    assert.equal(sa.game.phase,'finished');assert.deepEqual(sa.game.scoring.winner,sb.game.scoring.winner);assert(sa.game.scoring.winningPoints>=10);
    const winner=sa.players.find(p=>p.id===sa.game.scoring.winner);assert.equal(winner.points,sa.game.scoring.winningPoints);assert(sa.game.scoring.revealedVictoryPoints>0);
    const winnerClient=winner.id===ja.playerId?a:b;winnerClient.send({type:'EndTurn'});assert.match((await winnerClient.next('Error')).message,/finished/);
    // Finished state survives a seat reconnect without exposing the other hand.
    const before=sa;const closed=new Promise(resolve=>a.ws.once('close',resolve));a.ws.close();await closed;await b.next('RoomState');
    const resumed=client();await resumed.next('SessionEstablished');resumed.send({type:'Resume',code:ja.code,token:ja.token});await resumed.next('Joined');const restored=await resumed.next('RoomState');assert.equal(restored.game.phase,'finished');assert.equal(restored.game.scoring.winner,before.game.scoring.winner);assert.deepEqual(restored.game.development.cards,before.game.development.cards);assert(!JSON.stringify(restored).includes(jb.token));
    console.log('PASS: two-human full match from setup to 10-point victory, private/public scores, revealed winner points, finished-command rejection, finished-game reconnect');
  }finally{await app.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
