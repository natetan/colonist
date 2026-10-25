const assert = require('assert');
const http = require('http');
const { WebSocket } = require('ws');
const { createApp } = require('../server.cjs');
const rules = require('../game.cjs');
require('./reconnect.cjs');
require('./turns.cjs');
require('./trading.cjs');
require('./development.cjs');
require('./scoring.cjs');
require('./persistence.cjs');
require('./board.cjs');
require('./shaped-board.cjs');
require('./jumbo-board.cjs');
require('./base-game.cjs');
require('./match-rules.cjs');
require('./interaction-controls.cjs');
async function run() {
  const app = createApp({orderRandom:n=>n-1,random:()=>3});
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const port = app.server.address().port;
  const connections = [];
  function client() {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/socket`, { origin: `http://localhost:${port}` });
    connections.push(ws);
    const queue = [], waiters = [];
    ws.on('message', data => { const m = JSON.parse(data); const i = waiters.findIndex(w => w.type === m.type); if (i >= 0) waiters.splice(i, 1)[0].resolve(m); else queue.push(m); });
    return { ws, send: m => ws.send(JSON.stringify(m)), next: type => new Promise((resolve, reject) => {
      const index = queue.findIndex(m => m.type === type); if (index >= 0) return resolve(queue.splice(index, 1)[0]);
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 3000);
      waiters.push({ type, resolve: m => { clearTimeout(timer); resolve(m); } });
    }) };
  }
  try {
    const a = client(); await a.next('SessionEstablished');
    a.send({ type: 'CreateRoom', name: 'Host' }); const joined = await a.next('Joined'); const first = await a.next('RoomState');
    assert.equal(first.board.length, 19); assert.equal(first.board.filter(t => t.resource === 'desert').length, 1);
    const b = client(); await b.next('SessionEstablished');
    b.send({ type: 'JoinRoom', code: 'BAD', name: 'Guest' }); assert.equal((await b.next('Error')).message, 'Room not found.');
    b.send({ type: 'JoinRoom', code: joined.code, name: '<script>guest</script>' }); await b.next('Joined');
    const state = await b.next('RoomState'); assert.deepStrictEqual(state.board, first.board); assert.equal(state.players.length, 2); assert(!JSON.stringify(state).includes(joined.token));
    await a.next('RoomState');
    a.send({type:'Chat',text:'<b>Hello table</b>',name:'Impersonator'});const chatA=await a.next('Chat'),chatB=await b.next('Chat');assert.deepEqual(chatA,chatB);assert.equal(chatA.name,'Host');assert.equal(chatA.text,'<b>Hello table</b>');assert(!JSON.stringify(chatA).includes(joined.token));
    a.send({type:'Chat',text:'Too fast'});assert.match((await a.next('Error')).message,/Wait a moment/);b.send({type:'Chat',text:'x'.repeat(301)});assert.match((await b.next('Error')).message,/1–300/);
    const closed = new Promise(resolve => a.ws.once('close', resolve)); a.ws.close(); await closed;
    const offline = await b.next('RoomState'); assert.equal(offline.players[0].online, false);
    const resume = client(); await resume.next('SessionEstablished'); resume.send({ type: 'Resume', code: joined.code, token: joined.token }); assert.equal((await resume.next('Joined')).playerId, joined.playerId); assert.equal((await resume.next('RoomState')).players.length, 2);
    await b.next('RoomState');
    b.send({ type:'StartGame' }); assert.equal((await b.next('Error')).message, 'Only the host can start.');
    resume.send({ type:'StartGame' }); const started = await resume.next('RoomState'); await b.next('RoomState');
    assert.equal(started.game.vertices.length, 54); assert.equal(started.game.edges.length, 72);
    b.send({ type:'PlaceSettlement', id:started.game.legalVertices[0] }); assert((await b.next('Error')).message.includes('another player'));
    resume.send({ type:'PlaceRoad', id:0 }); assert((await resume.next('Error')).message.includes('settlement first'));
    resume.send({ type:'PlaceSettlement', id:started.game.legalVertices[0] }); const placed = await resume.next('RoomState'); await b.next('RoomState'); assert.equal(placed.game.phase,'road');
    const late = client(); await late.next('SessionEstablished'); late.send({ type:'JoinRoom', code:joined.code, name:'Late' }); assert((await late.next('Error')).message.includes('already started'));
    const game = rules.start(first.board, ['A','B']);
    assert.deepStrictEqual(game.order,['A','B','B','A']);
    while (game.phase !== 'complete') {
      const player = game.order[game.step], corner = rules.legalVertices(game)[0];
      rules.place(game,first.board,player,'PlaceSettlement',corner);
      assert(!rules.legalVertices(game).includes(corner));
      for (const edge of game.edges.filter(e => e.a === corner || e.b === corner)) assert(!rules.legalVertices(game).includes(edge.a === corner ? edge.b : edge.a));
      rules.place(game,first.board,player,'PlaceRoad',rules.legalEdges(game)[0]);
    }
    assert.equal(game.vertices.filter(v=>v.owner).length,4); assert.equal(game.edges.filter(e=>e.owner).length,4);
    for (const player of ['A','B']) {
      const second = game.vertices.filter(v=>v.owner===player)[1];
      assert.equal(Object.values(game.resources[player]).reduce((a,b)=>a+b,0),second.tiles.filter(i=>first.board[i].resource!=='desert').length);
    }
    const solo = rules.start(first.board,['A'],true); assert.deepStrictEqual(solo.order,['A','A']);
    const botHost = client(); await botHost.next('SessionEstablished');
    botHost.send({ type:'CreateRoom', name:'Solo human' }); const botJoined = await botHost.next('Joined'); await botHost.next('RoomState');
    botHost.send({ type:'StartGame', bots:true }); let botState = await botHost.next('RoomState');
    assert.equal(botState.players.filter(p=>p.bot).length,3); assert.equal(botState.players.filter(p=>p.playing).length,4);
    const impostor = client(); await impostor.next('SessionEstablished'); impostor.send({ type:'Resume', code:botJoined.code }); assert((await impostor.next('Error')).message.includes('unavailable'));
    botHost.send({ type:'PlaceSettlement', id:botState.game.legalVertices[0] }); botState = await botHost.next('RoomState');
    botHost.send({ type:'PlaceRoad', id:botState.game.legalEdges[0] });
    do { botState = await botHost.next('RoomState'); } while (botState.game.currentPlayer !== botJoined.playerId || botState.game.phase !== 'settlement');
    for (const bot of botState.players.filter(p=>p.bot)) {
      assert.equal(botState.game.vertices.filter(v=>v.owner===bot.id).length,2);
      assert.equal(botState.game.edges.filter(e=>e.owner===bot.id).length,2);
    }
    assert(!Object.keys(botState.game.resources).includes(botState.players.find(p=>p.bot).id));
    botHost.send({ type:'PlaceSettlement', id:botState.game.legalVertices[0] }); botState = await botHost.next('RoomState');
    botHost.send({ type:'PlaceRoad', id:botState.game.legalEdges[0] }); botState = await botHost.next('RoomState');
    assert.equal(botState.game.phase,'complete'); assert.equal(botState.game.vertices.filter(v=>v.owner).length,8); assert.equal(botState.game.edges.filter(e=>e.owner).length,8);
    botState=await botHost.next('RoomState');assert.equal(botState.game.phase,'roll');
    botHost.send({type:'RollDice'});botState=await botHost.next('RoomState');assert.deepStrictEqual(botState.game.dice,[3,3]);assert.equal(botState.game.phase,'build');
    botHost.send({type:'EndTurn'});do{botState=await botHost.next('RoomState');}while(botState.game.currentPlayer!==botJoined.playerId||botState.game.phase!=='roll');
    assert.equal(botState.players.filter(p=>p.bot).length,3);
    botHost.send({ type:'StartGame', bots:true }); assert((await botHost.next('Error')).message.includes('already started'));
    const large=client();await large.next('SessionEstablished');large.send({type:'CreateRoom',name:'Large host'});const largeJoined=await large.next('Joined');await large.next('RoomState');for(let i=0;i<4;i++){const guest=client();await guest.next('SessionEstablished');guest.send({type:'JoinRoom',code:largeJoined.code,name:'Guest '+i});if(i===3)assert.match((await guest.next('Error')).message,/four players/);else{await guest.next('Joined');await guest.next('RoomState');}}
    const html = await new Promise(resolve => http.get(`http://127.0.0.1:${port}/`, res => { let text=''; res.on('data', data => text += data); res.on('end', () => resolve(text)); })); assert(html.includes('Private Settlers'));
    assert(html.includes('/development.js'));assert(html.includes('/trading.js'));assert(html.includes('/trading.css'));
    for(const [file,mime]of [['scoring.js','text/javascript'],['development.js','text/javascript'],['trading.js','text/javascript'],['trading.css','text/css']]){
      const response=await new Promise((resolve,reject)=>http.get(`http://127.0.0.1:${port}/${file}`,res=>{res.resume();res.on('end',()=>resolve(res));}).on('error',reject));assert.equal(response.statusCode,200);assert.equal(response.headers['content-type'],mime);
    }
    console.log('PASS: lobby/reconnect, host-only start, placement rules, starting resources, solo test, one human plus three automatic bots completing setup, bot impersonation rejection, resource privacy, duplicate-start rejection, HTTP page and trade assets');
  } finally { await app.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
