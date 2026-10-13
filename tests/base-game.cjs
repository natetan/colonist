const assert=require('assert/strict'),rules=require('../game.cjs'),turns=require('../turns.cjs'),trading=require('../trading.cjs');
const tiles=[];for(let r=-2;r<=2;r++)for(let q=Math.max(-2,-r-2);q<=Math.min(2,-r+2);q++)tiles.push({q,r,resource:tiles.length===18?'desert':'wood',number:6});
function fixture(){const g=rules.start(tiles,['A','B']);turns.begin(g,tiles);return g;}
function reserve(g,id,r,n){g.bank[r]+=g.resources[id][r]-n;g.resources[id][r]=n;}
{
 const g=fixture();const corner=g.vertices.find(v=>v.tiles.length===3&&!v.tiles.includes(18));corner.owner='A';corner.city=true;reserve(g,'B','wood',18);turns.act(g,tiles,'A',{type:'RollDice'},()=>3);assert.equal(g.resources.A.wood,1);assert.equal(g.bank.wood,0);assert.equal(g.resources.B.wood,18);
}
{
 const g=fixture();const vertices=g.vertices.filter(v=>v.tiles.length===3&&!v.tiles.includes(18));vertices[0].owner='A';vertices[1].owner='B';reserve(g,'B','wood',18);turns.act(g,tiles,'A',{type:'RollDice'},()=>3);assert.equal(g.resources.A.wood,0);assert.equal(g.resources.B.wood,18);assert.equal(g.bank.wood,1);
}
{
 const g=fixture();g.phase='build';for(const r of trading.resources)reserve(g,'A',r,10);
 const road=g.edges[0];road.owner='A';g.vertices[road.a].owner='A';g.edges.find(e=>e.id!==road.id&&(e.a===road.b||e.b===road.b)).owner='A';assert(turns.buildLocations(g,'A','BuildSettlement').length);
 // Set five physical settlement pieces, then upgrade one to return a settlement piece.
 for(const v of g.vertices.filter(v=>!v.owner).slice(0,4))v.owner='A';assert.equal(turns.buildLocations(g,'A','BuildSettlement').length,0);
 const id=g.vertices.find(v=>v.owner==='A').id;turns.act(g,tiles,'A',{type:'BuildCity',id});assert.equal(g.vertices.filter(v=>v.owner==='A'&&!v.city).length,4);
 // Four cities use all available city pieces.
 for(const v of g.vertices.filter(v=>v.owner==='A'&&!v.city).slice(0,3))v.city=true;assert.equal(turns.buildLocations(g,'A','BuildCity').length,0);
}
{
 const g=fixture();g.phase='build';g.vertices[0].owner='A';g.harbors=[{edge:0,resource:'wood'}];reserve(g,'A','wood',3);
 // Harbor access lets the bot retain one wood for a road while acquiring its brick.
 const move=turns.botAction(g,tiles,'A');assert.deepEqual(move,{type:'BankTrade',give:'wood',receive:'brick'});turns.act(g,tiles,'A',move);assert.equal(g.resources.A.wood,1);assert.equal(g.resources.A.brick,1);assert.equal(turns.botAction(g,tiles,'A').type,'BuildRoad');
 const total=Object.fromEntries(trading.resources.map(r=>[r,g.bank[r]+g.players.reduce((n,id)=>n+g.resources[id][r],0)]));assert(Object.values(total).every(n=>n===19));
}
console.log('PASS: single-recipient partial production, multi-recipient shortage cancellation, physical settlement/city caps, settlement return on upgrade, bots conserve goal cards during harbor trades');
