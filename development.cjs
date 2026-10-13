const crypto=require('crypto');
const resources=require('./trading.cjs').resources;
const counts=Object.freeze({Knight:14,VictoryPoint:5,RoadBuilding:2,YearOfPlenty:2,Monopoly:2});
const commands=['BuyDevelopmentCard','PlayDevelopmentCard','PlaceFreeRoad'];
function begin(g){
  g.developmentDeck=Object.entries(counts).flatMap(([type,n])=>Array(n).fill(type));
  g.developmentHands=Object.fromEntries(g.players.map(id=>[id,[]]));g.developmentDiscard=[];
  g.knightsPlayed=Object.fromEntries(g.players.map(id=>[id,0]));g.turnNumber=0;g.nextDevelopmentId=0;g.developmentPlayed=false;g.freeRoadsRemaining=0;g.lastDevelopment=null;
}
function canBuy(g,id){return g.phase==='build'&&g.players[g.turn]===id&&g.developmentDeck.length>0&&['sheep','wheat','ore'].every(r=>g.resources[id][r]>=1);}
function playable(g,id,card,roadLocations){
  if(!['roll','build'].includes(g.phase)||g.players[g.turn]!==id||g.developmentPlayed||card.type==='VictoryPoint'||card.boughtTurn>=g.turnNumber)return false;
  if(card.type==='RoadBuilding')return roadLocations(g,id).length>0;
  if(card.type==='YearOfPlenty')return Object.values(g.bank).some(n=>n>0);
  return true;
}
function finish(g){g.phase=g.developmentReturnPhase||'build';delete g.developmentReturnPhase;g.freeRoadsRemaining=0;}
function act(g,id,message,random=crypto.randomInt,roadLocations){
  if(!commands.includes(message.type))return false;
  if(g.players[g.turn]!==id)throw new Error('It is another player’s turn.');
  if(message.type==='BuyDevelopmentCard'){
    if(!canBuy(g,id))throw new Error('Buy after rolling: one sheep, one wheat, one ore, and a card left in the deck are required.');
    const index=random(g.developmentDeck.length);
    if(!Number.isInteger(index)||index<0||index>=g.developmentDeck.length)throw new Error('Invalid server card draw.');
    const type=g.developmentDeck[index];
    for(const r of ['sheep','wheat','ore']){g.resources[id][r]--;g.bank[r]++;}
    g.developmentDeck.splice(index,1);g.developmentHands[id].push({id:++g.nextDevelopmentId,type,boughtTurn:g.turnNumber});return true;
  }
  if(message.type==='PlaceFreeRoad'){
    if(g.phase!=='free-road'||!roadLocations(g,id).includes(message.id))throw new Error('Choose a legal free-road location.');
    g.edges[message.id].owner=id;g.freeRoadsRemaining--;
    if(g.freeRoadsRemaining===0||!roadLocations(g,id).length)finish(g);return true;
  }
  const card=g.developmentHands[id].find(c=>c.id===message.cardId);
  if(!card||!playable(g,id,card,roadLocations))throw new Error('Play one older development card on your turn, before rolling or after resolving the dice.');
  // Validate the entire choice before consuming the card or changing any state.
  let chosen;
  if(card.type==='YearOfPlenty'){
    const needed=Math.min(2,Object.values(g.bank).reduce((a,b)=>a+b,0));
    if(!Array.isArray(message.resources)||message.resources.length!==needed||message.resources.some(r=>!resources.includes(r)))throw new Error(`Choose ${needed} available resources.`);
    chosen={};for(const r of message.resources)chosen[r]=(chosen[r]||0)+1;
    if(Object.entries(chosen).some(([r,n])=>g.bank[r]<n))throw new Error('Those resources are not available in the bank.');
  }
  if(card.type==='Monopoly'&&!resources.includes(message.resource))throw new Error('Choose a resource for Monopoly.');
  g.developmentHands[id].splice(g.developmentHands[id].indexOf(card),1);g.developmentDiscard.push(card.type);g.developmentPlayed=true;g.lastDevelopment={player:id,type:card.type};
  if(card.type==='Knight'){g.knightsPlayed[id]++;g.developmentReturnPhase=g.phase;g.tradeOffer=null;g.phase='robber';g.victims=[];}
  if(card.type==='RoadBuilding'){g.developmentReturnPhase=g.phase;g.tradeOffer=null;g.freeRoadsRemaining=Math.min(2,15-g.edges.filter(e=>e.owner===id).length);g.phase='free-road';}
  if(card.type==='YearOfPlenty')for(const [r,n]of Object.entries(chosen)){g.bank[r]-=n;g.resources[id][r]+=n;}
  if(card.type==='Monopoly')for(const player of g.players)if(player!==id){g.resources[id][message.resource]+=g.resources[player][message.resource];g.resources[player][message.resource]=0;}
  return true;
}
function view(g,id,roadLocations){
  const cards=(g.developmentHands[id]||[]).map(c=>({id:c.id,type:c.type,newThisTurn:c.boughtTurn===g.turnNumber,playable:playable(g,id,c,roadLocations)}));
  return {cards,remaining:g.developmentDeck.length,canBuy:canBuy(g,id),playedThisTurn:g.developmentPlayed,privateVictoryPoints:cards.filter(c=>c.type==='VictoryPoint').length,freeRoadsRemaining:g.freeRoadsRemaining,legalFreeRoads:g.phase==='free-road'&&g.players[g.turn]===id?roadLocations(g,id):[],lastPlayed:g.lastDevelopment};
}
function botAction(g,id,roadLocations){
  if(g.phase==='free-road')return {type:'PlaceFreeRoad',id:roadLocations(g,id)[0]};
  for(const card of g.developmentHands[id])if(playable(g,id,card,roadLocations)){
    const move={type:'PlayDevelopmentCard',cardId:card.id};
    if(card.type==='Monopoly')move.resource=resources.slice().sort((a,b)=>g.resources[id][a]-g.resources[id][b])[0];
    if(card.type==='YearOfPlenty'){
      const bank={...g.bank};move.resources=[];
      for(let i=0;i<2;i++){const r=resources.filter(r=>bank[r]>0).sort((a,b)=>g.resources[id][a]-g.resources[id][b])[0];if(!r)break;move.resources.push(r);bank[r]--;}
    }
    return move;
  }
  return null;
}
module.exports={counts,commands,begin,canBuy,playable,act,view,finish,botAction};
