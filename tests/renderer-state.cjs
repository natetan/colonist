const assert=require('assert/strict');
const {translateGeometry,presentBoard}=require('../tools/renderer-state.cjs');
const {createGeometry}=require('../protocol-map.cjs');
const {topology}=require('../game.cjs');
const board=[];for(let q=-2;q<=2;q++)for(let r=-2;r<=2;r++)if(Math.abs(q+r)<=2)board.push({q,r,resource:q===0&&r===0?'desert':'wood',number:6});
for(const tiles of [board,board.slice().reverse()]){
  const mapping=translateGeometry(tiles),local=topology(tiles),original=createGeometry(tiles.map(t=>({x:t.q,y:t.r})));
  assert.equal(new Set(mapping.corners).size,54);assert.equal(new Set(mapping.edges).size,72);
  for(const e of local.edges)assert.deepEqual(original.edges[mapping.edges[e.id]].endpoints.slice().sort((a,b)=>a-b),[mapping.corners[e.a],mapping.corners[e.b]].sort((a,b)=>a-b));
  for(const v of local.vertices){
    const mapped=mapping.corners[v.id];
    assert.equal(original.tiles.filter(t=>t.corners.includes(mapped)).length,v.tiles.length);
    for(const tile of v.tiles)assert(original.tiles[tile].corners.includes(mapped));
  }
  const snapshot={board:tiles,players:[{id:'offline',playing:false},{id:'a',playing:true},{id:'b',playing:true}],game:{...local,resources:{wood:999},robber:4}};
  local.vertices[0].owner='a';local.vertices[1].owner='b';local.vertices[1].city=true;local.edges[0].owner='a';
  const before=JSON.stringify(snapshot),view=presentBoard(snapshot),map=view.fixture.gameState.mapState;
  assert.equal(map.tileCornerStates[mapping.corners[0]].owner,1);assert.equal(map.tileCornerStates[mapping.corners[1]].owner,2);assert.equal(map.tileCornerStates[mapping.corners[1]].buildingType,2);
  assert.equal(map.tileEdgeStates[mapping.edges[0]].type,1);assert.equal(view.robber,4);
  assert.equal(JSON.stringify(snapshot),before);assert(!JSON.stringify(view).includes('999'));
}
const lobby=presentBoard({board,players:[],game:null});assert.equal(lobby.robber,board.findIndex(t=>t.resource==='desert'));
assert(Object.values(lobby.fixture.gameState.mapState.tileCornerStates).every(c=>c.owner===undefined));
console.log('PASS: all corners/edges map to matching tiles and endpoints; piece ownership, cities, robber, redaction, and immutable snapshots');
