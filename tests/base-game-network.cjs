// A complete standard-board game: one automated human client plus three server bots.
const assert=require('assert/strict'),{WebSocket}=require('ws'),{createApp}=require('../server.cjs'),turns=require('../turns.cjs'),boards=require('../board.cjs');
function rng(seed){return n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};}
async function run(){
 const playerCount=Number(process.env.SETTLERS_TEST_PLAYERS||4),extended=playerCount>4,supply=extended?24:19;const seed=Number(process.env.SETTLERS_TEST_SEED||91),dice=rng(seed),app=createApp({orderRandom:n=>n-1,botDelayMs:Number(process.env.SETTLERS_TEST_BOT_DELAY_MS||0),boardRandom:rng(seed+1143),random:(min,max)=>max===undefined?dice(min):min+dice(max-min),developmentRandom:rng(seed+39)});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const port=app.server.address().port;
 const ws=new WebSocket(`ws://127.0.0.1:${port}/socket`,{origin:`http://localhost:${port}`}),queue=[],waiting=[];
 ws.on('message',bytes=>{const m=JSON.parse(bytes);if(m.type==='Error')throw new Error(m.message);const i=waiting.findIndex(w=>w.type===m.type);if(i<0)queue.push(m);else waiting.splice(i,1)[0].resolve(m);});
 const next=type=>new Promise((resolve,reject)=>{const i=queue.findIndex(m=>m.type===type);if(i>=0)return resolve(queue.splice(i,1)[0]);const timer=setTimeout(()=>reject(new Error('Timed out '+type)),5000);waiting.push({type,resolve:m=>{clearTimeout(timer);resolve(m);}});});const send=m=>ws.send(JSON.stringify(m));
 try{
  await next('SessionEstablished');send({type:'CreateRoom',name:'Base-game tester'});const joined=await next('Joined');await next('RoomState');if(extended){send({type:'SetMap',mapType:'random',mapSize:'extended'});await next('RoomState');}send({type:'StartGame',bots:true,targetPlayers:playerCount});let state=await next('RoomState');const id=joined.playerId;let sevens=0,trades=0,lastDiscardSequence;const replay=[];
  const reds=state.board.filter(t=>t.number===6||t.number===8);for(const a of reds)for(const b of reds)if(a!==b)assert(!boards.adjacent(a,b));assert.equal(state.harbors.length,extended?11:9);
  for(let action=0;state.game.phase!=='finished'&&action<6000;action++){
   if(process.env.SETTLERS_RECORD_QA)replay.push(state);const g=state.game,h=g.resources;let move;
   if(g.discardCount){if(lastDiscardSequence===g.production?.sequence){state=await next('RoomState');continue;}lastDiscardSequence=g.production?.sequence;let left=g.discardCount;const cards={};for(const r of Object.keys(h).sort((a,b)=>h[b]-h[a])){cards[r]=Math.min(left,h[r]);left-=cards[r];}move={type:'Discard',cards};sevens++;}
   else if(g.currentPlayer!==id){state=await next('RoomState');continue;}
   else if(g.phase==='settlement'){
    const owned=g.vertices.filter(v=>v.owner===id).flatMap(v=>v.tiles).map(i=>state.board[i].resource);
    const score=v=>g.vertices[v].tiles.reduce((n,i)=>{const t=state.board[i];return n+(t.resource==='desert'?0:(6-Math.abs(7-t.number))+(owned.includes(t.resource)?0:3));},0);move={type:'PlaceSettlement',id:g.legalVertices.slice().sort((a,b)=>score(b)-score(a))[0]};
   }else if(g.phase==='road')move={type:'PlaceRoad',id:g.legalEdges[0]};
   else if(g.phase==='free-road')move={type:'PlaceFreeRoad',id:g.development.legalFreeRoads[0]};
   else if(g.phase==='robber'){const target=state.board.map((t,i)=>({i,score:g.vertices.filter(v=>v.owner&&v.owner!==id&&v.tiles.includes(i)).length-(g.vertices.some(v=>v.owner===id&&v.tiles.includes(i))?10:0)})).filter(t=>t.i!==g.robber).sort((a,b)=>b.score-a.score)[0];move={type:'MoveRobber',id:target.i};}
   else if(g.phase==='steal')move={type:'Steal',player:g.victims[0]};
   else if(['roll','build'].includes(g.phase)){
    const card=g.development.cards.find(c=>c.playable);if(card){move={type:'PlayDevelopmentCard',cardId:card.id};if(card.type==='Monopoly')move.resource=Object.keys(h).sort((a,b)=>h[a]-h[b])[0];if(card.type==='YearOfPlenty'){const bank={...g.bank};move.resources=[];for(let i=0;i<2;i++){const r=Object.keys(h).filter(r=>bank[r]>0).sort((a,b)=>h[a]-h[b])[0];if(r){move.resources.push(r);bank[r]--;}}}}
    else if(g.phase==='roll')move={type:'RollDice'};
    else{
     const type=['BuildCity','BuildSettlement'].find(t=>g.builds[t].length);if(type)move={type,id:g.builds[type][0]};
     else if(g.development.canBuy)move={type:'BuyDevelopmentCard'};
     else if(g.builds.BuildRoad.length)move={type:'BuildRoad',id:g.builds.BuildRoad[0]};
     else{
      const fake={...g,resources:{[id]:Object.fromEntries(Object.keys(h).map(r=>[r,19]))}},goals=Object.entries(turns.costs).filter(([type])=>turns.buildLocations(fake,id,type).length).map(([,cost])=>cost);if(g.development.remaining)goals.push({sheep:1,wheat:1,ore:1});
      goals.sort((a,b)=>Object.entries(a).reduce((n,[r,k])=>n+Math.max(0,k-h[r]),0)-Object.entries(b).reduce((n,[r,k])=>n+Math.max(0,k-h[r]),0));
      for(const goal of goals){const receive=Object.keys(h).find(r=>h[r]<(goal[r]||0)&&g.bank[r]>0),give=Object.keys(h).find(r=>r!==receive&&h[r]>=(goal[r]||0)+g.bankRates[r]);if(receive&&give){move={type:'BankTrade',give,receive};trades++;break;}}move||={type:'EndTurn'};
     }
    }
   }else{state=await next('RoomState');continue;}
   send(move);state=await next('RoomState');
   for(const r of Object.keys(state.game.bank||{}))assert.equal(state.game.bank[r]+state.players.reduce((n,p)=>n+(p.id===id?state.game.resources[r]:0),0)<=supply,true);
  }
  if(process.env.SETTLERS_RECORD_QA){replay.push(state);require('fs').mkdirSync(require('path').resolve(__dirname,'../.rea-tools'),{recursive:true});require('fs').writeFileSync(require('path').resolve(__dirname,'../.rea-tools/full-game-qa.json'),JSON.stringify({viewerId:id,states:replay}));}
  assert.equal(state.game.phase,'finished');assert(state.game.scoring.winningPoints>=10);assert.equal(state.players.length,playerCount);assert(trades>0);assert(sevens>0);console.log(`PASS: complete ${playerCount}-player ${extended?'large':'standard'}-board match with harbors, real dice/sevens, ${trades} human maritime trades, development cards, bots and ten-point victory`);
 }finally{await app.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
