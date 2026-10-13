const status=document.getElementById('status');
const log=text=>{status.textContent+='\n'+text;};
Object.assign(window,{language:'en',isProduction:false,isUserOnDiscord:false,isUserOnDiscordMobile:false,isUserOnMobile:false,analyticsActive:false,posthogKey:'',posthogHost:'',socketServerWSS:'ws://127.0.0.1:3001',assetPath:'/',frontendSentryDSN:'',mobileAppSentryDSN:'',versionNumber:'local-fixture'});
window.assetPath=location.origin+'/';
const cache={},stack=[];
let activeApp;
function load(id){
  if(cache[id])return cache[id].exports;
  const factory=labFactories[id];if(!factory)throw new Error(`Missing module ${id}; stack ${stack.join(' -> ')}`);
  const module={exports:{}};cache[id]=module;stack.push(id);
  try{factory(module,module.exports,load);return module.exports;}catch(error){delete cache[id];error.message+=`\nwhile loading ${id}`;throw error;}finally{stack.pop();}
}
load.d=(exports,definitions)=>{for(const key in definitions)if(!Object.prototype.hasOwnProperty.call(exports,key))Object.defineProperty(exports,key,{enumerable:true,get:definitions[key]});};
load.r=exports=>{Object.defineProperty(exports,'__esModule',{value:true});Object.defineProperty(exports,Symbol.toStringTag,{value:'Module'});};
load.n=module=>{const getter=module&&module.__esModule?()=>module.default:()=>module;load.d(getter,{a:getter});return getter;};
load.o=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
load.g=globalThis;load.j=651;load.p='/';load.hmd=module=>module;load.nmd=module=>module;
load.b=document.baseURI;
load.e=id=>Promise.reject(new Error(`Lazy chunk ${id} is not provisioned`));
load.t=(value,mode)=>{if(mode&1)value=load(value);if(mode&8)return value;if((mode&4)&&value&&value.__esModule)return value;const result={};load.r(result);load.d(result,{default:()=>value});if(mode&2&&value)for(const key of Object.keys(value))load.d(result,{[key]:()=>value[key]});return result;};
window.addEventListener('error',event=>log(`Error: ${event.message}`));
window.addEventListener('unhandledrejection',event=>log(`Rejected: ${event.reason?.message||event.reason}`));

