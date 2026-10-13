const {createGeometry, serializeLandMap} = require('../protocol-map.cjs');
const {topology} = require('../game.cjs');
const {createPreviewFixture, previewSettings} = require('./preview-fixture.cjs');
// Original color enum: Red, Blue, Orange, Green, Purple, White.
const colors = [1, 2, 3, 4, 10, 9];
const pointKey = (x,y) => `${Math.round(x*1000)},${Math.round(y*1000)}`;
function translateGeometry(board) {
  const geometry = createGeometry(board.map(t=>({x:t.q,y:t.r})));
  const local = topology(board);
  const cornerByPoint = new Map(geometry.corners.map((c,id)=>{
    const x=78*Math.sqrt(3)*(c.x+c.y/2), y=117*c.y+(c.z===0?-78:78);
    return [pointKey(x,y),id];
  }));
  const corners = local.vertices.map(v=>cornerByPoint.get(pointKey(v.x,v.y)));
  const edgeKey = (a,b)=>[a,b].sort((x,y)=>x-y).join(',');
  const edgeByEnds = new Map(geometry.edges.map((e,id)=>[edgeKey(...e.endpoints),id]));
  const edges = local.edges.map(e=>edgeByEnds.get(edgeKey(corners[e.a],corners[e.b])));
  if(corners.some(id=>id===undefined)||edges.some(id=>id===undefined))throw new Error('Renderer topology mismatch');
  return {corners,edges};
}
function presentBoard(snapshot) {
  const mapping = translateGeometry(snapshot.board);
  const fixture = createPreviewFixture(snapshot.board,previewSettings());
  const map = serializeLandMap(snapshot.board);
  const playerColors = Object.fromEntries(snapshot.players.filter(p=>p.playing).map((p,i)=>[p.id,colors[i%colors.length]]));
  if(snapshot.game){
    for(const v of snapshot.game.vertices)if(v.owner){
      const color=playerColors[v.owner];if(!color)throw new Error('Unknown building owner');
      Object.assign(map.tileCornerStates[mapping.corners[v.id]],{owner:color,buildingType:v.city?2:1});
    }
    for(const e of snapshot.game.edges)if(e.owner){
      const color=playerColors[e.owner];if(!color)throw new Error('Unknown road owner');
      Object.assign(map.tileEdgeStates[mapping.edges[e.id]],{owner:color,type:1});
    }
  }
  fixture.gameState.mapState=map;
  // Presentation contains public board data only; never duplicate player hands.
  return {fixture,mapping,playerColors,robber:snapshot.game?.robber??snapshot.board.findIndex(t=>t.resource==='desert')};
}
module.exports={translateGeometry,presentBoard};
