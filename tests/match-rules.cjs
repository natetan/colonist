const assert=require('assert/strict'),rules=require('../game.cjs'),boards=require('../board.cjs'),turns=require('../turns.cjs'),scoring=require('../scoring.cjs'),development=require('../development.cjs'),{encode,validate}=require('../persistence.cjs');
const board=boards.classic(true).board;
function fixture(settings){const g=rules.start(board,['A','B']);g.rules={...settings};turns.begin(g,board);g.phase='build';for(const r of Object.keys(g.resources.A))g.resources.A[r]=20;return g;}
for(const [name,settings]of Object.entries(rules.matchPresets)){
 assert(rules.validMatchRules(settings,30));assert.equal(rules.validMatchRules(settings,19),name!=='epic');
 const limits=rules.pieceSupplies[name],g=fixture(settings);
 for(const e of g.edges.slice(0,limits.roads-1))e.owner='A';assert(turns.roadLocations(g,'A').length);g.edges[limits.roads-1].owner='A';assert.equal(turns.roadLocations(g,'A').length,0);
 g.edges.forEach(e=>e.owner=null);for(const v of g.vertices.slice(0,limits.cities))Object.assign(v,{owner:'A',city:true});g.vertices[limits.cities].owner='A';assert.equal(turns.buildLocations(g,'A','BuildCity').length,0);g.vertices[0].city=false;assert(turns.buildLocations(g,'A','BuildCity').length);
 g.vertices.forEach(v=>{v.owner=null;v.city=false;});for(const v of g.vertices.slice(0,limits.settlements))v.owner='A';assert.equal(turns.buildLocations(g,'A','BuildSettlement').length,0);
 g.vertices.forEach(v=>{v.owner=null;v.city=false;});const cities=Math.min(limits.cities,Math.floor(settings.victoryPoints/2));for(const v of g.vertices.slice(0,cities))Object.assign(v,{owner:'A',city:true});for(const v of g.vertices.slice(cities,cities+settings.victoryPoints-2*cities))v.owner='A';g.vertices[0].city=false;scoring.refresh(g);assert.equal(g.winner,undefined);g.vertices[0].city=true;scoring.refresh(g);assert.equal(g.winner,'A');assert.equal(scoring.view(g,'A').target,settings.victoryPoints);
 const free=fixture(settings);for(const e of free.edges.slice(0,limits.roads-1))e.owner='A';free.developmentHands.A=[{id:1,type:'RoadBuilding',boughtTurn:-1}];development.act(free,'A',{type:'PlayDevelopmentCard',cardId:1},()=>0,turns.roadLocations);assert.equal(free.freeRoadsRemaining,1);
}
assert(rules.validMatchRules({victoryPoints:12,pieceSupply:'expanded'},19));assert(!rules.validMatchRules({victoryPoints:20,pieceSupply:'standard'},19));assert(!rules.validMatchRules({victoryPoints:10,pieceSupply:'epic'},19));assert(!rules.validMatchRules({victoryPoints:999,pieceSupply:'standard'},90));
const room={code:'ABCDEF',mapType:'classic',board,harbors:boards.classic(true).harbors,rules:{victoryPoints:12,pieceSupply:'expanded'},players:[{id:'A',name:'Host',bot:false,token:'a'.repeat(48)}]};assert.deepEqual(validate(encode(new Map([[room.code,room]]))).rooms[0].rules,room.rules);
room.players.push({id:'B',name:'Friend',bot:false,token:'b'.repeat(48)});room.game=rules.start(board,['A','B']);room.game.rules={...room.rules};room.game.harbors=room.harbors;
while(room.game.phase!=='complete'){const move=rules.botMove(room.game,board);rules.place(room.game,board,room.game.order[room.game.step],move.type,move.id);}turns.begin(room.game,board);
assert.deepEqual(validate(encode(new Map([[room.code,room]]))).rooms[0].game.rules,room.rules);
const corrupt=encode(new Map([[room.code,room]]));corrupt.rooms[0].game.rules={victoryPoints:20,pieceSupply:'epic'};assert.throws(()=>validate(corrupt),/Invalid/);
console.log('PASS: preset and custom rules, map restrictions, paid/free road caps, settlement/city caps, victory targets, and settings persistence');
