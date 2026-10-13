const assert=require('assert/strict'),score=require('../scoring.cjs'),turns=require('../turns.cjs'),rules=require('../game.cjs');
function graph(pairs){const n=1+Math.max(...pairs.flat());return{vertices:Array.from({length:n},(_,id)=>({id,owner:null})),edges:pairs.map(([a,b],id)=>({id,a,b,owner:'A'}))};}
const line=graph([[0,1],[1,2],[2,3],[3,4],[4,5]]);assert.equal(score.longestRoad(line,'A'),5);assert.equal(score.longestRoad(line,'B'),0);
line.vertices[2].owner='B';assert.equal(score.longestRoad(line,'A'),3);line.vertices[2].owner='A';assert.equal(score.longestRoad(line,'A'),5);
const fork=graph([[0,1],[1,2],[2,3],[1,4],[4,5]]);assert.equal(score.longestRoad(fork,'A'),4);
const loop=graph([[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,6],[6,7]]);assert.equal(score.longestRoad(loop,'A'),8);loop.vertices[0].owner='B';assert.equal(score.longestRoad(loop,'A'),6);
const disjoint=graph([[0,1],[1,2],[3,4],[4,5],[5,6]]);assert.equal(score.longestRoad(disjoint,'A'),3);
assert.equal(score.holder({A:4,B:4},null,5),null);assert.equal(score.holder({A:5,B:5},null,5),null);assert.equal(score.holder({A:5,B:5},'A',5),'A');assert.equal(score.holder({A:5,B:6},'A',5),'B');assert.equal(score.holder({A:4,B:5,C:5},'A',5),null);assert.equal(score.holder({A:3,B:2},null,3),'A');assert.equal(score.holder({A:3,B:3},'A',3),'A');assert.equal(score.holder({A:3,B:4},'A',3),'B');
const tiles=[];for(let r=-2;r<=2;r++)for(let q=Math.max(-2,-r-2);q<=Math.min(2,-r+2);q++)tiles.push({q,r,resource:tiles.length===18?'desert':'wood',number:6});
function fixture(){const g=rules.start(tiles,['A','B']);while(g.phase!=='complete'){const m=rules.botMove(g,tiles);rules.place(g,tiles,g.order[g.step],m.type,m.id);}turns.begin(g,tiles);return g;}
function vp(g,id){const i=g.developmentDeck.indexOf('VictoryPoint');g.developmentDeck.splice(i,1);g.developmentHands[id].push({id:++g.nextDevelopmentId,type:'VictoryPoint',boughtTurn:g.turnNumber});}
function cityPoints(g,id,n){g.vertices.forEach(v=>{if(v.owner===id)v.owner=null;});for(const v of g.vertices.filter(v=>!v.owner).slice(0,n)){v.owner=id;v.city=true;}}
{
 const g=fixture();cityPoints(g,'A',4);vp(g,'A');assert.equal(score.publicPoints(g,'A'),8);assert.equal(score.totalPoints(g,'A'),9);score.refresh(g);assert(!g.winner);assert.equal(score.view(g,'B').yourPoints,2);assert.equal(score.view(g,'B').revealedVictoryPoints,0);assert.equal(score.view(g,'B').winningPoints,null);
 g.phase='build';for(const r of ['sheep','wheat','ore']){g.resources.A[r]++;g.bank[r]--;}
 const index=g.developmentDeck.indexOf('VictoryPoint');turns.act(g,tiles,'A',{type:'BuyDevelopmentCard'},()=>3,()=>index);
 assert.equal(g.winner,'A');assert.equal(g.phase,'finished');assert.equal(g.winningPoints,10);assert.equal(g.revealedVictoryPoints,2);assert.equal(g.developmentHands.A.at(-1).boughtTurn,g.turnNumber);
 const before=JSON.stringify(g);for(const type of ['EndTurn','RollDice','BuyDevelopmentCard','MoveRobber','BuildCity','OfferTrade','Discard']){assert.throws(()=>turns.act(g,tiles,'A',{type}),/finished/);assert.equal(JSON.stringify(g),before);}assert.equal(turns.botAction(g,tiles,'A'),null);
}
{
 const g=fixture();cityPoints(g,'B',4);vp(g,'B');vp(g,'B');g.phase='build';score.refresh(g);assert(!g.winner);turns.act(g,tiles,'A',{type:'EndTurn'});assert.equal(g.winner,'B');assert.equal(g.phase,'finished');assert.equal(g.dice,null);
}
{
 const g=fixture();cityPoints(g,'A',4);g.knightsPlayed.A=2;const i=g.developmentDeck.indexOf('Knight');g.developmentDeck.splice(i,1);const card={id:++g.nextDevelopmentId,type:'Knight',boughtTurn:-1};g.developmentHands.A.push(card);
 turns.act(g,tiles,'A',{type:'PlayDevelopmentCard',cardId:card.id});assert.equal(g.largestArmyHolder,'A');assert.equal(g.winner,'A');assert.deepEqual(g.victims,[]);assert.equal(g.developmentReturnPhase,undefined);
}
{
 const g=fixture();g.phase='build';g.vertices.forEach(v=>v.owner=null);g.edges.forEach(e=>e.owner=null);// Find a real five-edge route.
 function find(v,ids){if(ids.length===5)return ids;for(const e of g.edges.filter(e=>e.a===v||e.b===v)){if(ids.includes(e.id))continue;const next=find(e.a===v?e.b:e.a,[...ids,e.id]);if(next)return next;}return null;}
 const route=find(0,[]);assert(route);route.forEach(id=>g.edges[id].owner='A');score.refresh(g);assert.equal(g.longestRoadHolder,'A');assert(score.publicPoints(g,'A')>=2);
 // An opponent settlement can split an existing road and remove its award.
 const internal=route.slice(1).map(id=>g.edges[id]).find(e=>g.edges.filter(x=>x.owner==='A'&&(x.a===e.a||x.b===e.a)).length===2).a;g.vertices[internal].owner='B';score.refresh(g);assert.equal(g.longestRoadHolder,null);
}
console.log('PASS: longest-road trails, branches/loops, opponent blocking, award thresholds/ties/transfers, private scores, newly bought VP victory, own-turn wins, knight victory, finished-game lock');
