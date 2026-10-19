const assert=require('assert/strict'),boards=require('../board.cjs'),rules=require('../game.cjs'),turns=require('../turns.cjs'),{encode,validate}=require('../persistence.cjs'),{presentBoard}=require('../tools/renderer-state.cjs');
for(const extended of [false,true])for(const type of ['star','crescent','long-island']){
 for(let seed=1;seed<=60;seed++){
  let value=seed;const random=n=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value%n;};
  const board=boards.generate(random,extended,type),harbors=boards.harbors(board,random),topology=rules.topology(board);
  assert.equal(board.length,extended?30:19);assert.equal(new Set(board.map(t=>t.q+','+t.r)).size,board.length);
  assert.deepEqual(board.map(t=>t.resource).sort(),[...(extended?boards.extendedResources:boards.resourceBag)].sort());
  assert.deepEqual(board.filter(t=>t.number).map(t=>t.number).sort(),[...(extended?boards.extendedNumbers:boards.numberBag)].sort());
  const visited=new Set([0]);for(let changed=true;changed;){changed=false;for(let i=0;i<board.length;i++)if(!visited.has(i)&&[...visited].some(j=>boards.adjacent(board[i],board[j]))){visited.add(i);changed=true;}}assert.equal(visited.size,board.length);
  const reds=board.filter(t=>[6,8].includes(t.number));for(const a of reds)for(const b of reds)if(a!==b)assert(!boards.adjacent(a,b));
  assert(boards.productionSpread(board)<=1,'Resource average production odds stay within one pip');
  assert.equal(harbors.length,extended?11:9);const ends=new Set();for(const h of harbors)for(const id of [topology.edges[h.edge].a,topology.edges[h.edge].b]){assert(!ends.has(id));ends.add(id);}
  if(seed===1){
   const players=Array.from({length:extended?6:4},(_,i)=>({id:'P'+i,name:'Player '+i,bot:false,token:String(i).repeat(48)})),game=rules.start(board,players.map(p=>p.id));game.harbors=harbors;
   while(game.phase!=='complete'){const move=rules.botMove(game,board);rules.place(game,board,game.order[game.step],move.type,move.id);}turns.begin(game,board);
   const room={code:'ABCDEF',mapType:type,board,harbors,players,game};validate(encode(new Map([[room.code,room]])));
   const view=presentBoard({board,harbors,maxPlayers:players.length,players:players.map(p=>({...p,playing:true})),game});assert.equal(view.mapping.corners.length,game.vertices.length);
   for(let i=0;i<300&&game.phase!=='finished';i++){const actor=Object.keys(game.discards)[0]||turns.current(game),move=turns.botAction(game,board,actor);assert(move);turns.act(game,board,actor,move);}
   validate(encode(new Map([[room.code,room]])));
  }
 }
 for(const random of [()=>0,n=>n-1]){const board=boards.generate(random,extended,type);assert.equal(boards.harbors(board,random).length,extended?11:9);}
}
assert.throws(()=>boards.generate(undefined,false,'unknown'),/Unsupported/);
console.log('PASS: 360 shaped maps, exact supplies, connected coastlines, separated reds, production balance, disjoint ports, deterministic draws, 4/6-player setup, bot actions, persistence and renderer topology');

for(const extended of [false,true]){const generated=boards.generate(undefined,extended,'star'),legacy=boards.legacyStarLayout(extended),board=generated.map((t,i)=>({...t,...legacy[i]})),room={code:'ABCDEF',mapType:'star',board,harbors:boards.harbors(board),players:[{id:'P0',name:'Saved player',bot:false,token:'a'.repeat(48)}]};assert.equal(validate(encode(new Map([[room.code,room]]))).rooms[0].board.length,extended?30:19);assert.notDeepEqual(boards.shapeLayout('star',extended),legacy);}
console.log('PASS: previous Star saves remain compatible at both sizes');
