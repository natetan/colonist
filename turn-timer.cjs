const placement=require('./game.cjs'),turns=require('./turns.cjs'),development=require('./development.cjs');
const choices=Object.freeze([0,10,15,30,60,90,120,180,300]);
const timedActions=new Set(['PlaceSettlement','PlaceRoad','RollDice','BuildRoad','BuildSettlement','BuildCity','MoveRobber','Steal','Discard','BankTrade','ConfirmTrade','BuyDevelopmentCard','PlayDevelopmentCard','PlaceFreeRoad']);
function key(g){return g.turn===undefined?'setup:'+g.step:'turn:'+g.turnNumber+':'+g.turn+(['roll','discard'].includes(g.phase)?':'+g.phase:'');}
function sync(room,now){
 const g=room.game,seconds=g?.turn!==undefined&&g.phase==='roll'?5:room.turnSeconds??60;
 if(!g)return null;
 if(!seconds||['complete','finished'].includes(g.phase)){delete g.turnTimer;return null;}
 const currentKey=key(g);
 if(g.turnTimer?.key!==currentKey)g.turnTimer={key:currentKey,deadline:now+seconds*1000};
 // Also normalize saved deadlines from releases that allowed unlimited bonuses.
 g.turnTimer.deadline=Math.min(g.turnTimer.deadline,now+seconds*1000);
 return g.turnTimer;
}
// Invoke only after authoritative move validation succeeds. Never credit the
// next player's clock, or let spectators/discarding opponents add turn time.
function rewardAction(room,type,actor,beforeKey,now){
 const g=room.game;
 if(!g||!timedActions.has(type))return false;
 // Rolling starts a fresh action budget; it never borrows from the roll clock.
 if(type==='RollDice'&&actor===turns.current(g))return !!sync(room,now);
 // Waiting for other players to discard never spends the roller's action time.
 if(type==='Discard'){if(key(g)!==beforeKey)sync(room,now);return false;}
 if(key(g)!==beforeKey)return false;
 const current=g.turn===undefined?g.order[g.step]:turns.current(g);
 if(actor!==current)return false;
 const timer=sync(room,now);
 if(!timer||timer.deadline<=now)return false;
 timer.deadline=Math.min(timer.deadline+20000,now+(room.turnSeconds??60)*1000);return true;
}
function expire(room,now,random,developmentRandom){
 const g=room.game,timer=sync(room,now);if(!timer||timer.deadline>now)return false;
 const setup=g.turn===undefined,player=setup?g.order[g.step]:turns.current(g);
 if(!setup&&g.phase==='roll'){
  turns.act(g,room.board,player,{type:'RollDice'},random,developmentRandom);
  sync(room,now);return true;
 }
 if(!setup&&g.phase==='discard'){
  for(const id of Object.keys(g.discards))turns.act(g,room.board,id,turns.botAction(g,room.board,id),random,developmentRandom);
  sync(room,now);return true;
 }
 g.lastTimeout={player,setup,sequence:(g.lastTimeout?.sequence||0)+1};
 if(setup){
  const step=g.step;
  while(g.step===step&&g.phase!=='complete'){const move=placement.botMove(g,room.board);placement.place(g,room.board,player,move.type,move.id);}
  if(g.phase==='complete')turns.begin(g,room.board);
 }else{
  // Resolve mandatory choices only; never spend cards on automatic purchases.
  if(g.phase==='free-road')development.finish(g);
  if(g.phase==='robber')turns.act(g,room.board,player,turns.botAction(g,room.board,player),random,developmentRandom);
  if(g.phase==='steal')turns.act(g,room.board,player,{type:'Steal',player:g.victims[0]},random,developmentRandom);
  if(g.phase!=='finished'){if(g.phase==='roll')g.phase='build';turns.act(g,room.board,player,{type:'EndTurn'},random,developmentRandom);}
 }
 sync(room,now);return true;
}
module.exports={choices,key,sync,rewardAction,expire};
