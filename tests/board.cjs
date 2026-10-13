const assert=require('assert/strict'),board=require('../board.cjs'),rules=require('../game.cjs'),turns=require('../turns.cjs'),trading=require('../trading.cjs');
const count=a=>a.slice().sort().join(',');
for(let i=0;i<250;i++){
 const tiles=board.generate();assert.equal(count(tiles.map(t=>t.resource)),count(board.resourceBag));assert.equal(count(tiles.filter(t=>t.resource!=='desert').map(t=>t.number)),count(board.numberBag));assert.equal(tiles.find(t=>t.resource==='desert').number,null);
 const reds=tiles.filter(t=>t.number===6||t.number===8);for(const a of reds)for(const b of reds)if(a!==b)assert(!board.adjacent(a,b));
 const g=rules.topology(tiles),harbors=board.harbors(tiles),coast=board.coastline(tiles),ends=new Set();assert.equal(coast.length,30);assert.equal(harbors.length,9);assert.equal(harbors.filter(h=>h.resource===null).length,4);
 for(const r of trading.resources)assert.equal(harbors.filter(h=>h.resource===r).length,1);
 for(const h of harbors){assert(coast.includes(h.edge));const e=g.edges[h.edge];for(const v of [e.a,e.b]){assert(!ends.has(v));ends.add(v);}}
}
// Backtracking terminates even with a deterministic random source.
for(const random of [()=>0,n=>n-1]){const t=board.generate(random);assert.equal(t.length,19);assert.equal(board.harbors(t,random).length,9);}
const tiles=board.generate(()=>0),g=rules.start(tiles,['A','B']);g.harbors=board.harbors(tiles,()=>0);turns.begin(g,tiles);g.phase='build';
const generic=g.harbors.find(h=>h.resource===null),specific=g.harbors.find(h=>h.resource==='wood');
assert.deepEqual(Object.values(trading.rates(g,'A')),[4,4,4,4,4]);g.edges[generic.edge].owner='A';assert.equal(trading.rates(g,'A').wood,4);
g.vertices[g.edges[generic.edge].a].owner='B';assert.equal(trading.rates(g,'A').wood,4);assert.equal(trading.rates(g,'B').wood,3);
g.vertices[g.edges[generic.edge].a].owner='A';assert(Object.values(trading.rates(g,'A')).every(n=>n===3));g.vertices[g.edges[specific.edge].b].owner='A';g.vertices[g.edges[specific.edge].b].city=true;assert.equal(trading.rates(g,'A').wood,2);assert.equal(trading.rates(g,'A').ore,3);
g.resources.A.wood=2;g.bank.wood=17;const beforeOre=g.resources.A.ore;turns.act(g,tiles,'A',{type:'BankTrade',give:'wood',receive:'ore',rate:1});assert.equal(g.resources.A.wood,0);assert.equal(g.resources.A.ore,beforeOre+1);assert.equal(g.bank.wood,19);
g.resources.A.brick=3;g.bank.brick=16;turns.act(g,tiles,'A',{type:'BankTrade',give:'brick',receive:'wheat'});assert.equal(g.resources.A.brick,0);assert.equal(g.bank.brick,19);
const before=JSON.stringify(g);assert.throws(()=>turns.act(g,tiles,'A',{type:'BankTrade',give:'wood',receive:'ore',rate:0}),/matching/);assert.equal(JSON.stringify(g),before);
g.vertices[g.edges[specific.edge].b].owner=null;assert.equal(trading.rates(g,'A').wood,3);g.vertices[g.edges[generic.edge].a].owner=null;assert.equal(trading.rates(g,'A').wood,4);
console.log('PASS: 250 boards with exact bags, separated reds, nine disjoint coastal harbors, deterministic generation, settlement/city ownership, best rates, no road/opponent access, harbor conservation, client-rate rejection');
