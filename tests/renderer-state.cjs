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
for(const [index,color]of require('../game.cjs').palette.entries()){
 const local=topology(board);local.vertices[0].owner='a';local.edges[0].owner='a';
 const view=presentBoard({board,players:[{id:'a',playing:true}],game:{...local,colors:{a:color}}}),expected=[1,2,3,4,10,9][index];
 assert.equal(view.playerColors.a,expected);assert.equal(view.fixture.gameState.mapState.tileCornerStates[view.mapping.corners[0]].owner,expected);assert.equal(view.fixture.gameState.mapState.tileEdgeStates[view.mapping.edges[0]].owner,expected);
}
assert(Object.values(lobby.fixture.gameState.mapState.tileCornerStates).every(c=>c.owner===undefined));
console.log('PASS: all corners/edges map to matching tiles and endpoints; piece ownership, cities, robber, redaction, and immutable snapshots');
const boards=require('../board.cjs');let inward=0;
for(const extended of [false,true])for(let seed=1;seed<=40;seed++){
 let value=seed;const random=n=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value%n;};
 const tiles=boards.generate(random,extended,'random-plus-plus'),harbors=boards.coastline(tiles).map(edge=>({edge,resource:null}));
 const view=presentBoard({board:tiles,harbors,players:[],game:null});
 for(const port of view.harborLocations){
  assert(Math.abs(Math.hypot(port.dx,port.dy)-1)<1e-9);
  if(port.x*port.dx+port.y*port.dy<0)inward++;
  for(const t of tiles){const x=port.boatX-78*Math.sqrt(3)*(t.q+t.r/2),y=port.boatY-117*t.r;
   assert(Math.max(Math.abs(x),Math.abs(.5*x+Math.sqrt(3)/2*y),Math.abs(.5*x-Math.sqrt(3)/2*y))>78*Math.sqrt(3)/2,'Port center stays in water');
  }
 }
}
assert(inward>0,'Fixtures exercise bays facing toward the island center');
console.log('PASS: all coastal port centers stay in water on 80 wild maps, including inward-facing bays');
