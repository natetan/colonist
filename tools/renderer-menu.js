window.MainMenu=(()=>{
  const $=id=>document.getElementById(id);
  const colors={wood:'#247f43',brick:'#c77552',sheep:'#9fbd49',wheat:'#e4b43c',ore:'#98a6a7',desert:'#d9c68b'};
  const names={wood:'Forest',brick:'Hills',sheep:'Pasture',wheat:'Fields',ore:'Mountains',desert:'Desert'};
  function preview(state){
    const board=state.board;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');const xs=board.map(t=>51*Math.sqrt(3)*(t.q+t.r/2)),ys=board.map(t=>76.5*t.r);for(const harbor of state.renderer?.harborLocations||[]){xs.push(harbor.boatX*51/78);ys.push(harbor.boatY*51/78);}const left=Math.min(...xs)-130,top=Math.min(...ys)-130;svg.setAttribute('viewBox',[left,top,Math.max(...xs)-left+130,Math.max(...ys)-top+130].join(' '));svg.setAttribute('role','img');svg.setAttribute('aria-label','Selected island terrain and number tokens');
    const make=(tag,attrs,text)=>{const node=document.createElementNS(svg.namespaceURI,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;svg.append(node);return node;};
    for(const tile of board){const x=51*Math.sqrt(3)*(tile.q+tile.r/2),y=76.5*tile.r;
      const points=Array.from({length:6},(_,i)=>{const angle=(i*60-30)*Math.PI/180;return `${x+51*Math.cos(angle)},${y+51*Math.sin(angle)}`;}).join(' ');
      make('polygon',{points,fill:colors[tile.resource],stroke:'#f2deb1','stroke-width':4});
      make('text',{x,y:y-15,'text-anchor':'middle',class:'preview-terrain'},names[tile.resource]);
      if(tile.number){make('circle',{cx:x,cy:y+12,r:17,fill:'#fff7df'});make('text',{x,y:y+18,'text-anchor':'middle',fill:[6,8].includes(tile.number)?'#bd2e22':'#233e32',class:'preview-number'},tile.number);}
    }
    for(const harbor of state.renderer?.harborLocations||[]){const type=state.harbors.find(h=>h.edge===harbor.edge)?.resource,x=harbor.boatX*51/78,y=harbor.boatY*51/78;
      make('circle',{cx:x,cy:y,r:20,fill:type?colors[type]:'#fff7df',stroke:'#f2deb1','stroke-width':2});
      make('text',{x,y:y-2,'text-anchor':'middle',fill:type?'white':'#233e32','font-size':8},type?names[type]:'Any');
      make('text',{x,y:y+10,'text-anchor':'middle',fill:type?'white':'#233e32','font-size':11},type?'2:1':'3:1');
    }
    $('map-preview').replaceChildren(svg);
  }
  function render(state,viewer,send){
    const lobby=!state.game,host=state.host===viewer;
    $('lobby').hidden=true;$('room-menu').hidden=!lobby;$('game-layout').hidden=lobby;$('menu-error').hidden=!lobby;
    if(!lobby)return;
    const capacity=state.maxPlayers||4,size=capacity===6?'extended':'standard',type=state.mapType||'random',online=state.players.filter(p=>p.online&&!p.bot).length;
    $('room-menu-code').textContent=`Room ${state.code} · Share the code to invite friends`;
    $('map-size').value=size;$('map-size').disabled=!host;$('map-size').onchange=()=>send('SetMap',{mapType:type,mapSize:$('map-size').value});
    $('bot-fill-label').hidden=capacity!==6;$('bot-fill').disabled=!host;
    $('turn-seconds').value=String(state.turnSeconds??60);$('turn-seconds').disabled=!host;$('turn-seconds').onchange=()=>send('SetTurnTimer',{seconds:Number($('turn-seconds').value)});
    $('map-type').value=type;$('map-type').disabled=!host;
    const rules=state.rules||{victoryPoints:10,pieceSupply:'standard'},presets={standard:{victoryPoints:10,pieceSupply:'standard'},expanded:{victoryPoints:15,pieceSupply:'expanded'},epic:{victoryPoints:20,pieceSupply:'epic'}};
    $('match-preset').value=Object.keys(presets).find(key=>presets[key].victoryPoints===rules.victoryPoints&&presets[key].pieceSupply===rules.pieceSupply)||'custom';
    $('victory-points').value=String(rules.victoryPoints);$('piece-supply').value=rules.pieceSupply;
    const explanation='Epic requires a large map: standard islands have limited room for the extra buildings and a 20-point game.';
    for(const id of ['match-preset','victory-points','piece-supply']){
      const input=$(id);input.disabled=!host;input.title=size==='standard'?explanation:'';
      for(const option of input.options||[])if(option.value==='epic'||option.value==='20'){option.disabled=size==='standard';option.title=size==='standard'?explanation:'';}
    }
    $('match-rule-hint').textContent=size==='standard'?explanation:state.board.length===90?'Huge China recommends Epic. You can change points and piece supply separately.':'Choose a preset, or change points and piece supply separately.';
    $('match-preset').onchange=()=>send('SetMatchRules',{preset:$('match-preset').value});
    const changeRules=()=>send('SetMatchRules',{victoryPoints:Number($('victory-points').value),pieceSupply:$('piece-supply').value});
    $('victory-points').onchange=changeRules;$('piece-supply').onchange=changeRules;
    $('map-kind').textContent=type==='random-plus-plus'?'RANDOM++':type==='random-plus'?'RANDOM+':type.replace('-', ' ').toUpperCase();
    $('map-description').textContent=type==='classic'?'A fixed island with the same terrain, numbers, and harbors every game.':(type==='random-plus-plus'?'A wild connected island with branching peninsulas, deep bays, and narrow routes. Resource production is balanced, but starting locations are more challenging.':type==='random-plus'?'A compact, irregular island with a freshly generated coastline, balanced resources, numbers, and harbors.':type==='china'?'A China-shaped mainland island with a broad west, raised northeast, and tapered southern coast. Resources and production odds are balanced.':type==='random'?'A fresh island with shuffled terrain, numbers, and harbors.':'A shaped island with shuffled terrain, numbers, and harbors. Production odds are spread across resources.')+' Red 6s and 8s stay apart.';
    if(capacity===6)$('map-description').textContent+=' '+state.board.length+' tiles · '+(state.board.length===90?72:24)+' cards per resource · 34 development cards. One player acts at a time.';
    $('regenerate').disabled=!host||type==='classic';
    $('map-host-hint').textContent=host?(type==='classic'?'Choose Random to generate a new island.':'Generate until you find your next island.'):'The host chooses the map. Everyone sees the same island.';
    $('map-type').onchange=()=>send('SetMap',{mapType:$('map-type').value,mapSize:size});
    $('regenerate').onclick=()=>send('SetMap',{mapType:type,mapSize:size});
    $('lobby-count').textContent=`${state.players.length+(state.joiningPlayers||0)} / ${capacity}`;
    $('lobby-players').replaceChildren(...state.players.map(p=>{const li=document.createElement('li');li.textContent=p.name+(p.id===state.host?' · Host':'')+(p.online?'':' · Offline');return li;}));
    for(let i=0;i<(state.joiningPlayers||0);i++){const li=document.createElement('li');li.textContent='Player joining…';li.className='joining-player';$('lobby-players').append(li);}
    $('menu-start').disabled=!host||online<2||!!state.joiningPlayers;$('menu-start-bots').disabled=!host||!!state.joiningPlayers;
    $('menu-start').onclick=()=>send('StartGame');$('menu-start-bots').onclick=()=>send('StartGame',{bots:true,targetPlayers:capacity===6?Number($('bot-fill').value):4});
    $('lobby-start-hint').textContent=state.joiningPlayers?'Waiting for joining players to enter their names…':host?'Start with friends, or fill empty seats with bots. '+capacity+' players maximum.':'Waiting for the host to start.';
    $('menu-copy').onclick=async()=>{const url=new URL(location.href);url.searchParams.set('room',state.code);try{await navigator.clipboard.writeText(url.href);$('menu-copy').textContent='Invite copied';}catch{$('menu-error').textContent='Share room code: '+state.code;}};
    preview(state);
  }
  return {render};
})();
