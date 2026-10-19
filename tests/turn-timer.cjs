const assert=require('assert/strict'),timer=require('../turn-timer.cjs'),rules=require('../game.cjs'),turns=require('../turns.cjs'),boards=require('../board.cjs'),{encode,validate}=require('../persistence.cjs');
function fixture(regular=true){const {board,harbors}=boards.classic(),players=['A','B'].map(id=>({id,name:id,bot:false,token:(id==='A'?'a':'b').repeat(48)})),game=rules.start(board,['A','B']);game.harbors=harbors;
 if(regular){while(game.phase!=='complete'){const m=rules.botMove(game,board);rules.place(game,board,game.order[game.step],m.type,m.id);}turns.begin(game,board);}
 return {code:'ABCDEF',board,harbors,players,game,turnSeconds:60};}
let room=fixture(false),g=room.game;
assert.equal(timer.sync(room,1000).deadline,61000);const move=rules.botMove(g,room.board);rules.place(g,room.board,'A',move.type,move.id);assert.equal(timer.sync(room,5000).deadline,61000,'Setup road shares the settlement deadline');
assert.equal(timer.expire(room,60999,()=>0),false);assert(timer.expire(room,61000,()=>0));assert.equal(g.step,1);assert.equal(g.phase,'settlement');assert.equal(g.turnTimer.deadline,121000);
timer.expire(room,121000,()=>0);assert.equal(g.step,2);assert.equal(g.order[g.step],'B');assert.equal(g.turnTimer.deadline,181000,'Reverse setup grants a new deadline even for the same player');
room=fixture();g=room.game;timer.sync(room,1000);const hands=JSON.stringify(g.resources);g.phase='build';assert.equal(timer.sync(room,5000).deadline,61000,'Actions do not extend the turn');g.tradeOffer={id:1};assert(timer.expire(room,61000,()=>0));assert.equal(g.turn,1);assert.equal(g.phase,'roll');assert.equal(g.tradeOffer,null);assert.equal(JSON.stringify(g.resources),hands);
room=fixture();g=room.game;timer.sync(room,1000);assert(timer.expire(room,61000,()=>0));assert.equal(g.turn,1);assert.equal(g.production,undefined,'Unrolled turns are skipped without rolling for the player');
room=fixture();g=room.game;for(const id of g.players)for(const r of Object.keys(g.bank))g.resources[id][r]=0;for(const r of Object.keys(g.bank))g.bank[r]=19;g.resources.A.wood=8;g.resources.B.brick=8;g.bank.wood-=8;g.bank.brick-=8;g.phase='discard';g.discards={A:4,B:4};timer.sync(room,1000);timer.expire(room,61000,()=>0);assert.equal(g.phase,'roll');assert.equal(g.turn,1);assert.deepEqual(g.discards,{});assert.equal(Object.values(g.resources.A).reduce((a,b)=>a+b,0)+Object.values(g.resources.B).reduce((a,b)=>a+b,0),8);validate(encode(new Map([[room.code,room]])));
room=fixture();g=room.game;g.phase='free-road';g.freeRoadsRemaining=2;g.developmentReturnPhase='roll';const roadCount=g.edges.filter(e=>e.owner).length;timer.sync(room,1000);timer.expire(room,61000,()=>0);assert.equal(g.turn,1);assert.equal(g.edges.filter(e=>e.owner).length,roadCount,'Timeout forfeits unplaced free roads');
room=fixture();g=room.game;const deadline=timer.sync(room,1000).deadline;const restored=JSON.parse(JSON.stringify(encode(new Map([[room.code,room]]))));validate(restored);const saved=restored.rooms[0];assert.equal(timer.sync(saved,50000).deadline,deadline,'Saved games retain the original deadline');
room.turnSeconds=0;assert.equal(timer.sync(room,100000),null);assert.equal(timer.expire(room,100000,()=>0),false);g.phase='finished';assert.equal(timer.sync(room,100000),null);
console.log('PASS: shared turn deadlines, setup auto-completion, reverse setup, exact expiry, trade clearing, unrolled skips, forced discards/robber resolution, unused free roads, saved deadlines and timer Off');
room=fixture();g=room.game;timer.sync(room,1000);
function action(actor,message,now=58000){const before=timer.key(g);turns.act(g,room.board,actor,message,()=>2,()=>0);timer.rewardAction(room,message.type,actor,before,now);}
action('A',{type:'RollDice'});assert.equal(g.turnTimer.deadline-58000,23000);
g.phase='build';for(const id of g.players)for(const r of Object.keys(g.bank))g.resources[id][r]=0;for(const r of Object.keys(g.bank))g.bank[r]=19;
for(const [r,n]of Object.entries({wood:8,brick:4,sheep:3,wheat:4,ore:4})){g.resources.A[r]=n;g.bank[r]-=n;}g.resources.B.brick=2;g.bank.brick-=2;
action('A',{type:'BuildRoad',id:turns.buildLocations(g,'A','BuildRoad')[0]});assert.equal(g.turnTimer.deadline,101000);
action('A',{type:'BuildCity',id:turns.buildLocations(g,'A','BuildCity')[0]});assert.equal(g.turnTimer.deadline,118000);
action('A',{type:'BuyDevelopmentCard'});assert.equal(g.turnTimer.deadline,118000);
action('A',{type:'BankTrade',give:'wood',receive:'ore'});assert.equal(g.turnTimer.deadline,118000);
action('A',{type:'OfferTrade',player:'all',give:{wood:1},receive:{brick:1}});assert.equal(g.turnTimer.deadline,118000);
const offerId=g.tradeOffer.id;action('B',{type:'AcceptTrade',offerId});assert.equal(g.turnTimer.deadline,118000,'Consent adds no time');action('A',{type:'ConfirmTrade',offerId,player:'B'});assert.equal(g.turnTimer.deadline,118000,'Final confirmation cannot exceed the configured maximum');
const extendedSave=encode(new Map([[room.code,room]]));validate(extendedSave);assert.equal(timer.sync(extendedSave.rooms[0],100000).deadline,118000,'Extended deadlines survive save/reload');
assert.throws(()=>action('B',{type:'AcceptTrade',offerId}));assert.equal(g.turnTimer.deadline,118000);
action('A',{type:'EndTurn'});assert.equal(timer.sync(room,58000).deadline,118000,'EndTurn never credits the next player');
for(const type of ['OfferTrade','CancelTrade','DeclineTrade','Chat'])assert.equal(timer.rewardAction(room,type,'B',timer.key(g),58000),false);
room.turnSeconds=0;assert.equal(timer.rewardAction(room,'RollDice','B',timer.key(g),58000),false);assert.equal(g.turnTimer,undefined);
room.turnSeconds=60;timer.sync(room,1000);assert.equal(timer.rewardAction(room,'BuildRoad','B',timer.key(g),61000),false,'Expired clocks cannot be revived');
console.log('PASS: additive 20-second roll/build/city/development/bank/player-trade bonuses, final confirmation, replay rejection, excluded offers, next-turn isolation, Off and exact expiry');

for(const limit of timer.choices.filter(n=>n>0)){room=fixture();room.turnSeconds=limit;g=room.game;timer.sync(room,1000);const before=timer.key(g);timer.rewardAction(room,'RollDice','A',before,11000);assert.equal(g.turnTimer.deadline,11000+limit*1000);timer.rewardAction(room,'BuildRoad','A',before,11000);assert.equal(g.turnTimer.deadline,11000+limit*1000,'Repeated actions cannot exceed the limit');g.turnTimer.deadline=2000000;assert.equal(timer.sync(room,12000).deadline,12000+limit*1000,'Old overlong saved deadlines are clamped');}
room=fixture();g=room.game;timer.sync(room,1000);timer.rewardAction(room,'RollDice','A',timer.key(g),58000);assert.equal(g.turnTimer.deadline-58000,23000);
console.log('PASS: all presets cap bonuses, repeated actions cannot bank excess time, old deadlines normalize, and three seconds becomes 23');
