// Observed axial geometry from modules 25204, 15123, and 29267.
// Produces local geometry indexes, not the full original map-state schema.
const key = point => `${point.x},${point.y},${point.z}`;
function faceCorners(x, y) {
  return [[x,y,0],[x+1,y-1,1],[x,y+1,0],[x,y,1],[x-1,y+1,0],[x,y-1,1]].map(([x,y,z]) => ({x,y,z}));
}
function faceEdges(x, y) {
  return [[x+1,y-1,2],[x+1,y,1],[x,y+1,0],[x,y,2],[x,y,1],[x,y,0]].map(([x,y,z]) => ({x,y,z}));
}
function endpoints({x,y,z}) {
  if (z === 0) return [{x,y:y-1,z:1},{x,y,z:0}];
  if (z === 1) return [{x:x-1,y:y+1,z:0},{x,y:y-1,z:1}];
  if (z === 2) return [{x,y,z:1},{x:x-1,y:y+1,z:0}];
  throw new Error('Invalid edge direction');
}
function createGeometry(faces) {
  const corners = [], edges = [], tiles = [];
  const cornerIds = new Map(), edgeIds = new Map(), seenFaces = new Set();
  const intern = (point, items, ids) => {
    const id = key(point);
    if (!ids.has(id)) { ids.set(id, items.length); items.push(point); }
    return ids.get(id);
  };
  for (const {x,y} of faces) {
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) throw new Error('Integer axial coordinates required');
    const id = `${x},${y}`;
    if (seenFaces.has(id)) throw new Error('Duplicate face');
    seenFaces.add(id);
    tiles.push({ x,y, corners: faceCorners(x,y).map(p => intern(p,corners,cornerIds)), edges: faceEdges(x,y).map(p => intern(p,edges,edgeIds)) });
  }
  return { tiles, corners, edges: edges.map(edge => ({...edge, endpoints: endpoints(edge).map(p => cornerIds.get(key(p)))})) };
}
const TILE_TYPE = Object.freeze({ desert: 0, wood: 1, brick: 2, sheep: 3, wheat: 4, ore: 5 });
function serializeLandMap(tiles) {
  const geometry = createGeometry(tiles.map(tile => ({x:tile.q,y:tile.r})));
  const tileHexStates = {};
  tiles.forEach((tile,index) => {
    if (!Object.prototype.hasOwnProperty.call(TILE_TYPE,tile.resource)) throw new Error('Unsupported land resource');
    const diceNumber = tile.resource === 'desert' ? 0 : tile.number;
    if (!Number.isInteger(diceNumber) || (diceNumber !== 0 && (diceNumber<2 || diceNumber>12 || diceNumber===7)) || (tile.resource !== 'desert' && diceNumber===0)) throw new Error('Invalid land dice number');
    tileHexStates[index] = {x:tile.q,y:tile.r,type:TILE_TYPE[tile.resource],diceNumber};
  });
  const indexed = entries => Object.fromEntries(entries.map((entry,index) => [index,{x:entry.x,y:entry.y,z:entry.z}]));
  return { tileHexStates, tileCornerStates:indexed(geometry.corners), tileEdgeStates:indexed(geometry.edges), portEdgeStates:{} };
}
module.exports = { faceCorners, faceEdges, endpoints, createGeometry, TILE_TYPE, serializeLandMap };