let assetReady, currentManager, latestState, joined, socket, retry, buildMode, cleanupScene;
let pendingRender, rendering=false;
const $=id=>document.getElementById(id);
const sessionKey='private-settlers-renderer-session';
function assets(){
  if(assetReady)return assetReady;
  assetReady=(async()=>{
    // Match the verified preview load order across circular bundle dependencies.
    load(19590);load(68736);load(584);
    const pixi=load(39304).PIXI;
    const names=['game_spritesheet_0.47fb957cffb1b48762c0.json','game_spritesheet_1.2d5edbf64b4b0e0a8b4b.json','game_spritesheet_2.3a1a30742e6f65df9781.json','game_spritesheet_3.5088f30d6ffa2dc194b4.json','game_spritesheet_4.f589fb2f92cb5c72e3f9.json'];
    const sheets={};
    for(let index=0;index<names.length;index++){
      const response=await fetch('/assets/'+names[index]);if(!response.ok)throw new Error('Missing local assets; run npm run fetch:renderer-assets');
      const data=await response.json(), image=new Image();image.src='/assets/'+data.meta.image;await image.decode();
      const sheet=new pixi.Spritesheet(pixi.BaseTexture.from(image),data);await sheet.parse();sheets['game_spritesheet_'+index]=sheet;
    }
    const original=pixi.Assets.loadBundle.bind(pixi.Assets);
    pixi.Assets.loadBundle=(name,progress)=>name==='game'?(progress?.(1),Promise.resolve(sheets)):original(name,progress);
    await load(78046).UIGameSpriteHandler.loadAssets(false);
    return pixi;
  })().catch(error=>{assetReady=undefined;throw error;});
  return assetReady;
}
async function render(fixture,presentation,state){
  const pixi=await assets();
  if(!activeApp){activeApp=new pixi.Application({width:900,height:650,backgroundColor:0x0e69a3,antialias:true});$('board').replaceChildren(activeApp.view);load(71198).z.setCanvasConfigVariables(activeApp);}
  const app=activeApp;
  cleanupScene?.();
  for(const child of app.stage.removeChildren())child.destroy({children:true});
  for(const dot of $('board').querySelectorAll('.placement,.harbor-label'))dot.remove();
  const ticks=[];cleanupScene=()=>{for(const tick of ticks)app.ticker.remove(tick);};
  const tick=fn=>{ticks.push(fn);app.ticker.add(fn);};
  const animations=new Set();
  const manager={gameState:new(load(35606).n)(),canvasController:{app,appW:900,appH:650,chatWidth:0,itemSize:0},eventController:{registerUIGameMechanic:()=>{},registerUIGameAnimation:value=>animations.add(value),unregisterUIGameAnimation:value=>animations.delete(value),sendEvent:()=>{}},toolTipController:{createTip:()=>{},disableTip:()=>{}}};
  // Bind only the manager setter; constructing the entry class would run site startup.
  load(55547).gC.prototype.initializeGameManager.call({},manager);
  tick(()=>{for(const animation of [...animations])animation.onGameTick?.(app.ticker.elapsedMS,app.ticker.deltaTime);});
  load(80708).CA.sessionRecorder={conditionallyStartRecording:()=>{}};
  manager.gameController=new(load(68736).UIGameController)(manager,fixture);
  manager.mapController=new(load(584).UIWGameMapController)(manager);manager.mapController.createMap();currentManager=manager;
  const view=manager.mapController.mapView, map=manager.gameController.mapValidator.tileState;
  if(presentation&&presentation.robber>=0){
    const tile=map.tiles[presentation.robber],point=tile.hexFace.toPixel(view.mapCenter,view.hexagonHeight/2);
    // Local robber view uses the original texture; no original gameplay mechanic is invoked.
    const sprite=new pixi.Sprite(load(78046).UIGameSpriteHandler.getTextureFromSpritesheet(load(28398).tM.icon_robber));
    sprite.anchor.set(.5,.8);sprite.height=view.robberRadius;sprite.scale.x=sprite.scale.y;
    sprite.position.set(point.x-1.2*view.robberRadius,point.y-.7*view.robberRadius);sprite.zIndex=view.layers.robber;view.addChild(sprite);
  }
  const harborMarkers=[];
  for(const harbor of state?.harbors||[]){
    const edge=map.tileEdges[presentation.mapping.edges[harbor.edge]],point=edge.hexEdge.centerPointToPixel(view.mapCenter,view.hexagonHeight/2);

    // Shift the badge outwards; endpoint positions make harbor ownership unambiguous.
    const anchor=presentation.harborLocations.find(h=>h.edge===harbor.edge);const {x,y}=anchor,n=Math.hypot(x,y);point.x+=x/n*26;point.y+=y/n*26;
    const label=document.createElement('span');label.className='harbor-label';label.textContent=harbor.resource?`${harbor.resource} 2:1`:'Any 3:1';label.title=`Harbor at corners ${anchor.a} and ${anchor.b}`;$('board').append(label);harborMarkers.push({label,point});
  }
  const positionHarbors=()=>{const rect=app.view.getBoundingClientRect();for(const {label,point}of harborMarkers){const screen=view.toScreen(point);label.style.left=`${screen.x*rect.width/app.screen.width}px`;label.style.top=`${screen.y*rect.height/app.screen.height}px`;}};positionHarbors();tick(positionHarbors);
  if(state?.game&&joined&&state.game.currentPlayer===joined.playerId){
    const g=state.game;
    const markers=[];
    const targets=(ids,kind,type)=>ids.forEach(id=>{
      let point;
      if(kind==='corner')point=map.tileCorners[presentation.mapping.corners[id]].hexCorner.toPixel(view.mapCenter,view.hexagonHeight/2);
      else if(kind==='edge')point=map.tileEdges[presentation.mapping.edges[id]].hexEdge.centerPointToPixel(view.mapCenter,view.hexagonHeight/2);
      else {point=map.tiles[id].hexFace.toPixel(view.mapCenter,view.hexagonHeight/2);point.y+=view.hexagonHeight/4;}
      // DOM hit targets stay keyboard-accessible and independent of original UI event routing.
      const dot=document.createElement('button');dot.className='placement';dot.setAttribute('aria-label',`${type} ${id}`);dot.title=`${type} ${id}`;dot.onclick=()=>send(type,{id});$('board').append(dot);markers.push({dot,point});
    });
    if(g.phase==='settlement')targets(g.legalVertices,'corner','PlaceSettlement');
    if(g.phase==='free-road')targets(g.development.legalFreeRoads,'edge','PlaceFreeRoad');
    if(g.phase==='road')targets(g.legalEdges,'edge','PlaceRoad');
    if(g.phase==='build'&&buildMode)targets(g.builds[buildMode]||[],buildMode==='BuildRoad'?'edge':'corner',buildMode);
    if(g.phase==='robber')targets(state.board.map((_,i)=>i).filter(i=>i!==g.robber),'tile','MoveRobber');
    const positionMarkers=()=>{const rect=app.view.getBoundingClientRect();for(const {dot,point}of markers){const screen=view.toScreen(point);dot.style.left=`${screen.x*rect.width/app.screen.width}px`;dot.style.top=`${screen.y*rect.height/app.screen.height}px`;}};
    positionMarkers();tick(positionMarkers);
  }
  view.sortChildren();app.render();
  status.textContent=`Rendered ${manager.mapController.tileViews.length} tiles · ${manager.mapController.cornerController.buildingViews.length} buildings · ${map.tileEdges.filter(e=>e.owner!=null).length} roads`;
}
function scheduleRender(fixture,presentation,state){
  pendingRender=[fixture,presentation,state];if(rendering)return;rendering=true;
  requestAnimationFrame(async()=>{
    try{await assets();while(pendingRender){const next=pendingRender;pendingRender=undefined;await render(...next);}}
    catch(error){status.textContent=error.stack||error.message;pendingRender=undefined;}
    finally{rendering=false;}
  });
}
function send(type,extra={}){if(socket?.readyState!==WebSocket.OPEN)return;$('error').textContent='';socket.send(JSON.stringify({type,...extra}));}
const cardSprites={wood:'card_lumber',brick:'card_brick',sheep:'card_wool',wheat:'card_grain',ore:'card_ore'};
function sprite(name){const e=document.createElement('span');e.className='sprite-'+name;e.setAttribute('aria-hidden','true');return e;}
function cardBadge(resource,count){const card=document.createElement('div');card.className='resource-card';card.append(sprite(cardSprites[resource]||(resource==='resources'?'resourceback':'card_devcardback')));const n=document.createElement('strong');n.textContent=count;card.append(n);card.setAttribute('aria-label',`${resource}: ${count} cards`);card.title=`${resource}: ${count}`;return card;}
function appendLog(parent,text){const p=document.createElement('p');p.textContent=text;parent.append(p);while(parent.children.length>100)parent.firstElementChild.remove();parent.scrollTop=parent.scrollHeight;}
function publicEvents(state){const prev=latestState;if(!prev||prev.code!==state.code)return;const g=state.game,old=prev.game;if(!g){if(old)appendLog($('events'),'The host returned the table to the lobby.');return;}const name=id=>state.players.find(p=>p.id===id)?.name||'Player';
  for(const v of g.vertices){const before=old?.vertices[v.id];if(v.owner&&(!before?.owner||before.city!==v.city))appendLog($('events'),`${name(v.owner)} placed a ${v.city?'city':'settlement'}.`);}
  for(const e of g.edges)if(e.owner&&!old?.edges[e.id]?.owner)appendLog($('events'),`${name(e.owner)} placed a road.`);
  if(g.dice&&old?.phase==='roll'&&g.phase!=='roll')appendLog($('events'),`${name(g.currentPlayer)} rolled ${g.dice.join(' + ')}.`);
  if(g.robber!==old?.robber&&old)appendLog($('events'),`${name(g.currentPlayer)} moved the robber.`);
  if(g.development?.lastPlayed&&JSON.stringify(g.development.lastPlayed)!==JSON.stringify(old?.development?.lastPlayed))appendLog($('events'),`${name(g.development.lastPlayed.player)} played ${g.development.lastPlayed.type}.`);
  if(g.scoring?.winner&&!old?.scoring?.winner)appendLog($('events'),`${name(g.scoring.winner)} won with ${g.scoring.winningPoints} points.`);
}
const panelOpen={};
function actionPanel(label,key,state,render){const panel=document.createElement('details');panel.className='action-panel';panel.open=!!panelOpen[key];panel.ontoggle=()=>panelOpen[key]=panel.open;const summary=document.createElement('summary');summary.textContent=label;panel.append(summary);render(panel,state,joined.playerId,send);if(panel.children.length>1)$('actions').append(panel);}
function controls(state){
  const g=state.game, mine=g?.currentPlayer===joined?.playerId;
  $('hand').hidden=!g;
  $('hand').textContent='';
  $('score-panel').replaceChildren();
  const hints={settlement:'Choose a white corner marker for your settlement.',road:'Choose a white edge marker for your starting road.',roll:'Roll the dice to collect resources.',build:'Build, trade, or play a development card, then end your turn.',discard:'Players with more than seven cards must discard half their hand.',robber:'Choose a white tile marker to move the robber.',steal:'Choose a player to steal one random resource.', 'free-road':'Choose a white edge marker for a free road.',finished:'The host can return everyone to the lobby for a rematch.'};
  $('hint').textContent=g?(g.discardCount?`Select exactly ${g.discardCount} cards to discard.`:mine?hints[g.phase]||'':`Waiting for ${state.players.find(p=>p.id===g.currentPlayer)?.name||'the other players'}. ${g.phase==='discard'?hints.discard:''}`):'Start with bots to play alone, or invite friends with the room link.';
  $('room-info').replaceChildren();
  const roomTitle=document.createElement('strong');roomTitle.textContent=`Room ${state.code}`;$('room-info').append(roomTitle);
  const seats=document.createElement('div');seats.className='player-seats';$('room-info').append(seats);
  for(const p of state.players){const seat=document.createElement('div');seat.className='player-seat';if(p.id===g?.currentPlayer)seat.classList.add('active-seat');const name=document.createElement('strong');name.textContent=p.name+(p.id===joined.playerId?' · You':'')+(p.bot?' · Bot':'')+(p.online?'':' · Offline');seat.append(name);if(p.playing){const stats=document.createElement('div');stats.className='seat-stats';stats.append(cardBadge('resources',p.resourceCount),cardBadge('development',p.developmentCount));const points=document.createElement('span');points.textContent=`${p.points} points · ${p.knightsPlayed} knights · road ${g.scoring?.roadLengths[p.id]||0}`;stats.append(points);seat.append(stats);}seats.append(seat);}
  $('bank').replaceChildren();if(g){const label=document.createElement('strong');label.textContent='Bank';$('bank').append(label);for(const r of Object.keys(cardSprites))$('bank').append(cardBadge(r,g.bank?.[r]??'—'));$('bank').append(cardBadge('development',g.development?.remaining??'—'));}
  $('actions').replaceChildren();
  const button=(label,action,disabled=false)=>{const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=action;$('actions').append(b);return b;};
  if(!g){$('turn').textContent='Waiting to start';if(state.host===joined.playerId){button('Start with bots',()=>send('StartGame',{bots:true}));button('Start game',()=>send('StartGame'),state.players.filter(p=>p.online&&!p.bot).length<2);}return;}
  const player=state.players.find(p=>p.id===g.currentPlayer);
  $('turn').textContent=`${player?.name||'Player'}: ${g.phase}${g.dice?' · Dice '+g.dice.join(' + '):''}${mine?' · Your turn':''}`;
  for(const [resource,count]of Object.entries(g.resources||{}))$('hand').append(cardBadge(resource,count));
  $('score-panel').replaceChildren();ScoreControls.render($('score-panel'),state,joined.playerId,send);if(g.phase==='finished'){$('turn').textContent=`${player.name} wins with ${g.scoring.winningPoints} points!`;return;}
  if(mine&&g.phase==='roll')button('Roll dice',()=>send('RollDice'));
  if(mine&&g.phase==='build'){
    for(const [type,label]of Object.entries({BuildRoad:'Build road · wood + brick',BuildSettlement:'Build settlement · wood + brick + sheep + wheat',BuildCity:'Upgrade city · 2 wheat + 3 ore'})){const available=(g.builds[type]||[]).length>0;const b=button(label,()=>{buildMode=type;controls(state);scheduleRender(state.renderer.fixture,state.renderer,state);},!available);b.setAttribute('aria-pressed',String(buildMode===type));b.title=available?'Choose a legal location on the board.':'Requires enough resources, an available piece, and a legal location.';}
    if(buildMode){$('hint').textContent='Choose a white marker to build, or cancel placement.';button('Cancel placement',()=>{buildMode=null;controls(state);scheduleRender(state.renderer.fixture,state.renderer,state);});}
    button('End turn',()=>{buildMode=null;send('EndTurn');});
  }
  if(g.discardCount){
    const fields={};let discardButton;
    const update=()=>{const entries=Object.entries(fields),total=entries.reduce((sum,[,input])=>sum+Number(input.value),0);discardButton.textContent=`Discard ${total} / ${g.discardCount} cards`;discardButton.disabled=total!==g.discardCount||entries.some(([r,input])=>!Number.isInteger(Number(input.value))||Number(input.value)<0||Number(input.value)>g.resources[r]);};
    for(const [name,n]of Object.entries(g.resources)){const label=document.createElement('label');label.textContent=`${name} (${n} available)`;const input=document.createElement('input');input.type='number';input.min=0;input.max=n;input.value=0;input.oninput=update;label.append(input);fields[name]=input;$('actions').append(label);}
    discardButton=document.createElement('button');discardButton.onclick=()=>send('Discard',{cards:Object.fromEntries(Object.entries(fields).map(([r,input])=>[r,Number(input.value)]))});$('actions').append(discardButton);update();
  }
  if(mine&&g.phase==='steal')for(const id of g.victims)button('Steal from '+state.players.find(p=>p.id===id).name,()=>send('Steal',{player:id}));
  actionPanel('Development cards','development',state,DevelopmentControls.render);
  actionPanel('Trade','trade',state,TradeControls.render);
}
function connect(){
  socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/socket`);
  socket.onmessage=event=>{
    const state=JSON.parse(event.data);
    if(state.type==='SessionEstablished'){$('connection').textContent='Connected to local game server';$('create').disabled=$('join').disabled=false;let saved;try{saved=JSON.parse(sessionStorage.getItem(sessionKey));}catch{}if(saved)send('Resume',saved);}
    if(state.type==='Joined'){joined=state;sessionStorage.setItem(sessionKey,JSON.stringify({code:state.code,token:state.token}));$('lobby').hidden=true;$('probe').hidden=true;$('share').hidden=false;}
    if(state.type==='RoomState'){$('connection').textContent=state.persistence?'Connected · games saved locally':'Connected · temporary games';publicEvents(state);latestState=state;if(state.game?.phase!=='build')buildMode=null;controls(state);scheduleRender(state.renderer.fixture,state.renderer,state);}
    if(state.type==='Chat')appendLog($('chat-messages'),`${state.name}: ${state.text}`);
    if(state.type==='Error'){$('error').textContent=state.message;if(state.message.startsWith('Saved session')){sessionStorage.removeItem(sessionKey);joined=null;$('lobby').hidden=false;$('probe').hidden=false;}}
  };
  socket.onclose=()=>{$('connection').textContent='Disconnected. Reconnecting…';$('create').disabled=$('join').disabled=true;clearTimeout(retry);retry=setTimeout(connect,1500);};
  socket.onerror=()=>{$('connection').textContent='Unable to reach local server';};
}
$('create').onclick=()=>send('CreateRoom',{name:$('name').value});
$('join').onclick=()=>send('JoinRoom',{name:$('name').value,code:$('code').value.trim().toUpperCase()});
$('code').value=new URLSearchParams(location.search).get('room')||'';
$('chat-form').onsubmit=event=>{event.preventDefault();const text=$('chat-input').value.trim();if(text){send('Chat',{text});$('chat-input').value='';}};
$('share').onclick=async()=>{const url=new URL(location.href);url.searchParams.set('room',joined.code);try{await navigator.clipboard.writeText(url.href);$('share').textContent='Copied room link';setTimeout(()=>$('share').textContent='Copy room link',2000);}catch{$('error').textContent=`Room code: ${joined.code}. Copy the address and add ?room=${joined.code}`;}};
$('probe').onclick=async()=>{try{const fixture=await(await fetch('/fixture.json')).json();scheduleRender(fixture,{robber:Object.values(fixture.gameState.mapState.tileHexStates).findIndex(t=>t.type===0)});}catch(error){log(error.message);}};
connect();
