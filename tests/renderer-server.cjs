const assert=require('assert/strict'),http=require('http');
const {WebSocket}=require('ws');
const {startRendererLab}=require('../tools/renderer-server.cjs');
function get(port,url){return new Promise((resolve,reject)=>http.get({hostname:'127.0.0.1',port,path:url},res=>{const data=[];res.on('data',chunk=>data.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(data).toString()}));}).on('error',reject));}
(async()=>{
 const server=await startRendererLab(0,{random:()=>2});
 try{
  assert.equal(server.address().address,'127.0.0.1');
  const port=server.address().port;
  const page=await get(port,'/');assert.equal(page.status,200);
  assert(page.headers['content-security-policy'].includes("connect-src 'self'"));
  assert(page.headers['content-security-policy'].includes("default-src 'none'"));
  assert.equal(page.headers['x-content-type-options'],'nosniff');
  assert.equal((await get(port,'/assets/../../package.json')).status,404);
  assert.equal((await get(port,'/assets/%2e%2e%2fpackage.json')).status,404);
  const script=await get(port,'/lab.js');assert.equal(script.headers['content-type'],'text/javascript');
  assert.equal((await get(port,'/development.js')).headers['content-type'],'text/javascript');
  assert(page.body.includes('/development.js'));
  assert(page.body.includes('/scoring.js'));assert.equal((await get(port,'/scoring.js')).headers['content-type'],'text/javascript');
  assert.equal((await get(port,'/trading.js')).headers['content-type'],'text/javascript');
  assert.equal((await get(port,'/trading.css')).headers['content-type'],'text/css');
  assert(page.body.includes('/trading.js'));assert(page.body.includes('/trading.css'));
  assert.equal((await get(port,'/research/colonist-home.html')).status,404);
  function client(){
    const ws=new WebSocket(`ws://127.0.0.1:${port}/socket`,{origin:`http://127.0.0.1:${port}`}),queue=[],waiters=[];
    ws.on('message',bytes=>{const m=JSON.parse(bytes);const i=waiters.findIndex(w=>w.type===m.type);if(i<0)queue.push(m);else waiters.splice(i,1)[0].resolve(m);});
    return {ws,send:m=>ws.send(JSON.stringify(m)),next:type=>new Promise((resolve,reject)=>{const i=queue.findIndex(m=>m.type===type);if(i>=0)return resolve(queue.splice(i,1)[0]);const timer=setTimeout(()=>reject(new Error('Missing '+type)),3000);waiters.push({type,resolve:m=>{clearTimeout(timer);resolve(m);}});})};
  }
  const host=client();await host.next('SessionEstablished');host.send({type:'CreateRoom',name:'Renderer host'});const joined=await host.next('Joined');
  const lobby=await host.next('RoomState');assert.equal(lobby.renderer.mapping.corners.length,54);
  host.send({type:'StartGame',bots:true});let state=await host.next('RoomState');
  for(let pair=0;pair<2;pair++){
    const vertex=state.game.legalVertices[0];host.send({type:'PlaceSettlement',id:vertex});state=await host.next('RoomState');
    const corner=state.renderer.fixture.gameState.mapState.tileCornerStates[state.renderer.mapping.corners[vertex]];assert.equal(corner.owner,1);assert.equal(corner.buildingType,1);
    host.send({type:'PlaceRoad',id:state.game.legalEdges[0]});
    do{state=await host.next('RoomState');}while(state.game.currentPlayer!==joined.playerId||!['settlement','roll'].includes(state.game.phase));
  }
  assert.equal(state.game.phase,'roll');assert.equal(Object.values(state.renderer.fixture.gameState.mapState.tileCornerStates).filter(c=>c.owner).length,8);
  assert.equal(Object.values(state.renderer.fixture.gameState.mapState.tileEdgeStates).filter(e=>e.owner).length,8);
  assert(Object.values(state.game.resources).some(n=>n>0));assert.deepEqual(state.renderer.fixture.gameState.playerStates[0].resourceCards.cards,[]);
  host.send({type:'RollDice'});state=await host.next('RoomState');assert.equal(state.game.phase,'build');assert.deepEqual(state.game.dice,[2,2]);
  const disconnected=new Promise(resolve=>host.ws.once('close',resolve));host.ws.close();await disconnected;
  const resumed=client();await resumed.next('SessionEstablished');resumed.send({type:'Resume',code:joined.code,token:joined.token});assert.equal((await resumed.next('Joined')).playerId,joined.playerId);
  const recovered=await resumed.next('RoomState');assert.deepEqual(recovered.renderer,state.renderer);resumed.ws.close();
  console.log('PASS: live renderer snapshots, bot setup, public piece ownership, private-hand exclusion, dice action, reconnect');
  console.log('PASS: loopback renderer routes, CSP, MIME types, traversal rejection');
 }finally{await server.closeLab();}
})().catch(error=>{console.error(error);process.exitCode=1;});
