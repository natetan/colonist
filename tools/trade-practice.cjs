// Disposable two-human trading table. Saved games and the normal server are untouched.
const fs=require('fs'),path=require('path'),{WebSocket}=require('ws');
const {startRendererLab}=require('./renderer-server.cjs');
const tiles=[];for(let r=-2;r<=2;r++)for(let q=Math.max(-2,-r-2);q<=Math.min(2,-r+2);q++)tiles.push({q,r,resource:tiles.length===18?'desert':['wood','brick','sheep','wheat','ore'][tiles.length%5],number:6});
(async()=>{
  const server=await startRendererLab(Number(process.env.TRADE_PRACTICE_PORT||3011),{random:()=>3,boardFactory:()=>tiles});
  const port=server.address().port,clients=[];
  function client(){
    const ws=new WebSocket(`ws://127.0.0.1:${port}/socket`,{origin:`http://localhost:${port}`}),queue=[],waiters=[];clients.push(ws);
    ws.on('message',raw=>{const m=JSON.parse(raw),i=waiters.findIndex(w=>w.type===m.type);if(m.type==='Error')console.error(m.message);if(i<0)queue.push(m);else waiters.splice(i,1)[0].resolve(m);});
    return {send:m=>ws.send(JSON.stringify(m)),next:type=>new Promise((resolve,reject)=>{const i=queue.findIndex(m=>m.type===type);if(i>=0)return resolve(queue.splice(i,1)[0]);const timeout=setTimeout(()=>reject(Error('Timed out '+type)),5000);waiters.push({type,resolve:m=>{clearTimeout(timeout);resolve(m);}});})};
  }
  try{
    const a=client(),b=client();await a.next('SessionEstablished');await b.next('SessionEstablished');
    a.send({type:'CreateRoom',name:'Trade host'});const ja=await a.next('Joined');await a.next('RoomState');
    b.send({type:'JoinRoom',name:'Trade friend',code:ja.code});const jb=await b.next('Joined');await a.next('RoomState');await b.next('RoomState');
    a.send({type:'StartGame'});let state=await a.next('RoomState');await b.next('RoomState');
    while(['settlement','road'].includes(state.game.phase)){
      const c=state.game.currentPlayer===ja.playerId?a:b;
      c.send({type:state.game.phase==='settlement'?'PlaceSettlement':'PlaceRoad',id:(state.game.phase==='settlement'?state.game.legalVertices:state.game.legalEdges)[0]});state=await a.next('RoomState');await b.next('RoomState');
    }
    a.send({type:'RollDice'});state=await a.next('RoomState');await b.next('RoomState');
    const assets=path.resolve(__dirname,'../.rea-tools/renderer/assets'),html=fs.readFileSync(path.join(__dirname,'renderer-lab.html'),'utf8');
    for(const [seat,session]of [['host',ja],['friend',jb]]){
      fs.writeFileSync(path.join(assets,'practice-'+seat+'.js'),`sessionStorage.setItem('private-settlers-renderer-session',${JSON.stringify(JSON.stringify({code:session.code,token:session.token}))});`);
      fs.writeFileSync(path.join(assets,'practice-'+seat+'.html'),html.replace('<title>Private Settlers</title>','<title>Trading practice: '+seat+'</title>').replace('<script src="/lab.js">',`<script src="/assets/practice-${seat}.js"></script><script src="/lab.js">`));
      console.log(`${seat}: http://127.0.0.1:${port}/assets/practice-${seat}.html`);
    }
    console.log('Live two-human practice match: setup and first roll completed. Use both tabs to offer, decline, and accept. No saved games are modified.');
    for(const ws of clients)ws.close();
    process.on('SIGINT',()=>server.closeLab().then(()=>process.exit()));
  }catch(error){console.error(error);for(const ws of clients)ws.terminate();await server.closeLab();process.exitCode=1;}
})().catch(error=>{console.error(error);process.exitCode=1;});
