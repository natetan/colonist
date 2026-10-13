const assert = require('assert/strict');
const { createGeometry } = require('../protocol-map.cjs');
const faces = [];
for (let x=-2;x<=2;x++) for(let y=-2;y<=2;y++) if(Math.abs(x+y)<=2) faces.push({x,y});
const map = createGeometry(faces);
assert.equal(map.tiles.length,19);
assert.equal(map.corners.length,54);
assert.equal(map.edges.length,72);
assert.equal(map.corners.length-map.edges.length+map.tiles.length,1);
for (const edge of map.edges) {
  assert.equal(new Set(edge.endpoints).size,2);
  for (const index of edge.endpoints) assert(Number.isInteger(index) && index>=0 && index<54);
}
for (const tile of map.tiles) {
  assert.equal(new Set(tile.corners).size,6);
  for (let i=0;i<6;i++) {
    const ends = map.edges[tile.edges[i]].endpoints;
    assert(ends.includes(tile.corners[i]));
    assert(ends.includes(tile.corners[(i+1)%6]));
  }
}
const pair=createGeometry([{x:0,y:0},{x:1,y:0}]);
assert.equal(pair.corners.length,10);
assert.equal(pair.edges.length,11);
assert.throws(()=>createGeometry([{x:0,y:0},{x:0,y:0}]));
console.log('PASS: 19-hex geometry, shared borders, corner/edge incidence');
