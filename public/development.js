window.DevelopmentControls=(()=>{
  const resources=['wood','brick','sheep','wheat','ore'];
  const names={Knight:'Knight',VictoryPoint:'Victory point',RoadBuilding:'Road building',YearOfPlenty:'Year of plenty',Monopoly:'Monopoly'};
  function render(parent,state,viewerId,send){
    const g=state.game,d=g?.development;if(!d)return;
    const section=document.createElement('section');section.className='trade-controls';parent.append(section);
    const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;section.append(e);};
    const button=(label,action,disabled)=>{const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=action;section.append(b);};
    const select=label=>{const l=document.createElement('label');l.textContent=label+' ';const s=document.createElement('select');for(const r of resources){const o=document.createElement('option');o.value=r;o.textContent=r+' (bank '+g.bank[r]+')';s.append(o);}l.append(s);section.append(l);return s;};
    text('h3','Development cards');text('p',`${d.remaining} in deck · ${d.privateVictoryPoints} private victory points`);
    if(g.currentPlayer===viewerId)button('Buy card · sheep + wheat + ore',()=>send('BuyDevelopmentCard'),!d.canBuy);
    if(g.phase==='free-road')text('p',`${d.freeRoadsRemaining} free roads remaining. Click a white edge marker.`);
    if(!d.cards.length)text('p','No cards in your hand.');
    for(const card of d.cards){
      text('p',names[card.type]+(card.newThisTurn?' · bought this turn':'')+(card.type==='VictoryPoint'?' · kept private':''));
      if(card.type==='VictoryPoint')continue;
      let first,second,monopoly;
      if(card.playable&&card.type==='YearOfPlenty'){first=select('First resource');if(Object.values(g.bank).reduce((a,b)=>a+b,0)>1)second=select('Second resource');}
      if(card.playable&&card.type==='Monopoly')monopoly=select('Collect resource');
      button('Play '+names[card.type],()=>{const choice={cardId:card.id};if(first)choice.resources=[first.value,...(second?[second.value]:[])];if(monopoly)choice.resource=monopoly.value;send('PlayDevelopmentCard',choice);},!card.playable);
    }
    text('p','Play one older card per turn, before rolling or after resolving the dice.');
    if(d.lastPlayed)text('p',`${state.players.find(p=>p.id===d.lastPlayed.player)?.name||'Player'} played ${names[d.lastPlayed.type]}.`);
  }
  return {render};
})();
