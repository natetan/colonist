const assert=require('assert/strict'),{WebSocket}=require('ws');
const {createApp}=require('../server.cjs');
const fs=require('fs'),os=require('os'),path=require('path');
const tiles=[];for(let r=-2;r<=2;r++)for(let q=Math.max(-2,-r-2);q<=Math.min(2,-r+2);q++)tiles.push({q,r,resource:tiles.length===18?'desert':['wood','brick','sheep','wheat','ore'][tiles.length%5],number:6});
async function run(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'settlers-restart-')),saveFile=path.join(dir,'rooms.json');
  let app=createApp({saveFile,random:()=>3,developmentRandom:()=>0,boardFactory:()=>tiles});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));let port=app.server.address().port;
  function client(){const ws=new WebSocket(`ws://127.0.0.1:${port}/socket`,{origin:`http://localhost:${port}`}),queue=[],waiters=[];ws.on('message',bytes=>{const m=JSON.parse(bytes),i=waiters.findIndex(w=>w.type===m.type);if(i<0)queue.push(m);else waiters.splice(i,1)[0].resolve(m);});return{ws,send:m=>ws.send(JSON.stringify(m)),next:type=>new Promise((resolve,reject)=>{const i=queue.findIndex(m=>m.type===type);if(i>=0)return resolve(queue.splice(i,1)[0]);const timer=setTimeout(()=>reject(new Error('Timed out '+type)),3000);waiters.push({type,resolve:m=>{clearTimeout(timer);resolve(m);}});})};}
  try{
    let a=client(),b=client();await a.next('SessionEstablished');await b.next('SessionEstablished');a.send({type:'CreateRoom',name:'A'});const ja=await a.next('Joined');await a.next('RoomState');b.send({type:'JoinRoom',name:'B',code:ja.code});const jb=await b.next('Joined');await a.next('RoomState');await b.next('RoomState');
    a.send({type:'StartGame'});let sa=await a.next('RoomState'),sb=await b.next('RoomState');
    async function both(){sa=await a.next('RoomState');sb=await b.next('RoomState');assert.deepEqual(sa.game.tradeOffer,sb.game.tradeOffer);assert(!JSON.stringify(sb).includes(ja.token));}
    async function restart(){
      const beforeA=sa.game,beforeB=sb.game;await app.close();
      app=createApp({saveFile,random:()=>3,developmentRandom:()=>0});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
      a=client();await a.next('SessionEstablished');a.send({type:'Resume',code:ja.code,token:ja.token});const resumed=await a.next('Joined');assert.equal(resumed.playerId,ja.playerId);sa=await a.next('RoomState');
      b=client();await b.next('SessionEstablished');b.send({type:'Resume',code:jb.code,token:jb.token});await b.next('Joined');sb=await b.next('RoomState');sa=await a.next('RoomState');
      assert.deepEqual(sa.game,beforeA);assert.deepEqual(sb.game,beforeB);assert(sa.persistence);assert(!JSON.stringify(sb).includes(ja.token));assert(!JSON.stringify(sa).includes(jb.token));
    }
    await restart();
    a.send({type:'PlaceSettlement',id:sa.game.legalVertices[0]});await both();await restart();
    while(['settlement','road'].includes(sa.game.phase)){const c=sa.game.currentPlayer===ja.playerId?a:b;c.send({type:sa.game.phase==='settlement'?'PlaceSettlement':'PlaceRoad',id:(sa.game.phase==='settlement'?sa.game.legalVertices:sa.game.legalEdges)[0]});await both();}
    while(sa.game.phase!=='roll')await both();
    await restart();a.send({type:'RollDice'});await both();await restart();
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
    const give=Object.keys(sa.game.resources).find(r=>sa.game.resources[r]>0&&Object.keys(sb.game.resources).some(s=>s!==r&&sb.game.resources[s]>0));
    const receive=Object.keys(sb.game.resources).find(r=>r!==give&&sb.game.resources[r]>0);assert(give&&receive);
    a.send({type:'OfferTrade',player:jb.playerId,give:{[give]:1},receive:{[receive]:1}});await both();await restart();assert(sb.game.canAcceptTrade);a.send({type:'CancelTrade',offerId:sa.game.tradeOffer.id});await both();
    const resources={...sa.game.resources};a.send({type:'BuyDevelopmentCard'});await both();
    await restart();const card=sa.game.development.cards[0];assert.equal(card.type,'Knight');assert(card.newThisTurn);assert(!card.playable);assert.equal(sa.game.development.remaining,24);
    assert.deepEqual(sb.game.development.cards,[]);assert.equal(sb.players.find(p=>p.id===ja.playerId).developmentCount,1);
    assert(!JSON.stringify(sb).includes('boughtTurn'));assert(!JSON.stringify(sb).includes('developmentDeck'));assert(!JSON.stringify(sb).includes('"type":"Knight"'));
    for(const r of ['sheep','wheat','ore'])assert.equal(sa.game.resources[r],resources[r]-1);
    a.send({type:'PlayDevelopmentCard',cardId:card.id});assert.match((await a.next('Error')).message,/older/);
    b.send({type:'PlayDevelopmentCard',cardId:card.id});assert.match((await b.next('Error')).message,/another player/);
    a.send({type:'EndTurn'});await both();b.send({type:'RollDice'});await both();b.send({type:'EndTurn'});await both();
    assert(sa.game.development.cards[0].playable);a.send({type:'PlayDevelopmentCard',cardId:card.id});await both();assert.equal(sa.game.phase,'robber');await restart();assert.deepEqual(sa.game.development.cards,[]);assert.equal(sb.game.development.lastPlayed.type,'Knight');
    const tile=sa.board.findIndex((_,i)=>i!==sa.game.robber&&!sa.game.vertices.some(v=>v.owner===jb.playerId&&v.tiles.includes(i)));
    assert(tile>=0);a.send({type:'MoveRobber',id:tile});await both();assert.equal(sa.game.phase,'roll');
    a.send({type:'PlayDevelopmentCard',cardId:card.id});assert.match((await a.next('Error')).message,/older/);
    const http=require('http');for(const url of ['/rooms.json','/data/rooms.json']){const status=await new Promise(resolve=>http.get(`http://127.0.0.1:${port}${url}`,res=>{res.resume();res.on('end',()=>resolve(res.statusCode));}));assert.equal(status,404);}
    const rename=fs.renameSync,log=console.error;let saveError;
    fs.renameSync=()=>{throw new Error('simulated disk failure');};console.error=m=>{saveError=m;};
    try{a.send({type:'RollDice'});assert.match((await a.next('Error')).message,/Saving failed/);}finally{fs.renameSync=rename;console.error=log;}
    assert.match(saveError,/simulated disk failure/);b.send({type:'RollDice'});assert.match((await b.next('Error')).message,/Saving failed/);await restart();assert.equal(sa.game.phase,'roll');
    a.send({type:'RollDice'});await both();assert.equal(sa.game.phase,'build');
    // Seed a legal save at the boundary before a bot's setup turn, as a crash could leave it.
    await app.close();const rules=require('../game.cjs'),{createStore}=require('../persistence.cjs'),botFile=path.join(dir,'bots.json');
    const botGame=rules.start(tiles,[ja.playerId,jb.playerId]);let move=rules.botMove(botGame,tiles);rules.place(botGame,tiles,ja.playerId,move.type,move.id);move=rules.botMove(botGame,tiles);rules.place(botGame,tiles,ja.playerId,move.type,move.id);
    const store=createStore(botFile);store.save(new Map([['B07000',{code:'B07000',board:tiles,game:botGame,players:[{id:ja.playerId,name:'A',token:ja.token},{id:jb.playerId,name:'Bot',bot:true}]}]]));store.close();
    app=createApp({saveFile:botFile,random:()=>3});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
    const human=client();await human.next('SessionEstablished');human.send({type:'Resume',code:'B07000',token:ja.token});await human.next('Joined');let botState=await human.next('RoomState');
    for(let i=0;botState.game.currentPlayer!==ja.playerId&&i<10;i++)botState=await human.next('RoomState');
    assert.equal(botState.game.currentPlayer,ja.playerId);assert.equal(botState.game.phase,'settlement');assert.equal(botState.game.vertices.filter(v=>v.owner===jb.playerId).length,2);assert.equal(botState.players.find(p=>p.bot).online,true);
    console.log('PASS: real server restarts during settlement/road setup, roll/build, pending trade, new private card, and knight robber; tokens, phase, hands, deck count, scores and turn restrictions restored; disk failure pauses moves and preserves saved state; interrupted bot turns resume');
  }finally{await app.close();fs.rmSync(dir,{recursive:true,force:true});}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
