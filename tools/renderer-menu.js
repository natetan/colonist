window.MainMenu=(()=>{
  const $=id=>document.getElementById(id);
  const colors={wood:'#247f43',brick:'#c77552',sheep:'#9fbd49',wheat:'#e4b43c',ore:'#98a6a7',desert:'#d9c68b'};
  const names={wood:'Forest',brick:'Hills',sheep:'Pasture',wheat:'Fields',ore:'Mountains',desert:'Desert'};
  function preview(state){
    const board=state.board;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','-330 -285 660 570');svg.setAttribute('role','img');svg.setAttribute('aria-label','Selected island terrain and number tokens');
    const make=(tag,attrs,text)=>{const node=document.createElementNS(svg.namespaceURI,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;svg.append(node);return node;};
    for(const tile of board){const x=51*Math.sqrt(3)*(tile.q+tile.r/2),y=76.5*tile.r;
      const points=Array.from({length:6},(_,i)=>{const angle=(i*60-30)*Math.PI/180;return `${x+51*Math.cos(angle)},${y+51*Math.sin(angle)}`;}).join(' ');
      make('polygon',{points,fill:colors[tile.resource],stroke:'#f2deb1','stroke-width':4});
      make('text',{x,y:y-15,'text-anchor':'middle',class:'preview-terrain'},names[tile.resource]);
      if(tile.number){make('circle',{cx:x,cy:y+12,r:17,fill:'#fff7df'});make('text',{x,y:y+18,'text-anchor':'middle',fill:[6,8].includes(tile.number)?'#bd2e22':'#233e32',class:'preview-number'},tile.number);}
    }
    for(const harbor of state.renderer?.harborLocations||[]){const type=state.harbors.find(h=>h.edge===harbor.edge)?.resource,x=harbor.x*51/78*1.18,y=harbor.y*51/78*1.18;
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
    const type=state.mapType||'random',online=state.players.filter(p=>p.online&&!p.bot).length;
    $('room-menu-code').textContent=`Room ${state.code} · Share the code to invite friends`;
    $('map-type').value=type;$('map-type').disabled=!host;
    $('map-kind').textContent=type==='classic'?'CLASSIC':'RANDOM';
    $('map-description').textContent=type==='classic'?'A fixed island with the same terrain, numbers, and harbors every game.':'A fresh island with shuffled terrain, numbers, and harbors. Red 6s and 8s stay apart.';
    $('regenerate').disabled=!host||type!=='random';
    $('map-host-hint').textContent=host?(type==='classic'?'Choose Random to generate a new island.':'Generate until you find your next island.'):'The host chooses the map. Everyone sees the same island.';
    $('map-type').onchange=()=>send('SetMap',{mapType:$('map-type').value});
    $('regenerate').onclick=()=>send('SetMap',{mapType:'random'});
    $('lobby-count').textContent=`${state.players.length} / 4`;
    $('lobby-players').replaceChildren(...state.players.map(p=>{const li=document.createElement('li');li.textContent=p.name+(p.id===state.host?' · Host':'')+(p.online?'':' · Offline');return li;}));
    $('menu-start').disabled=!host||online<2;$('menu-start-bots').disabled=!host;
    $('menu-start').onclick=()=>send('StartGame');$('menu-start-bots').onclick=()=>send('StartGame',{bots:true});
    $('lobby-start-hint').textContent=host?'Start with friends, or fill the remaining seats with bots. Four players maximum.':'Waiting for the host to start.';
    $('menu-copy').onclick=async()=>{const url=new URL(location.href);url.searchParams.set('room',state.code);try{await navigator.clipboard.writeText(url.href);$('menu-copy').textContent='Invite copied';}catch{$('menu-error').textContent='Share room code: '+state.code;}};
    preview(state);
  }
  return {render};
})();
