const assert=require('assert/strict'),boards=require('../board.cjs'),rules=require('../game.cjs'),turns=require('../turns.cjs'),{encode,validate}=require('../persistence.cjs'),{presentBoard}=require('../tools/renderer-state.cjs');
for(let i=0;i<100;i++){
 const tiles=boards.generate(undefined,true),harbors=boards.harbors(tiles),g=rules.topology(tiles);
 assert.equal(tiles.length,30);assert.equal(g.vertices.length,80);assert.equal(g.edges.length,109);
 assert.deepEqual(tiles.map(t=>t.resource).sort(),[...boards.extendedResources].sort());assert.deepEqual(tiles.filter(t=>t.number).map(t=>t.number).sort((a,b)=>a-b),[...boards.extendedNumbers].sort((a,b)=>a-b));
 const reds=tiles.filter(t=>[6,8].includes(t.number));for(const a of reds)for(const b of reds)if(a!==b)assert(!boards.adjacent(a,b));
 assert.equal(harbors.length,11);const ends=new Set();for(const h of harbors)for(const id of [g.edges[h.edge].a,g.edges[h.edge].b]){assert(!ends.has(id));ends.add(id);}
}
assert.deepEqual(boards.classic(true),boards.classic(true));
for(const count of [5,6]){
 const {board,harbors}=boards.classic(true),players=Array.from({length:count},(_,i)=>({id:'P'+i,name:'Player '+i,bot:false,token:String(i).repeat(48)})),g=rules.start(board,players.map(p=>p.id));g.harbors=harbors;
 while(g.phase!=='complete'){const move=rules.botMove(g,board);rules.place(g,board,g.order[g.step],move.type,move.id);}
 assert.equal(g.vertices.filter(v=>v.owner).length,count*2);turns.begin(g,board);assert.equal(g.developmentDeck.length,34);assert.equal(new Set(Object.values(g.colors)).size,count);
 for(const r of Object.keys(g.bank))assert.equal(g.bank[r]+g.players.reduce((n,id)=>n+g.resources[id][r],0),24);
 const room={code:'ABCDEF',mapType:'classic',board,harbors,players,game:g};validate(encode(new Map([[room.code,room]])));
 const badCoordinates=JSON.parse(JSON.stringify(encode(new Map([[room.code,room]]))));badCoordinates.rooms[0].board[0].q=String(badCoordinates.rooms[0].board[0].q);assert.throws(()=>validate(badCoordinates),/Invalid/);
 const bad=encode(new Map([[room.code,room]]));bad.rooms[0].game=JSON.parse(JSON.stringify(g));bad.rooms[0].game.bank.wood++;assert.throws(()=>validate(bad),/Invalid/);
 const view=presentBoard({board,harbors,maxPlayers:6,players:players.map(p=>({...p,playing:true})),game:g});assert.equal(view.mapping.corners.length,80);assert.equal(view.fixture.gameSettings.maxPlayers,6);assert.equal(view.harborLocations.length,11);
 // A trade can offer more than the base-game supply, but never more than 24.
 for(const id of g.players)for(const r of Object.keys(g.bank))g.resources[id][r]=0;for(const r of Object.keys(g.bank))g.bank[r]=24;
 g.phase='build';g.resources.P0.wood=24;g.bank.wood=0;turns.act(g,board,'P0',{type:'OfferTrade',player:'all',give:{wood:24},receive:{brick:1}});assert.equal(g.tradeOffer.recipients.length,count-1);
 assert.throws(()=>turns.act(g,board,'P0',{type:'OfferTrade',player:'all',give:{wood:25},receive:{brick:1}}),/24/);
}
console.log('PASS: 100 large maps, exact terrain/tokens, separated reds, 11 disjoint harbors, 5/6-player setup, 24-card conservation, 34-card deck, persistence and renderer geometry');

