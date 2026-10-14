const assert=require('assert');
const rules=require('../game.cjs');
const turns=require('../turns.cjs');
const tiles=[];for(let r=-2;r<=2;r++)for(let q=Math.max(-2,-r-2);q<=Math.min(2,-r+2);q++)tiles.push({q,r,resource:tiles.length===18?'desert':'wood',number:6});
function fixture(){const g=rules.start(tiles,['A','B']);while(g.phase!=='complete'){const id=g.order[g.step],move=rules.botMove(g,tiles);rules.place(g,tiles,id,move.type,move.id);}turns.begin(g,tiles);return g;}
const g=fixture();
assert.equal(g.phase,'roll');
assert.throws(()=>turns.act(g,tiles,'B',{type:'RollDice'}),/another player/);
assert.throws(()=>turns.act(g,tiles,'A',{type:'EndTurn'}),/Finish rolling/);
const before=g.resources.A.wood;turns.act(g,tiles,'A',{type:'RollDice'},()=>3);
assert.equal(g.phase,'build');assert(g.resources.A.wood>before);
assert.throws(()=>turns.act(g,tiles,'A',{type:'RollDice'}),/only once/);
assert.throws(()=>turns.act(g,tiles,'A',{type:'BuildCity',id:0}),/cannot afford/);
g.resources.A.brick=3;g.resources.A.wood=3;
const road=turns.buildLocations(g,'A','BuildRoad')[0];assert(Number.isInteger(road));turns.act(g,tiles,'A',{type:'BuildRoad',id:road});assert.equal(g.resources.A.brick,2);assert.equal(g.resources.A.wood,2);
assert.throws(()=>turns.act(g,tiles,'A',{type:'BuildRoad',id:road}),/invalid/);
g.resources.A.wheat=2;g.resources.A.ore=3;
const city=g.vertices.find(v=>v.owner==='A');turns.act(g,tiles,'A',{type:'BuildCity',id:city.id});assert(city.city);assert.equal(g.resources.A.ore,0);
turns.act(g,tiles,'A',{type:'EndTurn'});assert.equal(turns.current(g),'B');assert.equal(g.phase,'roll');
g.resources.A={wood:9,brick:0,sheep:0,wheat:0,ore:0};g.resources.B={wood:2,brick:0,sheep:0,wheat:0,ore:0};
let die=0;turns.act(g,tiles,'B',{type:'RollDice'},()=>++die===1?3:4);assert.equal(g.phase,'discard');assert.equal(g.discards.A,4);
assert.throws(()=>turns.act(g,tiles,'A',{type:'Discard',cards:{wood:3}}),/exactly/);
assert.throws(()=>turns.act(g,tiles,'A',{type:'Discard',cards:{wood:-1,brick:5}}),/exactly/);
turns.act(g,tiles,'A',{type:'Discard',cards:{wood:4}});assert.equal(g.resources.A.wood,5);assert.equal(g.phase,'robber');
assert.throws(()=>turns.act(g,tiles,'B',{type:'MoveRobber',id:g.robber}),/different tile/);
const target=city.tiles[0];turns.act(g,tiles,'B',{type:'MoveRobber',id:target},()=>0);assert.equal(g.resources.A.wood,4);assert.equal(g.resources.B.wood,3);assert.equal(g.phase,'build');assert.deepEqual(g.victims,[]);
// One blocked tile contributes nothing; cities produce two on unblocked matching tiles.
const production=fixture();production.vertices.forEach(v=>{v.owner=null;});production.vertices[city.id].owner='A';production.vertices[city.id].city=true;production.robber=city.tiles[0];production.resources.A.wood=0;production.bank.wood=19;
turns.act(production,tiles,'A',{type:'RollDice'},()=>3);assert.equal(production.resources.A.wood,2*(city.tiles.length-1));assert.equal(production.production.transfers.reduce((n,t)=>n+t.amount,0),production.resources.A.wood);assert(production.production.transfers.every(t=>t.tile!==production.robber&&t.player==='A'&&t.resource==='wood'&&t.amount===2));
// A road cannot continue through an opponent's occupied corner.
const network=fixture();network.resources.A.wood=10;network.resources.A.brick=10;const owned=network.edges.find(e=>e.owner==='A');network.vertices.forEach(v=>{v.owner=null;});network.vertices[owned.a].owner='B';network.vertices[owned.b].owner='B';network.edges.filter(e=>e!==owned).forEach(e=>{e.owner=null;});assert.equal(turns.buildLocations(network,'A','BuildRoad').length,0);
console.log('PASS: turn enforcement, dice/production, costs, cities, robber blocking, seven/discard validation, stealing, blocked road connections');

// Exactly seven is exempt; eight resource cards require four discards.
{const boundary=fixture();boundary.resources.A={wood:7,brick:0,sheep:0,wheat:0,ore:0};boundary.resources.B={wood:8,brick:0,sheep:0,wheat:0,ore:0};let face=0;turns.act(boundary,tiles,'A',{type:'RollDice'},()=>++face===1?3:4);assert.equal(boundary.discards.A,undefined);assert.equal(boundary.discards.B,4);const move=turns.botAction(boundary,tiles,'B');assert.equal(move.type,'Discard');turns.act(boundary,tiles,'B',move);assert.equal(boundary.phase,'robber');assert.equal(boundary.resources.B.wood,4);}
