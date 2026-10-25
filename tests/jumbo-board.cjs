const assert=require('assert/strict'),boards=require('../board.cjs'),rules=require('../game.cjs'),turns=require('../turns.cjs'),{presentBoard}=require('../tools/renderer-state.cjs'),{encode,validate}=require('../persistence.cjs');
for(const type of ['classic','random','random-plus','random-plus-plus','china'])for(let seed=1;seed<=20;seed++){
 let value=seed;const random=n=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value%n;};
 const board=type==='classic'?boards.classic('jumbo').board:boards.generate(random,'jumbo',type),harbors=boards.harbors(board,random);
 assert.equal(board.length,type==='china'?90:37);assert.equal(harbors.length,type==='china'?11:13);assert.equal(boards.capacity({board,mapSize:'jumbo'}),8);assert(boards.productionSpread(board)<=1);
 assert.deepEqual(board.map(t=>t.resource).sort(),(type==='china'?Array(3).fill(boards.extendedResources).flat():[...boards.jumboResources]).sort());
 assert.deepEqual(board.filter(t=>t.number).map(t=>t.number).sort(),(type==='china'?Array(3).fill(boards.extendedNumbers).flat():[...boards.jumboNumbers]).sort());
 const reds=board.filter(t=>[6,8].includes(t.number));for(const a of reds)for(const b of reds)if(a!==b)assert(!boards.adjacent(a,b));
 if(seed===1)for(const count of [7,8]){
  const ids=Array.from({length:count},(_,i)=>'P'+i),game=rules.start(board,ids);game.harbors=harbors;
  while(game.phase!=='complete'){const move=rules.botMove(game,board);rules.place(game,board,game.order[game.step],move.type,move.id);}turns.begin(game,board);
  assert.equal(new Set(Object.values(game.colors)).size,count);assert.equal(game.resourceSupply,type==='china'?72:32);assert.equal(game.developmentDeck.length,43);
  const players=ids.map((id,i)=>({id,name:id,playing:true,bot:false,token:String(i).repeat(48)})),room={code:'ABCDEF',mapType:type,mapSize:'jumbo',board,harbors,players,game};validate(encode(new Map([[room.code,room]])));
  const view=presentBoard({...room,maxPlayers:8});assert.equal(view.fixture.gameSettings.maxPlayers,8);assert.equal(new Set(Object.values(view.playerColors)).size,count);
  for(let i=0;i<150&&game.phase!=='finished';i++){const actor=Object.keys(game.discards)[0]||turns.current(game),move=turns.botAction(game,board,actor);assert(move);turns.act(game,board,actor,move);}
  validate(encode(new Map([[room.code,room]])));
 }
}
for(const type of ['star','crescent','long-island'])assert.throws(()=>boards.generate(undefined,'jumbo',type),/7–8/);
assert.equal(boards.capacity({board:boards.hugeChinaLayout()}),6,'Existing China saves keep six seats');
{
 const board=boards.classic().board,ids=['A','B','C','D'],players=ids.map((id,i)=>({id,name:id,bot:false,token:String(i).repeat(48)}));players.push({id:'spectator',name:'Old bot',bot:true});
 const room={code:'ABCDEF',mapType:'classic',board,players,game:rules.start(board,ids)};validate(encode(new Map([[room.code,room]])));
}
console.log('PASS: 100 extra-large maps, 7/8-player setup/actions, unique colors, supplies, ports, persistence, renderer geometry and incompatible shapes');
