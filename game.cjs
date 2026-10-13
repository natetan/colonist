const palette = ['#ee795b', '#69aefa', '#edc45d', '#75c18c', '#d592dc', '#ffffff'];
function topology(tiles) {
  const vertices = [], edges = [], lookup = new Map(), edgeLookup = new Map();
  tiles.forEach((tile, tileIndex) => {
    const x = 78 * Math.sqrt(3) * (tile.q + tile.r / 2), y = 117 * tile.r;
    const ids = Array.from({ length: 6 }, (_, i) => {
      const angle = (60 * i - 30) * Math.PI / 180;
      const vx = x + 78 * Math.cos(angle), vy = y + 78 * Math.sin(angle);
      const key = `${Math.round(vx * 1000)},${Math.round(vy * 1000)}`;
      if (!lookup.has(key)) { lookup.set(key, vertices.length); vertices.push({ id: vertices.length, x: vx, y: vy, tiles: [], owner: null }); }
      const id = lookup.get(key); vertices[id].tiles.push(tileIndex); return id;
    });
    ids.forEach((a, i) => { const b = ids[(i + 1) % 6], key = [a, b].sort((a,b) => a-b).join(','); if (!edgeLookup.has(key)) { edgeLookup.set(key, edges.length); edges.push({ id: edges.length, a, b, owner: null }); } });
  });
  return { vertices, edges };
}
function legalVertices(game) {
  return game.vertices.filter(v => v.owner === null && !game.edges.some(e => (e.a === v.id && game.vertices[e.b].owner !== null) || (e.b === v.id && game.vertices[e.a].owner !== null))).map(v => v.id);
}
function legalEdges(game) { return game.edges.filter(e => e.owner === null && (e.a === game.pendingVertex || e.b === game.pendingVertex)).map(e => e.id); }
function start(tiles, ids, solo = false) {
  return { ...topology(tiles), players: ids, colors: Object.fromEntries(ids.map((id, i) => [id, palette[i]])), order: [...ids, ...ids.slice().reverse()], step: 0, phase: 'settlement', pendingVertex: null, solo, resources: Object.fromEntries(ids.map(id => [id, { wood: 0, brick: 0, wheat: 0, sheep: 0, ore: 0 }])) };
}
function place(game, tiles, playerId, type, id) {
  if (!['settlement','road'].includes(game.phase)) throw new Error('Initial placement is complete. Regular turns are not implemented yet.');
  if (game.order[game.step] !== playerId) throw new Error('It is another player’s turn.');
  if (type === 'PlaceSettlement' && game.phase === 'settlement') {
    if (!legalVertices(game).includes(id)) throw new Error('Choose an empty corner at least two edges from another settlement.');
    game.vertices[id].owner = playerId; game.pendingVertex = id; game.phase = 'road';
    if (game.step >= game.players.length) for (const tileIndex of game.vertices[id].tiles) { const resource = tiles[tileIndex].resource; if (resource !== 'desert') game.resources[playerId][resource]++; }
  } else if (type === 'PlaceRoad' && game.phase === 'road') {
    if (!legalEdges(game).includes(id)) throw new Error('Place your road next to the settlement you just placed.');
    game.edges[id].owner = playerId; game.pendingVertex = null; game.step++; game.phase = game.step === game.order.length ? 'complete' : 'settlement';
  } else throw new Error(`Place a ${game.phase} first.`);
}
function botMove(game, tiles) {
  if (game.phase === 'complete') return null;
  if (game.phase === 'road') return { type: 'PlaceRoad', id: legalEdges(game)[0] };
  const candidates = legalVertices(game);
  // Favor resource production; ties use stable corner IDs for reproducible tests.
  const score = id => game.vertices[id].tiles.reduce((total, index) => {
    const tile = tiles[index];
    return total + (tile.resource === 'desert' ? 0 : 6 - Math.abs(7 - tile.number));
  }, 0);
  candidates.sort((a, b) => score(b) - score(a) || a - b);
  return { type: 'PlaceSettlement', id: candidates[0] };
}
module.exports = { start, place, legalVertices, legalEdges, topology, botMove };
