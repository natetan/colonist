const assert=require('assert/strict'),rules=require('../game.cjs'),turns=require('../turns.cjs'),dev=require('../development.cjs');
const tiles=[];for(let r=-2;r<=2;r++)for(let q=Math.max(-2,-r-2);q<=Math.min(2,-r+2);q++)tiles.push({q,r,resource:tiles.length===18?'desert':'wood',number:6});
function fixture(phase='build'){const g=rules.start(tiles,['A','B']);while(g.phase!=='complete'){const m=rules.botMove(g,tiles);rules.place(g,tiles,g.order[g.step],m.type,m.id);}turns.begin(g,tiles);g.phase=phase;return g;}
function hand(g,id,values){for(const r of Object.keys(g.resources[id])){g.bank[r]+=g.resources[id][r]-(values[r]||0);g.resources[id][r]=values[r]||0;}}
function card(g,type,boughtTurn=-1,id='A'){const index=g.developmentDeck.indexOf(type);assert(index>=0);g.developmentDeck.splice(index,1);const c={id:++g.nextDevelopmentId,type,boughtTurn};g.developmentHands[id].push(c);return c;}
function act(g,m,id='A'){turns.act(g,tiles,id,m,()=>0,()=>0);}
function play(g,c,extra={}){act(g,{type:'PlayDevelopmentCard',cardId:c.id,...extra});}
function unchanged(g,fn){const before=JSON.stringify(g);assert.throws(fn);assert.equal(JSON.stringify(g),before);}
function conserved(g){for(const r of Object.keys(g.bank))assert.equal(g.bank[r]+g.players.reduce((n,id)=>n+g.resources[id][r],0),19);assert.equal(g.developmentDeck.length+g.developmentDiscard.length+Object.values(g.developmentHands).reduce((n,h)=>n+h.length,0),25);}
{
 const g=fixture();assert.equal(g.developmentDeck.length,25);for(const[t,n]of Object.entries(dev.counts))assert.equal(g.developmentDeck.filter(c=>c===t).length,n);
 hand(g,'A',{sheep:2,wheat:2,ore:2});act(g,{type:'BuyDevelopmentCard'});const c=g.developmentHands.A[0];assert.equal(c.type,'Knight');assert.equal(g.resources.A.sheep,1);assert.equal(g.developmentDeck.length,24);unchanged(g,()=>play(g,c));act(g,{type:'BuyDevelopmentCard'});assert.equal(g.developmentHands.A.length,2);unchanged(g,()=>act(g,{type:'BuyDevelopmentCard'}));
 assert.equal(dev.view(g,'B',turns.roadLocations).cards.length,0);assert.equal(dev.view(g,'A',turns.roadLocations).cards.length,2);conserved(g);
 const old=card(g,'Monopoly');play(g,old,{resource:'wood'});unchanged(g,()=>play(g,c));
 act(g,{type:'EndTurn'});g.phase='build';act(g,{type:'EndTurn'},'B');assert(!g.developmentPlayed);assert(dev.view(g,'A',turns.roadLocations).cards[0].playable);
 const bad=fixture();hand(bad,'A',{sheep:1,wheat:1,ore:1});unchanged(bad,()=>turns.act(bad,tiles,'A',{type:'BuyDevelopmentCard'},()=>0,()=>25));bad.phase='roll';unchanged(bad,()=>act(bad,{type:'BuyDevelopmentCard'}));bad.phase='build';unchanged(bad,()=>act(bad,{type:'BuyDevelopmentCard'},'B'));
}
for(const phase of ['roll','build']){
 const g=fixture(phase);hand(g,'A',{wood:9});hand(g,'B',{wood:2});const c=card(g,'Knight');play(g,c);assert.equal(g.phase,'robber');assert.deepEqual(g.discards,{});assert.equal(g.knightsPlayed.A,1);unchanged(g,()=>act(g,{type:'EndTurn'}));
 const tile=g.vertices.find(v=>v.owner==='B').tiles.find(i=>i!==g.robber);act(g,{type:'MoveRobber',id:tile});assert.equal(g.phase,phase);assert.deepEqual(g.victims,[]);assert.equal(g.resources.A.wood,10);conserved(g);
 const secondKnight=card(g,'Knight');unchanged(g,()=>play(g,secondKnight));
}
{
 const g=fixture('roll');hand(g,'A',{});const c=card(g,'RoadBuilding');const old=g.edges.filter(e=>e.owner==='A').length;play(g,c);assert.equal(g.phase,'free-road');unchanged(g,()=>act(g,{type:'PlaceFreeRoad',id:-1}));act(g,{type:'PlaceFreeRoad',id:turns.roadLocations(g,'A')[0]});assert.equal(g.freeRoadsRemaining,1);act(g,{type:'PlaceFreeRoad',id:turns.roadLocations(g,'A')[0]});assert.equal(g.phase,'roll');assert.equal(g.edges.filter(e=>e.owner==='A').length,old+2);assert.equal(g.resources.A.wood,0);conserved(g);
 const limited=fixture();while(limited.edges.filter(e=>e.owner==='A').length<14)limited.edges[turns.roadLocations(limited,'A')[0]].owner='A';play(limited,card(limited,'RoadBuilding'));assert.equal(limited.freeRoadsRemaining,1);act(limited,{type:'PlaceFreeRoad',id:turns.roadLocations(limited,'A')[0]});assert.equal(limited.phase,'build');const cap=card(limited,'RoadBuilding');limited.developmentPlayed=false;unchanged(limited,()=>play(limited,cap));
 const blocked=fixture();blocked.vertices.forEach(v=>v.owner='B');const blockedCard=card(blocked,'RoadBuilding');unchanged(blocked,()=>play(blocked,blockedCard));
}
{
 const g=fixture();const c=card(g,'YearOfPlenty');const wood=g.resources.A.wood;unchanged(g,()=>play(g,c,{resources:['wood']}));unchanged(g,()=>play(g,c,{resources:['invalid','ore']}));play(g,c,{resources:['wood','wood']});assert.equal(g.resources.A.wood,wood+2);conserved(g);
 const low=fixture();for(const r of Object.keys(low.bank))hand(low,'B',{...low.resources.B,[r]:r==='ore'?18:19});hand(low,'A',{}); // normalize bank after removing A's starting cards
 for(const r of Object.keys(low.bank))hand(low,'B',{...low.resources.B,[r]:r==='ore'?18:19});
 const lowCard=card(low,'YearOfPlenty');unchanged(low,()=>play(low,lowCard,{resources:['ore','ore']}));play(low,lowCard,{resources:['ore']});assert.equal(low.bank.ore,0);conserved(low);
 const emptyCard=card(low,'YearOfPlenty');low.developmentPlayed=false;unchanged(low,()=>play(low,emptyCard,{resources:[]}));
}
{
 const g=fixture();hand(g,'A',{sheep:1});hand(g,'B',{sheep:7,wood:2});const bank={...g.bank};const c=card(g,'Monopoly');unchanged(g,()=>play(g,c,{resource:'gold'}));play(g,c,{resource:'sheep'});assert.equal(g.resources.A.sheep,8);assert.equal(g.resources.B.sheep,0);assert.equal(g.resources.B.wood,2);assert.deepEqual(g.bank,bank);conserved(g);
 const vp=card(g,'VictoryPoint');g.developmentPlayed=false;unchanged(g,()=>play(g,vp));assert.equal(dev.view(g,'A',turns.roadLocations).privateVictoryPoints,1);assert.equal(dev.view(g,'B',turns.roadLocations).privateVictoryPoints,0);
}
{
 const g=fixture('roll');card(g,'RoadBuilding');act(g,turns.botAction(g,tiles,'A'));while(g.phase==='free-road')act(g,turns.botAction(g,tiles,'A'));assert.equal(g.phase,'roll');assert.equal(turns.botAction(g,tiles,'A').type,'RollDice');conserved(g);
}
console.log('PASS: private 25-card deck, costs, atomic rejection, card age/turn limits, pre/post-roll knights, free-road network/caps, bank shortages, monopoly conservation, private VP, bots');
