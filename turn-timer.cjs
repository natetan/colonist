const placement=require('./game.cjs'),turns=require('./turns.cjs'),development=require('./development.cjs');
const choices=Object.freeze([0,30,60,90,120,180,300]);
const timedActions=new Set(['PlaceSettlement','PlaceRoad','RollDice','BuildRoad','BuildSettlement','BuildCity','MoveRobber','Steal','Discard','BankTrade','AcceptTrade','BuyDevelopmentCard','PlayDevelopmentCard','PlaceFreeRoad']);
function key(g){return g.turn===undefined?'setup:'+g.step:'turn:'+g.turnNumber+':'+g.turn;}
function sync(room,now){
 const g=room.game,seconds=room.turnSeconds??60;
 if(!g)return null;
 if(!seconds||['complete','finished'].includes(g.phase)){delete g.turnTimer;return null;}
 const currentKey=key(g);
 if(g.turnTimer?.key!==currentKey)g.turnTimer={key:currentKey,deadline:now+seconds*1000};
 return g.turnTimer;
}
// Invoke only after authoritative move validation succeeds. Never credit the
// next player's clock, or let spectators/discarding opponents add turn time.
function rewardAction(room,type,actor,beforeKey,now){
 const g=room.game;
 if(!g||!timedActions.has(type)||key(g)!==beforeKey)return false;
 const current=g.turn===undefined?g.order[g.step]:turns.current(g);
 if(actor!==current&&type!=='AcceptTrade')return false;
 const timer=sync(room,now);
 if(!timer||timer.deadline<=now)return false;
 timer.deadline+=20000;return true;
}
function expire(room,now,random,developmentRandom){
 const g=room.game,timer=sync(room,now);if(!timer||timer.deadline>now)return false;
 const setup=g.turn===undefined,player=setup?g.order[g.step]:turns.current(g);
 g.lastTimeout={player,setup,sequence:(g.lastTimeout?.sequence||0)+1};
 if(setup){
  const step=g.step;
  while(g.step===step&&g.phase!=='complete'){const move=placement.botMove(g,room.board);placement.place(g,room.board,player,move.type,move.id);}
  if(g.phase==='complete')turns.begin(g,room.board);
 }else{
  // Resolve mandatory choices only; never spend cards on automatic purchases.
  if(g.phase==='discard')for(const id of Object.keys(g.discards))turns.act(g,room.board,id,turns.botAction(g,room.board,id),random,developmentRandom);
  if(g.phase==='free-road')development.finish(g);
  if(g.phase==='robber')turns.act(g,room.board,player,turns.botAction(g,room.board,player),random,developmentRandom);
  if(g.phase==='steal')turns.act(g,room.board,player,{type:'Steal',player:g.victims[0]},random,developmentRandom);
  if(g.phase!=='finished'){if(g.phase==='roll')g.phase='build';turns.act(g,room.board,player,{type:'EndTurn'},random,developmentRandom);}
 }
 sync(room,now);return true;
}
module.exports={choices,key,sync,rewardAction,expire};
