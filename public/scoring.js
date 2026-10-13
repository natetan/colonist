window.ScoreControls=(()=>{
  function render(parent,state,viewerId,send){
    const s=state.game?.scoring;if(!s)return;
    const section=document.createElement('section');section.className='trade-controls';parent.append(section);
    const text=value=>{const p=document.createElement('p');p.textContent=value;section.append(p);};
    const name=id=>state.players.find(p=>p.id===id)?.name||'Unclaimed';
    text(`Your score: ${s.yourPoints} / ${s.target} (includes private victory points)`);
    text(`Longest road: ${name(s.longestRoad)} · Largest army: ${name(s.largestArmy)}`);
    text('Road lengths: '+state.players.filter(p=>p.playing).map(p=>`${p.name} ${s.roadLengths[p.id]||0}`).join(' · '));
    if(s.winner&&state.host===viewerId){const button=document.createElement('button');button.textContent='Rematch · return to lobby';button.onclick=()=>send('Rematch');section.append(button);}
    if(s.winner){const h=document.createElement('h2');h.textContent=`${name(s.winner)} wins with ${s.winningPoints} points!`;h.setAttribute('role','status');section.prepend(h);text(`Winner revealed ${s.revealedVictoryPoints} victory-point cards. The host can return everyone to the lobby for a new match.`);}
  }
  return {render};
})();
