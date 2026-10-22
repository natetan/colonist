// Public awards and private score totals are computed from authoritative state.
function longestRoad(g,id){
  const roads=g.edges.filter(e=>e.owner===id),adj=new Map();
  for(const e of roads)for(const v of [e.a,e.b]){if(!adj.has(v))adj.set(v,[]);adj.get(v).push(e);}
  function walk(vertex,used){
    if(used.size&&g.vertices[vertex].owner&&g.vertices[vertex].owner!==id)return used.size;
    let best=used.size;
    for(const edge of adj.get(vertex)||[])if(!used.has(edge.id)){
      used.add(edge.id);best=Math.max(best,walk(edge.a===vertex?edge.b:edge.a,used));used.delete(edge.id);
    }
    return best;
  }
  let best=0;for(const v of adj.keys())best=Math.max(best,walk(v,new Set()));return best;
}
function holder(values,previous,minimum){
  const maximum=Math.max(minimum,...Object.values(values));const leaders=Object.keys(values).filter(id=>values[id]===maximum);
  if(leaders.includes(previous))return previous;
  return leaders.length===1?leaders[0]:null;
}
function privatePoints(g,id){return (g.developmentHands?.[id]||[]).filter(c=>c.type==='VictoryPoint').length;}
function publicPoints(g,id){
  return g.vertices.filter(v=>v.owner===id).reduce((n,v)=>n+(v.city?2:1),0)+(g.longestRoadHolder===id?2:0)+(g.largestArmyHolder===id?2:0);
}
function totalPoints(g,id){return publicPoints(g,id)+privatePoints(g,id);}
function refresh(g){
  if(g.winner)return;
  g.roadLengths=Object.fromEntries(g.players.map(id=>[id,longestRoad(g,id)]));
  g.longestRoadHolder=holder(g.roadLengths,g.longestRoadHolder,5);
  g.largestArmyHolder=holder(g.knightsPlayed,g.largestArmyHolder,3);
  const id=g.players[g.turn];
  if(totalPoints(g,id)>=(g.rules?.victoryPoints||10)){g.winner=id;g.winningPoints=totalPoints(g,id);g.revealedVictoryPoints=privatePoints(g,id);g.phase='finished';g.tradeOffer=null;g.discards={};g.victims=[];g.freeRoadsRemaining=0;delete g.developmentReturnPhase;}
}
function view(g,id){return {target:g.rules?.victoryPoints||10,yourPoints:totalPoints(g,id),longestRoad:g.longestRoadHolder||null,largestArmy:g.largestArmyHolder||null,roadLengths:g.roadLengths,winner:g.winner||null,winningPoints:g.winningPoints||null,revealedVictoryPoints:g.revealedVictoryPoints||0};}
module.exports={longestRoad,holder,privatePoints,publicPoints,totalPoints,refresh,view};
