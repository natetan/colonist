const crypto = require('crypto');
const placement = require('./game.cjs');
const trading = require('./trading.cjs');
const development = require('./development.cjs');
const scoring = require('./scoring.cjs');
const costs = { BuildRoad:{wood:1,brick:1}, BuildSettlement:{wood:1,brick:1,wheat:1,sheep:1}, BuildCity:{wheat:2,ore:3} };
const total = hand => Object.values(hand).reduce((a,b)=>a+b,0);
const current = g => g.players[g.turn];
function begin(g, tiles) {
  g.turn = 0; g.phase = 'roll'; g.dice = null; g.robber = tiles.findIndex(t=>t.resource==='desert'); g.discards = {}; g.victims = [];
  g.bank = Object.fromEntries(['wood','brick','sheep','wheat','ore'].map(r=>[r,19-g.players.reduce((n,id)=>n+g.resources[id][r],0)]));
  g.tradeOffer=null;g.tradeSequence=0;
  development.begin(g);
  scoring.refresh(g);
}
function affordable(g,id,type) { return Object.entries(costs[type]).every(([r,n])=>g.resources[id][r]>=n); }
function buildLocations(g,id,type) {
  if (!affordable(g,id,type)) return [];
  if (type==='BuildCity') return g.vertices.filter(v=>v.owner===id&&!v.city).length && g.vertices.filter(v=>v.owner===id&&v.city).length<4 ? g.vertices.filter(v=>v.owner===id&&!v.city).map(v=>v.id) : [];
  if (type==='BuildSettlement') return g.vertices.filter(v=>v.owner===id&&!v.city).length<5 ? placement.legalVertices(g).filter(v=>g.edges.some(e=>e.owner===id&&(e.a===v||e.b===v))) : [];
  return roadLocations(g,id);
}
function roadLocations(g,id){
  if (g.edges.filter(e=>e.owner===id).length>=15) return [];
  return g.edges.filter(e=>e.owner===null&&[e.a,e.b].some(v=>g.vertices[v].owner===id || (g.vertices[v].owner===null&&g.edges.some(other=>other.owner===id&&(other.a===v||other.b===v))))).map(e=>e.id);
}
function applyAct(g, tiles, id, message, random = crypto.randomInt, developmentRandom=crypto.randomInt) {
  if (!g.players.includes(id)) throw new Error('You are not playing in this match.');
  const type = message.type;
  if(development.act(g,id,message,developmentRandom,roadLocations))return;
  if(trading.act(g,id,message))return;
  if (type==='Discard') {
    if (g.phase!=='discard'||!g.discards[id]) throw new Error('You do not need to discard.');
    const cards=message.cards;
    if (!cards||typeof cards!=='object'||Array.isArray(cards)||Object.keys(cards).some(r=>!Object.hasOwnProperty.call(g.resources[id],r))) throw new Error('Choose valid resources to discard.');
    if (Object.entries(cards).some(([r,n])=>!Number.isInteger(n)||n<0||n>g.resources[id][r])||total(cards)!==g.discards[id]) throw new Error(`Discard exactly ${g.discards[id]} cards from your hand.`);
    for(const [r,n] of Object.entries(cards)){g.resources[id][r]-=n;g.bank[r]+=n;} delete g.discards[id];
    if(!Object.keys(g.discards).length)g.phase='robber'; return;
  }
  if(current(g)!==id)throw new Error('It is another player’s turn.');
  if(type==='RollDice') {
    if(g.phase!=='roll')throw new Error('You can roll only once at the start of your turn.');
    g.dice=[random(1,7),random(1,7)]; const sum=total(g.dice);g.production={sequence:(g.production?.sequence||0)+1,transfers:[]};
    if(sum===7){ for(const player of g.players)if(total(g.resources[player])>7)g.discards[player]=Math.floor(total(g.resources[player])/2);g.phase=Object.keys(g.discards).length?'discard':'robber';return; }
    const due={},sources=[],paid={};
    tiles.forEach((tile,i)=>{if(tile.number!==sum||i===g.robber||tile.resource==='desert')return;for(const v of g.vertices)if(v.owner&&v.tiles.includes(i)){const key=tile.resource;due[key] ||= {};due[key][v.owner]=(due[key][v.owner]||0)+(v.city?2:1);sources.push({tile:i,player:v.owner,resource:key,amount:v.city?2:1});}});
    for(const [r,players]of Object.entries(due)){const amount=total(players);if(g.bank[r]>=amount){for(const [player,n]of Object.entries(players)){g.resources[player][r]+=n;g.bank[r]-=n;paid[r+":"+player]=n;}}else if(Object.keys(players).length===1){const player=Object.keys(players)[0];paid[r+":"+player]=g.bank[r];g.resources[player][r]+=g.bank[r];g.bank[r]=0;}}
    for(const source of sources){const key=source.resource+':'+source.player,n=Math.min(source.amount,paid[key]||0);if(n){g.production.transfers.push({...source,amount:n});paid[key]-=n;}}
    g.phase='build';return;
  }
  if(type==='MoveRobber') {
    if(g.phase!=='robber'||!Number.isInteger(message.id)||!tiles[message.id]||message.id===g.robber)throw new Error('Move the robber to a different tile.');
    g.robber=message.id;g.victims=[...new Set(g.vertices.filter(v=>v.owner&&v.owner!==id&&v.tiles.includes(g.robber)&&total(g.resources[v.owner])>0).map(v=>v.owner))];if(g.victims.length){g.phase='steal';if(g.victims.length===1)act(g,tiles,id,{type:'Steal',player:g.victims[0]},random,developmentRandom);}else development.finish(g);return;
  }
  if(type==='Steal') {
    if(g.phase!=='steal'||!g.victims.includes(message.player))throw new Error('Choose a neighboring opponent with cards.');
    const hand=g.resources[message.player];let pick=random(total(hand));for(const[r,n]of Object.entries(hand)){if(pick<n){hand[r]--;g.resources[id][r]++;break;}pick-=n;}g.victims=[];development.finish(g);return;
  }
  if(g.phase!=='build')throw new Error('Finish rolling or resolving the robber first.');
  if(type==='EndTurn'){g.tradeDecline=null;g.tradeOffer=null;g.turn=(g.turn+1)%g.players.length;g.turnNumber++;g.developmentPlayed=false;g.dice=null;g.phase='roll';return;}
  if(!costs[type]||!buildLocations(g,id,type).includes(message.id))throw new Error('You cannot afford that piece or its location is invalid.');
  for(const[r,n]of Object.entries(costs[type])){g.resources[id][r]-=n;g.bank[r]+=n;}
  if(type==='BuildRoad')g.edges[message.id].owner=id;else if(type==='BuildCity')g.vertices[message.id].city=true;else g.vertices[message.id].owner=id;
}
function act(g,tiles,id,message,random=crypto.randomInt,developmentRandom=crypto.randomInt){
  if(g.winner||g.phase==='finished')throw new Error('The match has finished. Create a new room to play again.');
  applyAct(g,tiles,id,message,random,developmentRandom);
  scoring.refresh(g);
}
function botAction(g,tiles,id) {
  if(g.winner||g.phase==='finished')return null;
  if(g.discards[id]){let left=g.discards[id];const cards={};for(const[r,n]of Object.entries(g.resources[id])){cards[r]=Math.min(left,n);left-=cards[r];}return{type:'Discard',cards};}
  if(current(g)!==id)return null;
  const cardMove=development.botAction(g,id,roadLocations);if(cardMove)return cardMove;
  if(g.phase==='roll')return{type:'RollDice'};
  if(g.phase==='robber'){const target=tiles.findIndex((t,i)=>i!==g.robber&&g.vertices.some(v=>v.owner&&v.owner!==id&&v.tiles.includes(i)));return{type:'MoveRobber',id:target<0?(g.robber+1)%tiles.length:target};}
  if(g.phase==='steal')return{type:'Steal',player:g.victims[0]};
  if(g.phase==='build'){for(const type of ['BuildCity','BuildSettlement','BuildRoad']){const ids=buildLocations(g,id,type);if(ids.length)return{type,id:ids[0]};}if(development.canBuy(g,id))return{type:'BuyDevelopmentCard'};
    // Plan with only this bot's hand and the public bank/network. Preserve cards needed by the goal.
    const simulated={...g,resources:{[id]:Object.fromEntries(trading.resources.map(r=>[r,19]))}},goals=Object.entries(costs).filter(([type])=>buildLocations(simulated,id,type).length).map(([,cost])=>cost);
    if(g.developmentDeck.length)goals.push({sheep:1,wheat:1,ore:1});
    goals.sort((a,b)=>Object.entries(a).reduce((n,[r,k])=>n+Math.max(0,k-g.resources[id][r]),0)-Object.entries(b).reduce((n,[r,k])=>n+Math.max(0,k-g.resources[id][r]),0));
    const rates=trading.rates(g,id);
    for(const goal of goals){const receive=trading.resources.find(r=>g.resources[id][r]<(goal[r]||0)&&g.bank[r]>0),give=trading.resources.find(r=>r!==receive&&g.resources[id][r]>=(goal[r]||0)+rates[r]);if(receive&&give)return{type:'BankTrade',give,receive};}
    return{type:'EndTurn'};}
  return null;
}
module.exports={begin,act,buildLocations,roadLocations,botAction,current,costs};
