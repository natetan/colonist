window.DevelopmentControls=(()=>{
  const resources=['wood','brick','sheep','wheat','ore'];
  const names={Knight:'Knight',VictoryPoint:'Victory point',RoadBuilding:'Road building',YearOfPlenty:'Year of plenty',Monopoly:'Monopoly'};
  const effects={Knight:'Move the robber and steal one resource.',VictoryPoint:'Adds one private point automatically.',RoadBuilding:'Place up to two roads without paying resources.',YearOfPlenty:'Take two available resources from the bank.',Monopoly:'Collect every card of one resource from the other players.'};
  function render(parent,state,viewerId,send){
    const g=state.game,d=g?.development;if(!d)return;
    const section=document.createElement('section');section.className='trade-controls';parent.append(section);
    const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;section.append(e);};
    let cardParent=section;
    const button=(label,action,disabled)=>{const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=action;cardParent.append(b);return b;};
    const select=(label,bankOnly=false)=>{const l=document.createElement('label');l.textContent=label+' ';const s=document.createElement('select');for(const r of resources){const o=document.createElement('option');o.value=r;o.textContent=r+(bankOnly?' (bank '+g.bank[r]+')':'');o.disabled=bankOnly&&g.bank[r]===0;s.append(o);}if(bankOnly)s.value=resources.find(r=>g.bank[r]>0)||'';l.append(s);cardParent.append(l);return s;};
    text('h3','Development cards');text('p',`${d.remaining} in deck · ${d.privateVictoryPoints} private victory points`);
    if(g.currentPlayer===viewerId)button('Buy card · sheep + wheat + ore',()=>send('BuyDevelopmentCard'),!d.canBuy);
    if(g.phase==='free-road')text('p',`${d.freeRoadsRemaining} free roads remaining. Click a white edge marker.`);
    if(!d.cards.length)text('p','No cards in your hand.');
    for(const card of d.cards){
      cardParent=document.createElement('article');cardParent.className='development-card';section.append(cardParent);
      const title=document.createElement('h4');title.textContent=names[card.type];cardParent.append(title);
      const description=document.createElement('p');description.textContent=effects[card.type];cardParent.append(description);
      const availability=document.createElement('p');availability.textContent=card.type==='VictoryPoint'?'Kept private · already included in your score':card.newThisTurn?'Available on your next turn':card.playable?'Ready to play':g.currentPlayer!==viewerId?'Wait for your turn':'Unavailable now: play at most one older card during a roll or build phase.';cardParent.append(availability);
      if(card.type==='VictoryPoint')continue;
      let first,second,monopoly;
      if(card.playable&&card.type==='YearOfPlenty'){first=select('First resource',true);if(Object.values(g.bank).reduce((a,b)=>a+b,0)>1)second=select('Second resource',true);}
      if(card.playable&&card.type==='Monopoly')monopoly=select('Collect resource');
      const play=button('Play '+names[card.type],()=>{const choice={cardId:card.id};if(first)choice.resources=[first.value,...(second?[second.value]:[])];if(monopoly)choice.resource=monopoly.value;send('PlayDevelopmentCard',choice);},!card.playable);
      if(first){const update=()=>{play.disabled=!first.value||!!second&&(!second.value||(first.value===second.value&&g.bank[first.value]<2));play.title=play.disabled?'Choose resources available in the bank.':'';};first.onchange=update;if(second)second.onchange=update;update();}
    }
    text('p','Play one older card per turn, before rolling or after resolving the dice.');
    if(d.lastPlayed)text('p',`${state.players.find(p=>p.id===d.lastPlayed.player)?.name||'Player'} played ${names[d.lastPlayed.type]}.`);
  }
  return {render};
})();
