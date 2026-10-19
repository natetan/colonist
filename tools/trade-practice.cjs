// Disposable multiplayer trading table. Saved games and the normal server are untouched.
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
    const count=Number(process.env.TRADE_PRACTICE_PLAYERS||4),seats=['host','friend','friend2','friend3'].slice(0,count),records=[],sessions=[];
    if(![2,3,4].includes(count))throw Error('Practice supports two to four humans.');
    for(let i=0;i<seats.length;i++){const c=client();records.push(c);await c.next('SessionEstablished');c.send(i?{type:'JoinRoom',name:'Trade '+seats[i],code:sessions[0].code}:{type:'CreateRoom',name:'Trade host'});sessions.push(await c.next('Joined'));for(const p of records)await p.next('RoomState');}
    const all=async()=>{const states=await Promise.all(records.map(c=>c.next('RoomState')));return states[0];};
    records[0].send({type:'StartGame'});let state=await all();
    while(['settlement','road'].includes(state.game.phase)){const index=sessions.findIndex(s=>s.playerId===state.game.currentPlayer);records[index].send({type:state.game.phase==='settlement'?'PlaceSettlement':'PlaceRoad',id:(state.game.phase==='settlement'?state.game.legalVertices:state.game.legalEdges)[0]});state=await all();}
    while(state.game.phase!=='roll')state=await all();records[0].send({type:'RollDice'});state=await all();
    const assets=path.resolve(__dirname,'../.rea-tools/renderer/assets'),html=fs.readFileSync(path.join(__dirname,'renderer-lab.html'),'utf8');
    for(const [i,seat]of seats.entries()){const session=sessions[i];
      fs.writeFileSync(path.join(assets,'practice-'+seat+'.js'),`sessionStorage.setItem('private-settlers-renderer-session',${JSON.stringify(JSON.stringify({code:session.code,token:session.token}))});`);
      fs.writeFileSync(path.join(assets,'practice-'+seat+'.html'),html.replace('<title>Private Settlers</title>','<title>Trading practice: '+seat+'</title>').replace('<script src="/lab.js">',`<script src="/assets/practice-${seat}.js"></script><script src="/lab.js">`));
      console.log(`${seat}: http://127.0.0.1:${port}/assets/practice-${seat}.html`);
    }
    console.log('Live multiplayer practice match: setup and first roll completed. Open the printed seat URLs in separate tabs to offer, decline, and accept. No saved games are modified.');
    for(const ws of clients)ws.close();
    process.on('SIGINT',()=>server.closeLab().then(()=>process.exit()));
  }catch(error){console.error(error);for(const ws of clients)ws.terminate();await server.closeLab();process.exitCode=1;}
})().catch(error=>{console.error(error);process.exitCode=1;});
