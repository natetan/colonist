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
let pendingRender, rendering=false,mapDragging=false;
const $=id=>document.getElementById(id);
function browserStorage(name){try{return window[name];}catch{return null;}}
function rememberPlayerName(){
  const storage=browserStorage('localStorage'),key='settlers-player-name',fields=[$('name'),$('invite-name')];
  let saved='';try{saved=storage?.getItem(key)||'';}catch{/* Storage may be blocked by browser settings. */}
  for(const field of fields){
    field.value=saved.slice(0,24);
    field.addEventListener('input',()=>{
      const name=field.value.slice(0,24);for(const other of fields)if(other!==field)other.value=name;
      try{if(name.trim())storage?.setItem(key,name);else storage?.removeItem(key);}catch{/* Naming still works without storage. */}
    });
  }
}
const seatSessions=SeatSessions.create(browserStorage('localStorage'),browserStorage('sessionStorage'));
let pendingResume;
function resumeSeat(saved){pendingResume=saved;send('Resume',saved);}
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
let placedState,cameraBoardKey;
function captureMapCamera(view){
  const center=view.toWorld(view.screenWidth/2,view.screenHeight/2);
  return {zoom:view.scale.x/view.initialFitScale,x:(center.x-view.mapCenter.x)/view.hexagonHeight,y:(center.y-view.mapCenter.y)/view.hexagonHeight};
}
function restoreMapCamera(view,camera){
  if(!camera)return;
  view.scale.set(view.initialFitScale*camera.zoom);
  view.moveCenter(view.mapCenter.x+camera.x*view.hexagonHeight,view.mapCenter.y+camera.y*view.hexagonHeight);
}
function configureMapPan(view,mechanics){
  // The inherited world clamps create zoom-dependent walls. Keep zoom limits,
  // but let players move the island freely inside the clipped canvas.
  for(const mechanic of mechanics)if(typeof mechanic.updateClamps==='function')mechanic.updateClamps=()=>{};
  view.plugins.remove('clamp');
}
function bindMapDrag(canvas){
  const pointers=new Set();
  canvas.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    pointers.add(event.pointerId);mapDragging=true;
    canvas.setPointerCapture(event.pointerId);
  });
  const release=event=>{
    pointers.delete(event.pointerId);mapDragging=pointers.size>0;
    if(!mapDragging&&pendingRender)scheduleRender(...pendingRender);
  };
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,release);
}
async function render(fixture,presentation,state){
  const pixi=await assets();
  const boardKey=state?state.code+':'+JSON.stringify(state.board):null;
  const camera=boardKey&&boardKey===cameraBoardKey&&currentManager?captureMapCamera(currentManager.mapController.mapView):null;
  const bounds=$('board').getBoundingClientRect(),width=Math.max(1,Math.round(bounds.width)||900),height=Math.max(1,Math.round(bounds.height)||650);
  if(!activeApp){activeApp=new pixi.Application({width,height,backgroundColor:0x0e69a3,antialias:true});$('board').replaceChildren(activeApp.view);load(71198).z.setCanvasConfigVariables(activeApp);bindMapDrag(activeApp.view);}
  const app=activeApp;
  if(app.screen.width!==width||app.screen.height!==height)app.renderer.resize(width,height);
  cleanupScene?.();
  for(const child of app.stage.removeChildren())child.destroy({children:true});
  for(const dot of $('board').querySelectorAll('.placement,.harbor-label'))dot.remove();
  const ticks=[];cleanupScene=()=>{for(const tick of ticks)app.ticker.remove(tick);};
  const tick=fn=>{ticks.push(fn);app.ticker.add(fn);};
  const animations=new Set(),mechanics=new Set();
  const manager={gameState:new(load(35606).n)(),canvasController:{app,appW:width,appH:height,chatWidth:0,itemSize:0},eventController:{registerUIGameMechanic:value=>mechanics.add(value),registerUIGameAnimation:value=>animations.add(value),unregisterUIGameAnimation:value=>animations.delete(value),sendEvent:()=>{}},toolTipController:{createTip:()=>{},disableTip:()=>{}}};
  // Bind only the manager setter; constructing the entry class would run site startup.
  load(55547).gC.prototype.initializeGameManager.call({},manager);
  tick(()=>{for(const animation of [...animations])animation.onGameTick?.(app.ticker.elapsedMS,app.ticker.deltaTime);});
  load(80708).CA.sessionRecorder={conditionallyStartRecording:()=>{}};
  manager.gameController=new(load(68736).UIGameController)(manager,fixture);
  manager.mapController=new(load(584).UIWGameMapController)(manager);manager.mapController.createMap();currentManager=manager;
  const view=manager.mapController.mapView, map=manager.gameController.mapValidator.tileState;
  configureMapPan(view,mechanics);
  view.initialFitScale=view.scale.x;restoreMapCamera(view,camera);cameraBoardKey=boardKey;
  if(state?.game&&placedState?.code===state.code&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    const dropping=[];
    for(const vertex of state.game.vertices){const old=placedState.game?.vertices[vertex.id];if(vertex.owner&&(!old?.owner||old.city!==vertex.city)){const corner=map.tileCorners[presentation.mapping.corners[vertex.id]],building=manager.mapController.cornerController.buildingViews.find(v=>v.corner===corner);if(building)dropping.push(building);}}
    for(const edge of state.game.edges){if(edge.owner&&!placedState.game?.edges[edge.id]?.owner){const native=map.tileEdges[presentation.mapping.edges[edge.id]];for(const mechanic of mechanics){const road=mechanic.roadViews?.find(v=>v.edge===native);if(road?.view)dropping.push(road.view);}}}
    const started=performance.now(),targets=dropping.map(piece=>({piece,y:piece.y}));
    for(const {piece,y}of targets)piece.y=y-140;
    tick(()=>{const t=Math.min(1,(performance.now()-started)/540),progress=t<.78?Math.pow(t/.78,2):1+Math.sin((t-.78)/.22*Math.PI)*.045;for(const {piece,y}of targets)piece.y=y-140*(1-progress);});
  }
  if(state?.game?.production&&placedState?.code===state.code&&state.game.production.sequence!==placedState.game?.production?.sequence){
    const rect=app.view.getBoundingClientRect();let stagger=0;
    for(const transfer of state.game.production.transfers){const tile=map.tiles[transfer.tile],point=tile.hexFace.toPixel(view.mapCenter,view.hexagonHeight/2),screen=view.toScreen(point),origin={getBoundingClientRect:()=>({left:rect.left+screen.x*rect.width/app.screen.width,top:rect.top+screen.y*rect.height/app.screen.height,width:0,height:0})},seat=[...$('room-info').querySelectorAll('[data-player-id]')].find(e=>e.dataset.playerId===transfer.player),target=seat?.querySelector('[data-resource="resources"]');for(let i=0;i<transfer.amount;i++)flyCard(cardSprites[transfer.resource],origin,target,stagger++*65);}
  }
  placedState=state;
  if(presentation&&presentation.robber>=0){
    const tile=map.tiles[presentation.robber],point=tile.hexFace.toPixel(view.mapCenter,view.hexagonHeight/2);
    // Local robber view uses the original texture; no original gameplay mechanic is invoked.
    const sprite=new pixi.Sprite(load(78046).UIGameSpriteHandler.getTextureFromSpritesheet(load(28398).tM.icon_robber));
    sprite.anchor.set(.5,.5);sprite.height=view.hexagonHeight*.38;sprite.scale.x=sprite.scale.y;
    sprite.position.set(point.x-view.hexagonWidth*.28,point.y+view.hexagonHeight*.08);sprite.zIndex=view.layers.robber;view.addChild(sprite);
  }
  const harborMarkers=[];
  for(const harbor of state?.harbors||[]){
    const edge=map.tileEdges[presentation.mapping.edges[harbor.edge]],point=edge.hexEdge.centerPointToPixel(view.mapCenter,view.hexagonHeight/2);

    // Shift the badge outwards; endpoint positions make harbor ownership unambiguous.
    const anchor=presentation.harborLocations.find(h=>h.edge===harbor.edge);const {dx,dy}=anchor;
    const piers=new pixi.Graphics();piers.zIndex=view.layers.robber;for(const id of [anchor.a,anchor.b]){const start=map.tileCorners[presentation.mapping.corners[id]].hexCorner.toPixel(view.mapCenter,view.hexagonHeight/2),end={x:point.x+dx*42,y:point.y+dy*42},vx=end.x-start.x,vy=end.y-start.y,length=Math.hypot(vx,vy),ux=vx/length,uy=vy/length;piers.lineStyle(8,0xd49d35).moveTo(start.x,start.y).lineTo(end.x,end.y);for(let d=4;d<length;d+=5)piers.lineStyle(1,0x805728).moveTo(start.x+ux*d-uy*4,start.y+uy*d+ux*4).lineTo(start.x+ux*d+uy*4,start.y+uy*d-ux*4);}view.addChild(piers);
    point.x+=dx*48;point.y+=dy*48;
    const label=document.createElement('span');label.className='harbor-label harbor-boat';label.setAttribute('aria-label',harbor.resource?`${harbor.resource} harbor 2:1`:'Generic harbor 3:1');
    if(harbor.resource)label.append(sprite({wood:'port_lumber',brick:'port_brick',sheep:'port_wool',wheat:'port_grain',ore:'port_ore'}[harbor.resource]));else{const sail=document.createElement('span');sail.className='generic-boat';sail.textContent='?';label.append(sail);}
    label.title=`${harbor.resource||'Any resource'} ${harbor.resource?'2:1':'3:1'} · corners ${anchor.a} and ${anchor.b}`;$('board').append(label);harborMarkers.push({label,point});
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
  pendingRender=[fixture,presentation,state];if(rendering||mapDragging)return;rendering=true;
  requestAnimationFrame(async()=>{
    try{await assets();while(pendingRender&&!mapDragging){const next=pendingRender;pendingRender=undefined;await render(...next);}}
    catch(error){status.textContent=error.stack||error.message;pendingRender=undefined;}
    finally{rendering=false;}
  });
}
if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{
  const board=$('board');
  if(activeApp&&latestState&&board.clientWidth&&board.clientHeight&&(Math.round(board.clientWidth)!==activeApp.screen.width||Math.round(board.clientHeight)!==activeApp.screen.height))scheduleRender(latestState.renderer.fixture,latestState.renderer,latestState);
}).observe($('board'));
function send(type,extra={}){if(socket?.readyState!==WebSocket.OPEN)return;$('error').textContent='';socket.send(JSON.stringify({type,...extra}));}
const cardSprites={wood:'card_lumber',brick:'card_brick',sheep:'card_wool',wheat:'card_grain',ore:'card_ore'};
function sprite(name){const e=document.createElement('span');e.className='sprite-'+name;e.setAttribute('aria-hidden','true');return e;}
const diceArtwork={"1":"dice_1.6828d855c054bbb331d3.svg","2":"dice_2.05d31959b2838006865b.svg","3":"dice_3.bdf9bed70b715ad2ab2c.svg","4":"dice_4.ec56593699eed0f02856.svg","5":"dice_5.e2e4c9085fa4a5ed783a.svg","6":"dice_6.68f39630050519374015.svg"};
const actionArtwork={"bg_button":"bg_button.6fb386c356a3e9b580e2.svg","icon_pass_turn":"icon_pass_turn.8d5b7a48c40a85b859cd.svg","icon_trade":"icon_trade.db2aa231787fcdbc1a67.svg","card_devcardback":"card_devcardback.92569a1abd04a8c1c17e.svg","road_red":"road_red.41c6cbd9278108542715.svg","settlement_red":"settlement_red.22949197b57f9cfd968b.svg","city_red":"city_red.991ae0c7a0b95da9811d.svg","road_blue":"road_blue.3301e2eed15cae5a6a05.svg","settlement_blue":"settlement_blue.bad4cdb43d65c329deda.svg","city_blue":"city_blue.43d846e83515f35f51f6.svg","road_orange":"road_orange.07bb26b8c1e63dd438c7.svg","settlement_orange":"settlement_orange.774ddafc8cc0595acdb7.svg","city_orange":"city_orange.f49c8fb13a589f8d0c68.svg","road_green":"road_green.d206aed3747b3687bc40.svg","settlement_green":"settlement_green.1b78c696cd137be02fae.svg","city_green":"city_green.d7ea2b2bde643e17efe1.svg","road_purple":"road_purple.44404500b4749200ee0c.svg","settlement_purple":"settlement_purple.af6c0adb105271efbfb5.svg","city_purple":"city_purple.a9868c1fc12671447ea3.svg","road_white":"road_white.78e66baab120779d5c30.svg","settlement_white":"settlement_white.a642a431b4bb73d63dae.svg","city_white":"city_white.cca576079023a2bdc80f.svg"};
Object.assign(actionArtwork,{icon_trade_bank_check:'icon_trade_bank_check.cca85e07979a94c78dac.svg',icon_trade_opponents_check:'icon_trade_opponents_check.90ff25f49e3eede7c0bb.svg',icon_x:'icon_x.5efbc794816c7abe462b.svg'});
function actionIcon(name){const img=document.createElement('img');img.className='action-icon';img.src='/assets/'+actionArtwork[name];img.alt='';img.draggable=false;return img;}
function sidebarIcon(name){const img=document.createElement('img');img.src='/assets/'+({army:'icon_largest_army.206b49b3c9d2b206f699.svg',road:'icon_longest_road.5cfdeb3352b20463e64b.svg',roadAward:'icon_longest_road_highlight.50dc66b851ecee9a8662.svg',development:actionArtwork.card_devcardback,back:'card_rescardback.03c18312a76028b0d9c9.svg',bank:'bank.825b2690b4b1b694d646.svg'}[name]);img.alt='';img.draggable=false;return img;}
function cardBadge(resource,count){const card=document.createElement('div');card.className='resource-card';card.dataset.resource=resource;card.append(resource==='resources'?sidebarIcon('back'):resource==='development'?sidebarIcon('development'):sprite(cardSprites[resource]||'card_devcardback'));const n=document.createElement('strong');n.textContent=count;card.append(n);card.setAttribute('aria-label',`${resource}: ${count} cards`);card.title=`${resource}: ${count}`;return card;}
// Keep the exact count on top while capping the visual fan for large hands.
function resourceStack(card,count){
  let art=card.querySelector('.resource-stack-art');
  if(!art){art=document.createElement('span');art.className='resource-stack-art';card.firstElementChild.replaceWith(art);}
  const layers=Math.max(1,Math.min(count,5));art.replaceChildren();
  for(let i=0;i<layers;i++){const image=sprite(cardSprites[card.dataset.resource]);image.style.left=(i*8)+'px';art.append(image);}
  card.style.width=(42+(layers-1)*8)+'px';card.classList.add('resource-hand-stack');
  card.classList.toggle('resource-stack-empty',count===0);
}
function flyCard(art,origin,target,delay=0){
  if(!origin||!target||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const a=origin.getBoundingClientRect(),b=target.getBoundingClientRect(),flight=sprite(art);flight.classList.add('flying-card');flight.style.left=(a.left+a.width/2-21)+'px';flight.style.top=(a.top+a.height/2-30)+'px';document.body.append(flight);
  const animation=flight.animate([{transform:'translate(0,0) scale(.9)',opacity:1},{transform:'translate('+(b.left+b.width/2-a.left-a.width/2)+'px,'+(b.top+b.height/2-a.top-a.height/2)+'px) scale(1)',opacity:1}],{duration:650,delay,easing:'cubic-bezier(.2,.6,.3,1)',fill:'backwards'});animation.finished.catch(()=>{}).finally(()=>flight.remove());
}
function resourceFeedback(previous,state){
  if(!previous?.game?.resources||previous.code!==state.code||!state.game?.resources)return;
  const gains=Object.entries(state.game.resources).filter(([r,n])=>n>(previous.game.resources[r]||0)).map(([r,n])=>[r,n-(previous.game.resources[r]||0)]);
  for(const [r,n]of Object.entries(state.game.resources)){const spent=(previous.game.resources[r]||0)-n,returned=(state.game.bank?.[r]||0)-(previous.game.bank?.[r]||0);if(spent>0&&returned>=spent)for(let i=0;i<Math.min(spent,5);i++)flyCard(cardSprites[r],$('hand').querySelector('[data-resource="'+r+'"]'),$('bank').querySelector('[data-resource="'+r+'"]'),i*75);}
  const oldCards=new Set((previous.game.development?.cards||[]).map(c=>c.id));
  for(const card of state.game.development?.cards||[])if(!oldCards.has(card.id)){const target=$('hand').querySelector('[data-development-type="'+card.type+'"]')||$('hand');flyCard(developmentCatalog[card.type]?.picture||'card_devcardback',$('bank').querySelector('[data-resource="development"]'),target,160);}
  if(!gains.length)return;
  const notice=document.createElement('div');notice.className='resource-notice';notice.setAttribute('role','status');notice.textContent='Received '+gains.map(([r,n])=>`+${n} ${r}`).join(' · ');$('hand').append(notice);setTimeout(()=>notice.remove(),4000);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  for(const [r,n]of gains){if(state.game.production&&state.game.production.sequence!==previous.game.production?.sequence)continue;const target=$('hand').querySelector(`[data-resource="${r}"]`),bank=$('bank').querySelector(`[data-resource="${r}"]`),fromBank=(previous.game.bank?.[r]??0)-(state.game.bank?.[r]??0)>=n,origin=fromBank?bank:$('board');if(!target||!origin||reduced)continue;const a=origin.getBoundingClientRect(),b=target.getBoundingClientRect();for(let i=0;i<Math.min(n,5);i++){const flight=sprite(cardSprites[r]);flight.classList.add('flying-card');flight.style.left=`${a.left+a.width/2-21}px`;flight.style.top=`${a.top+a.height/2-30}px`;document.body.append(flight);const animation=flight.animate([{transform:'translate(0,0) scale(.8)',opacity:1},{transform:`translate(${b.left+b.width/2-a.left-a.width/2}px,${b.top+b.height/2-a.top-a.height/2}px) scale(1)`,opacity:1}],{duration:650,delay:i*90,easing:'cubic-bezier(.2,.6,.3,1)'});animation.finished.catch(()=>{}).finally(()=>flight.remove());}}
}
function appendLog(parent,content){const follow=parent.scrollHeight-parent.scrollTop-parent.clientHeight<35,p=document.createElement('p');if(typeof content==='string')p.textContent=content;else p.append(content);parent.append(p);while(parent.children.length>500)parent.firstElementChild.remove();if(follow)parent.scrollTop=parent.scrollHeight;}
function feedEntry(state,id,verb,icons=[]){const row=document.createElement('span');row.className='feed-entry';const player=state.players.find(p=>p.id===id);if(player){const avatar=sprite(player.bot?'icon_bot':'icon_player');avatar.classList.add('feed-avatar');const name=document.createElement('strong');name.textContent=player.name;const colors=['#d9363e','#205ebd','#ba5d24','#237c1d','#8746ac','#666'];name.style.color=colors[state.players.filter(p=>p.playing).findIndex(p=>p.id===id)]||'#555';row.append(avatar,name);}row.append(document.createTextNode(' '+verb+' '));for(const icon of icons){icon.classList.add('feed-icon');row.append(icon);}return row;}
function publicEvents(state){const prev=latestState;if(!prev||prev.code!==state.code){if(prev?.code!==state.code){$('events').replaceChildren();$('chat-messages').replaceChildren();appendLog($('events'),'Welcome to your private table.');}return;}const g=state.game,old=prev.game;if(g?.lastTimeout&&g.lastTimeout.sequence!==old?.lastTimeout?.sequence)appendLog($('events'),feedEntry(state,g.lastTimeout.player,g.lastTimeout.setup?'ran out of time. Setup was completed automatically.':'ran out of time. Turn skipped.'));if(!g){if(old)appendLog($('events'),'The host returned the table to the lobby.');return;}
  const piece=(id,type)=>actionIcon(type+'_'+(['red','blue','orange','green','purple','white'][state.players.filter(p=>p.playing).findIndex(p=>p.id===id)]||'red'));
  const event=(id,verb,icons)=>appendLog($('events'),feedEntry(state,id,verb,icons));
  for(const v of g.vertices){const before=old?.vertices[v.id];if(v.owner&&(!before?.owner||before.city!==v.city))event(v.owner,v.city?'built a City (+1 VP)':'placed a Settlement',[piece(v.owner,v.city?'city':'settlement')]);}
  for(const e of g.edges)if(e.owner&&!old?.edges[e.id]?.owner)event(e.owner,'placed a Road',[piece(e.owner,'road')]);
  if(g.dice&&old?.phase==='roll'&&g.phase!=='roll'){const dice=g.dice.map(n=>{const img=document.createElement('img');img.src='/assets/'+diceArtwork[n];img.alt='Die '+n;return img;});event(g.currentPlayer,'rolled',dice);}
  if(old?.robber!==undefined&&g.robber!==old.robber)event(g.currentPlayer,'moved the Robber',[sprite('icon_robber')]);
  if(g.development?.lastPlayed&&JSON.stringify(g.development.lastPlayed)!==JSON.stringify(old?.development?.lastPlayed)){const played=g.development.lastPlayed,info=developmentCatalog[played.type];event(played.player,'played '+(info?.name||played.type),info?[sprite(info.picture)]:[]);}
  for(const [r,n]of Object.entries(g.resources||{})){const gain=n-(old?.resources?.[r]??n);if(gain>0)event(joined.playerId,'received '+gain,[sprite(cardSprites[r])]);}
  if(g.scoring?.winner&&!old?.scoring?.winner)event(g.scoring.winner,'won with '+g.scoring.winningPoints+' points!');
}
const panelOpen={};
function closePanels(except){for(const p of $('actions').querySelectorAll('.action-panel'))if(p!==except){p.open=false;panelOpen[p.dataset.panel]=false;if(p.dataset.panel==='trade'){tradeDraft={give:{},receive:{},to:''};syncTradeInventory(latestState,p);}}}
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.action-panel')&&!(panelOpen.trade&&event.target.closest('#hand')))closePanels();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closePanels();});
function actionPanel(label,key,state,render,enabled=true){const panel=document.createElement('details');panel.className='action-panel';panel.dataset.panel=key;panel.open=enabled&&!!panelOpen[key];if(!enabled)panelOpen[key]=false;panel.ontoggle=()=>{if(panel.isConnected){panelOpen[key]=panel.open;if(key==='trade'){if(!panel.open)tradeDraft={give:{},receive:{},to:''};if(enabled)referenceTrade(panel,state,joined.playerId,send);summary.replaceChildren(actionIcon(panel.open?'icon_x':'icon_trade'));summary.setAttribute('aria-label',panel.open?'Close trade':'Trade');syncTradeInventory(state,panel);}}};const summary=document.createElement('summary');summary.setAttribute('aria-label',label);summary.setAttribute('aria-disabled',String(!enabled));summary.title=enabled?label:label+' · Roll first, or wait for your turn';summary.onclick=event=>{if(!enabled){event.preventDefault();return;}closePanels(panel);panelOpen[key]=!panel.open;};summary.append(actionIcon(key==='trade'?(panel.open?'icon_x':'icon_trade'):'card_devcardback'));panel.append(summary);if(enabled)render(panel,state,joined.playerId,send);$('actions').append(panel);}
let tradeDraft={give:{},receive:{},to:''},tradeRoom;
function reconcileTradeDraft(previous,state){
  if(previous?.game?.tradeOffer&&!state.game?.tradeOffer&&!state.game?.tradeDecline)closePanels();
}
function syncTradeInventory(state,panel){
  if(!state?.game)return;const open=panel.open&&state.game.currentPlayer===joined.playerId;
  for(const card of $('hand').querySelectorAll('.resource-card[data-resource]')){
    const r=card.dataset.resource,total=state.game.resources[r];if(total===undefined)continue;
    const remaining=Math.max(0,total-(open?(tradeDraft.give[r]||0):0)),canOffer=state.game.phase==='build'&&state.game.currentPlayer===joined.playerId&&remaining>0;
    card.hidden=remaining===0;card.querySelector('strong').textContent=remaining;resourceStack(card,remaining);card.title=r+': '+remaining+(open?' remaining':' cards');card.tabIndex=canOffer?0:-1;card.setAttribute('role',canOffer?'button':'group');card.setAttribute('aria-label',canOffer?'Offer '+r+', '+remaining+' remaining':r+': '+remaining+' cards');card.classList.toggle('trade-hand-selectable',canOffer);
    card.onclick=canOffer?()=>{if(tradeDraft.receive[r])return;if(!panel.open){closePanels(panel);panel.open=true;panelOpen.trade=true;}tradeDraft.give[r]=(tradeDraft.give[r]||0)+1;referenceTrade(panel,state,joined.playerId,send);syncTradeInventory(state,panel);}:null;
    card.onkeydown=canOffer?event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();card.click();}}:null;
  }
}
function referenceTrade(parent,state,viewerId,send){
  const g=state.game;if(tradeRoom!==state.code){tradeRoom=state.code;tradeDraft={give:{},receive:{},to:''};}
  let ui=parent.querySelector('.reference-trade');if(!ui){ui=document.createElement('section');ui.className='reference-trade trade-controls';parent.append(ui);}else ui.replaceChildren();
  const chooser=document.createElement('div'),offer=document.createElement('div'),hand=document.createElement('div'),rail=document.createElement('div');chooser.className='trade-selector parchment';offer.className='trade-proposal parchment';hand.className='trade-hand parchment';rail.className='trade-rail';ui.append(chooser,offer,rail);
  const repaint=()=>{const focused=ui.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;referenceTrade(parent,state,viewerId,send);syncTradeInventory(state,parent);if(focused){const next=[...ui.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===focused&&!b.disabled);next?.focus({preventScroll:true});}};
  const card=(container,r,n,label,click,disabled=false)=>{const b=document.createElement('button');b.type='button';b.className='trade-stack';b.setAttribute('aria-label',label);b.title=label;b.disabled=disabled;b.append(cardBadge(r,n));b.onclick=()=>{click();repaint();};container.append(b);};
  const mine=g.currentPlayer===viewerId;
  for(const r of Object.keys(cardSprites))card(chooser,r,'',`Request ${r}`,()=>{tradeDraft.receive[r]=(tradeDraft.receive[r]||0)+1;},!mine||!!tradeDraft.give[r]);
  const wanted=document.createElement('div'),given=document.createElement('div');wanted.className='offer-row';given.className='offer-row';const incoming=document.createElement('span'),outgoing=document.createElement('span');incoming.textContent='♧ ↓';outgoing.textContent='You ↑';wanted.append(incoming);given.append(outgoing);offer.append(wanted,given);
  for(const [r,n]of Object.entries(tradeDraft.receive))if(n)card(wanted,r,n,`Remove requested ${r}`,()=>tradeDraft.receive[r]--);
  for(const [r,n]of Object.entries(tradeDraft.give))if(n)card(given,r,n,`Remove offered ${r}`,()=>tradeDraft.give[r]--);

  const give=Object.fromEntries(Object.entries(tradeDraft.give).filter(([,n])=>n>0)),receive=Object.fromEntries(Object.entries(tradeDraft.receive).filter(([,n])=>n>0)),a=Object.keys(give),b=Object.keys(receive),valid=mine&&a.length>0&&b.length>0&&a.every(r=>give[r]<=g.resources[r]&&!receive[r]);
  const bankValid=valid&&a.length===1&&b.length===1&&receive[b[0]]===1&&give[a[0]]===(g.bankRates?.[a[0]]||4)&&g.bank[b[0]]>0;
  const opponents=state.players.filter(p=>p.playing&&p.online&&p.id!==viewerId);
  if(opponents.length){const select=document.createElement('select');select.setAttribute('aria-label','Trade recipient');const all=document.createElement('option');all.value='all';all.textContent='All players';select.append(all);select.value='all';for(const p of opponents){const o=document.createElement('option');o.value=p.id;o.textContent=p.name;select.append(o);}if(tradeDraft.to==='all'||opponents.some(p=>p.id===tradeDraft.to))select.value=tradeDraft.to;tradeDraft.to=select.value;select.onchange=()=>tradeDraft.to=select.value;offer.append(select);}
  const action=(label,icon,disabled,fn)=>{const button=document.createElement('button');button.setAttribute('aria-label',label);button.title=label;button.disabled=disabled;button.append(actionIcon(icon));button.onclick=fn;rail.append(button);};
  action('Trade with bank','icon_trade_bank_check',!bankValid,()=>{send('BankTrade',{give:a[0],receive:b[0]});tradeDraft.give={};tradeDraft.receive={};closePanels();});
  action('Send player offer','icon_trade_opponents_check',!valid||!opponents.length,()=>send('OfferTrade',{player:tradeDraft.to,give,receive}));

  const help=document.createElement('p');help.className='trade-requirements';help.textContent=bankValid?'Bank exchange ready':a.length===1?`Bank rate: ${g.bankRates?.[a[0]]||4} ${a[0]} for one card. Select cards to offer below, then request above.`:'Select cards to offer below, then request above.';offer.append(help);
  if(g.tradeOffer){const existing=g.tradeOffer;const status=document.createElement('p');status.textContent='Pending offer · '+state.players.find(p=>p.id===existing.from)?.name+' → '+(existing.to===null?'All players':state.players.find(p=>p.id===existing.to)?.name);offer.append(status);for(const [label,type,allowed]of [['Cancel offer','CancelTrade',existing.from===viewerId],['Accept offer','AcceptTrade',mayRespond(existing,viewerId)&&g.canAcceptTrade],['Decline offer','DeclineTrade',mayRespond(existing,viewerId)]])if(allowed){const button=document.createElement('button');button.textContent=label;button.onclick=()=>send(type,{offerId:existing.id});offer.append(button);}}
}
// Shared notifications: plain text, bounded stacking, and automatic cleanup.
function notify(message,{celebrate=false,duration=4500}={}){
  let region=$('notifications');if(!region){region=document.createElement('div');region.id='notifications';region.setAttribute('role','status');region.setAttribute('aria-live','polite');document.body.append(region);}
  const toast=document.createElement('div');toast.className='game-notification';toast.textContent=message;region.append(toast);
  while(region.children.length>3)region.firstElementChild.remove();
  setTimeout(()=>toast.remove(),duration);
  if(celebrate)celebrateAward();
}
let confettiCleanup;
function celebrateAward(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  let layer=$('award-confetti');if(!layer){layer=document.createElement('div');layer.id='award-confetti';layer.setAttribute('aria-hidden','true');document.body.append(layer);}
  clearTimeout(confettiCleanup);layer.replaceChildren();
  const colors=['#f3bd44','#68ccdc','#f3ecce','#e56c77','#87c878'];
  for(let i=0;i<32;i++){const piece=document.createElement('i');piece.style.left=((i+.2+Math.random()*.6)/32*100)+'%';piece.style.backgroundColor=colors[i%colors.length];piece.style.setProperty('--drift',(Math.random()*100-50)+'px');piece.style.animationDelay=(Math.random()*.35)+'s';piece.style.animationDuration=(2.1+Math.random()*.5)+'s';layer.append(piece);}
  confettiCleanup=setTimeout(()=>layer.remove(),3100);
}
let audioContext,diceRollAudio,soundEnabled=localStorage.getItem('settlers-sound')!=='off',turnKey;
let clockOffset=0,warningDeadline,warningTicks=new Set();
function unlockSound(){if(!soundEnabled)return;try{audioContext??=new AudioContext();audioContext.resume().catch(()=>{});}catch{/* Audio is optional on browsers without Web Audio. */}}
for(const event of ['pointerdown','keydown'])document.addEventListener(event,unlockSound);
function cue(kind='turn'){
  if(!soundEnabled||!audioContext||audioContext.state!=='running')return;
  const now=audioContext.currentTime;
  const tone=(frequency,volume,decay,delay=0,type='sine',endFrequency)=>{
    const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),start=now+delay;oscillator.type=type;
    oscillator.frequency.setValueAtTime(frequency,start);if(endFrequency)oscillator.frequency.exponentialRampToValueAtTime(endFrequency,start+decay);
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.006);gain.gain.exponentialRampToValueAtTime(.0001,start+decay);
    oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(start);oscillator.stop(start+decay+.02);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  };
  if(kind==='warning'){tone(1200,.12,.09,0,'triangle');return;}
  if(kind==='dice'){
    diceRollAudio??=new Audio('/audio/dice-roll-sound.mp3');diceRollAudio.preload='auto';diceRollAudio.volume=.85;
    diceRollAudio.currentTime=0;diceRollAudio.play().catch(()=>{});return;
  }
  if(['road','settlement','city','robber'].includes(kind)){
    // A brief broadband contact click over hollow plastic resonances.
    const buffer=audioContext.createBuffer(1,Math.ceil(audioContext.sampleRate*.045),audioContext.sampleRate),samples=buffer.getChannelData(0);
    for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*Math.exp(-i/(audioContext.sampleRate*.008));
    const click=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),impact=audioContext.createGain();
    click.buffer=buffer;filter.type='bandpass';filter.frequency.value=1900;filter.Q.value=.7;impact.gain.value=.65;
    click.connect(filter);filter.connect(impact);impact.connect(audioContext.destination);click.start(now);click.onended=()=>{click.disconnect();filter.disconnect();impact.disconnect();};
    tone(kind==='city'?340:460,.25,.085,0,'sine',kind==='city'?210:290);
    tone(1250,.12,.035,.001,'triangle',850);
    tone(690,.075,.055,.012,'sine',510);
    return;
  }
  if(kind==='longestRoad'||kind==='largestArmy'){
    const notes=kind==='longestRoad'?[523.25,659.25,783.99,1046.5]:[392,523.25,659.25,783.99];
    notes.forEach((frequency,i)=>{tone(frequency,.075,i===3?.65:.22,i*.13,'triangle');tone(frequency*2,.018,.2,i*.13);});return;
  }
  // A struck bell: a clear fundamental with softer, quickly fading overtones.
  for(const [frequency,volume,decay]of [[880,.12,.95],[1760,.035,.55],[2376,.012,.3]])tone(frequency,volume,decay);
}
function turnFeedback(state){
  if(Number.isFinite(state.serverTime))clockOffset=state.serverTime-Date.now();
  const g=state.game,old=latestState?.code===state.code?latestState.game:null,key=state.code+':'+g?.currentPlayer+':'+g?.phase;
  if(key!==turnKey){turnKey=key;if(g?.currentPlayer===joined.playerId&&['roll','settlement'].includes(g.phase))cue();}
  if(!g||!old)return;
  if(g.production?.sequence!=null&&g.production.sequence!==old.production?.sequence)cue('dice');
  const addedRoad=g.edges?.some(e=>e.owner&&!old.edges?.some(previous=>previous.id===e.id&&previous.owner===e.owner));
  const placed=g.vertices?.find(v=>v.owner&&(!old.vertices?.some(previous=>previous.id===v.id&&previous.owner===v.owner)||v.city&&!old.vertices?.find(previous=>previous.id===v.id)?.city));
  if(placed)cue(placed.city?'city':'settlement');else if(addedRoad)cue('road');else if(g.robber!==old.robber)cue('robber');
  let celebrated=false;
  for(const award of ['longestRoad','largestArmy'])if(g.scoring?.[award]&&g.scoring[award]!==old.scoring?.[award]){
    cue(award);const player=state.players?.find(p=>p.id===g.scoring[award]);
    notify(`${player?.name||'A player'} has achieved ${award==='longestRoad'?'Longest Road':'Largest Army'}!`,{celebrate:!celebrated});celebrated=true;
  }
  if(g.scoring?.winner&&g.scoring.winner!==old.scoring?.winner){
    const player=state.players?.find(p=>p.id===g.scoring.winner);
    notify(`${player?.name||'A player'} has won!`,{celebrate:!celebrated});
  }
}
function updateTurnClock(){
  const state=latestState,g=state?.game,clock=$('phase-clock'),timer=g?.turnTimer;
  if(!timer){clock.textContent='Off';clock.classList.toggle('timer-urgent',false);return;}
  const seconds=Math.max(0,Math.ceil((timer.deadline-Date.now()-clockOffset)/1000)),deadlineKey=state.code+':'+timer.key+':'+timer.deadline;
  if(warningDeadline!==deadlineKey){warningDeadline=deadlineKey;warningTicks.clear();}
  clock.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');clock.title='Time remaining in this turn';clock.setAttribute('aria-label','Turn time remaining '+clock.textContent);clock.classList.toggle('timer-urgent',seconds<=8);
  if(seconds>0&&seconds<=8&&(g.currentPlayer===joined?.playerId||g.discardCount>0)&&!warningTicks.has(seconds)){warningTicks.add(seconds);cue('warning');}
}
setInterval(updateTurnClock,250);
let developmentChoice,selectedVictim,developmentCatalog={"Knight":{"name":"Knight","picture":"card_knight","effect":"Move the robber to another tile, then steal one random resource card from an eligible player."},"VictoryPoint":{"name":"Victory point","picture":"card_vp","effect":"Adds one private victory point automatically. You do not play this card."},"Monopoly":{"name":"Monopoly","picture":"card_monopoly","effect":"Choose one resource. Collect all cards of that resource from every other player."},"RoadBuilding":{"name":"Road building","picture":"card_roadbuilding","effect":"Place up to two roads for free, following normal placement rules and piece limits."},"YearOfPlenty":{"name":"Year of plenty","picture":"card_yearofplenty","effect":"Choose two available resource cards from the bank. You may choose the same resource twice if available."}},developmentPicks=[];
const cardTip=document.createElement('div');cardTip.className='card-tooltip';cardTip.hidden=true;cardTip.id='development-tooltip';cardTip.setAttribute('role','tooltip');document.body.append(cardTip);
function showCardTip(element,info,status){cardTip.replaceChildren();const title=document.createElement('strong');title.textContent=info.name;const effect=document.createElement('p');effect.textContent=info.effect;const availability=document.createElement('p');availability.textContent=status;cardTip.append(title,effect,availability);const rect=element.getBoundingClientRect();cardTip.style.left=Math.max(8,Math.min(rect.left,innerWidth-308))+'px';cardTip.hidden=false;cardTip.style.top=Math.max(8,rect.top-cardTip.offsetHeight-10)+'px';}

const actionCosts={'Build road':{wood:1,brick:1},'Build settlement':{wood:1,brick:1,sheep:1,wheat:1},'Upgrade city':{wheat:2,ore:3},'Buy development card':{sheep:1,wheat:1,ore:1}};
let costTarget;
$('actions').addEventListener('pointermove',event=>{const button=event.target.closest('button');const key=Object.keys(actionCosts).find(k=>button?.getAttribute('aria-label')?.startsWith(k));if(!key){if(costTarget){cardTip.hidden=true;costTarget=null;}return;}if(costTarget===button&&!cardTip.hidden)return;costTarget=button;showCostTip(button,key);});
$('actions').addEventListener('pointerleave',()=>{if(costTarget){cardTip.hidden=true;costTarget=null;}});
function showCostTip(button,key){showCardTip(button,{name:key,effect:'Resource cost'},button.disabled?'Unavailable: roll first, gather resources, or choose a legal build location.':'Click to buy or choose a placement.');const row=document.createElement('div');row.className='cost-tooltip-cards';for(const [resource,count]of Object.entries(actionCosts[key])){const card=document.createElement('span');card.append(sprite(cardSprites[resource]));const n=document.createElement('strong');n.textContent=count;card.append(n);row.append(card);}cardTip.insertBefore(row,cardTip.lastElementChild);const rect=button.getBoundingClientRect();cardTip.style.top=Math.max(8,rect.top-cardTip.offsetHeight-10)+'px';}

function robberAction(state,mine){
  const g=state.game,box=$('action-box');box.replaceChildren();box.hidden=!mine||!['robber','steal'].includes(g?.phase);if(box.hidden){selectedVictim=null;return;}
  const header=document.createElement('div');header.className='robber-header';header.append(sprite('icon_robber'));const text=document.createElement('div');const title=document.createElement('strong');title.textContent='The Robber';const help=document.createElement('p');help.textContent=g.phase==='robber'?'Choose a tile to move the robber':'Choose a player to steal 1 random card';text.append(title,help);header.append(text);box.append(header);if(g.phase!=='steal')return;
  if(!g.victims.includes(selectedVictim))selectedVictim=g.victims.length===1?g.victims[0]:null;const row=document.createElement('div');row.className='robber-victims';
  for(const id of g.victims){const p=state.players.find(p=>p.id===id),b=document.createElement('button');b.className='robber-victim';b.setAttribute('aria-label',`Select ${p.name}, ${p.resourceCount} resource cards`);b.setAttribute('aria-pressed',String(selectedVictim===id));const avatar=document.createElement('span');avatar.className='victim-avatar';avatar.style.borderColor=g.colors[id];avatar.append(sprite(p.bot?'icon_bot':'icon_player'));const name=document.createElement('span');name.textContent=p.name;const count=document.createElement('span');count.textContent=`${p.resourceCount} cards · ${p.points} VP`;b.append(avatar,name,count);b.onclick=()=>{selectedVictim=id;robberAction(state,mine);};row.append(b);}
  const confirm=document.createElement('button');confirm.className='robber-confirm';confirm.textContent='✓';confirm.setAttribute('aria-label','Confirm robbery');confirm.disabled=!selectedVictim;confirm.onclick=()=>send('Steal',{player:selectedVictim});row.append(confirm);box.append(row);
}
function developmentHand(state,mine){
  const g=state.game,d=g.development;if(!d)return;
  cardTip.hidden=true;
  if(d.cards.length){const divider=document.createElement('span');divider.className='hand-divider';$('hand').append(divider);}
  for(const [type,info]of Object.entries(developmentCatalog)){
    const cards=d.cards.filter(c=>c.type===type);if(!cards.length)continue;
    const chosen=cards.find(c=>c.playable)||cards[0],enabled=mine&&g.phase==='build'&&chosen.playable;
    const stack=document.createElement('div');stack.className='development-stack';stack.dataset.developmentType=type;stack.tabIndex=0;stack.setAttribute('aria-label',info.name+' · '+cards.length+' cards');stack.setAttribute('aria-describedby',cardTip.id);
    const b=document.createElement('button');b.className='hand-development';b.disabled=!enabled;b.setAttribute('aria-label','Play '+info.name);b.setAttribute('aria-describedby',cardTip.id);
    for(let i=0;i<Math.min(cards.length,5);i++){const image=sprite(info.picture);image.style.left=(i*8)+'px';b.append(image);}stack.style.width=(42+Math.min(cards.length-1,4)*8)+'px';
    if(cards.length>1){const count=document.createElement('strong');count.className='development-count';count.textContent=cards.length;b.append(count);}
    const status=type==='VictoryPoint'?'Already included in your private score':enabled?'Click to play one card':cards.every(c=>c.newThisTurn)?'Available next turn':!mine?'Wait for your turn':g.phase!=='build'?'Resolve the dice first':'Unavailable: only one older development card may be played per turn';
    stack.title=info.name+': '+info.effect+' · '+status;stack.onmouseenter=()=>showCardTip(stack,info,status);stack.onmouseleave=()=>cardTip.hidden=true;stack.onfocusin=()=>showCardTip(stack,info,status);stack.onfocusout=()=>cardTip.hidden=true;
    b.onclick=()=>{cardTip.hidden=true;closePanels();if(['YearOfPlenty','Monopoly'].includes(type)){developmentChoice=chosen.id;developmentPicks=[];buildMode=null;controls(state);}else send('PlayDevelopmentCard',{cardId:chosen.id});};stack.append(b);$('hand').append(stack);
  }
  developmentAction(state,mine);
}
function developmentAction(state,mine){
  const g=state.game,card=g.development?.cards.find(c=>c.id===developmentChoice&&c.playable);
  if(!card||!mine||g.phase!=='build'){developmentChoice=null;developmentPicks=[];return;}
  const info=developmentCatalog[card.type],box=$('action-box');box.replaceChildren();box.hidden=false;
  const header=document.createElement('div');header.className='robber-header';header.append(sprite(info.picture));const copy=document.createElement('div');const title=document.createElement('strong');title.textContent=info.name;const description=document.createElement('p');description.textContent=info.effect;copy.append(title,description);header.append(copy);box.append(header);
  const required=card.type==='Monopoly'?1:Math.min(2,Object.values(g.bank).reduce((a,b)=>a+b,0));
  if(card.type==='YearOfPlenty'){const kept=[];for(const r of developmentPicks)if(kept.filter(x=>x===r).length<g.bank[r])kept.push(r);developmentPicks=kept.slice(0,required);}
  const row=document.createElement('div');row.className='action-resource-options';
  for(const r of Object.keys(cardSprites)){const button=document.createElement('button');button.append(sprite(cardSprites[r]));button.title=r;button.setAttribute('aria-label','Select '+r);button.setAttribute('aria-pressed',String(developmentPicks.includes(r)));button.disabled=card.type==='YearOfPlenty'&&(developmentPicks.length>=required||developmentPicks.filter(x=>x===r).length>=g.bank[r]);button.onclick=()=>{if(card.type==='Monopoly')developmentPicks=[r];else developmentPicks.push(r);developmentAction(state,mine);};row.append(button);}box.append(row);
  const footer=document.createElement('div');footer.className='action-choice-footer';const selected=document.createElement('div');selected.className='action-selected-cards';selected.setAttribute('aria-label','Selected resources');
  developmentPicks.forEach((r,i)=>{const button=document.createElement('button');button.append(sprite(cardSprites[r]));button.title='Remove '+r;button.setAttribute('aria-label','Remove selected '+r);button.onclick=()=>{developmentPicks.splice(i,1);developmentAction(state,mine);};selected.append(button);});footer.append(selected);
  const cancel=document.createElement('button');cancel.textContent='✕';cancel.setAttribute('aria-label','Cancel development card');cancel.onclick=()=>{developmentChoice=null;developmentPicks=[];controls(state);};
  const confirm=document.createElement('button');confirm.textContent='✓';confirm.setAttribute('aria-label','Confirm '+info.name);confirm.disabled=!required||developmentPicks.length!==required;confirm.onclick=()=>{const choice={cardId:card.id};if(card.type==='Monopoly')choice.resource=developmentPicks[0];else choice.resources=[...developmentPicks];developmentChoice=null;developmentPicks=[];box.hidden=true;send('PlayDevelopmentCard',choice);};footer.append(cancel,confirm);box.append(footer);
}

function tradeTargets(offer){return offer?.recipients||[offer?.to];}
function mayRespond(offer,id){return tradeTargets(offer).includes(id)&&offer.responses?.[id]!=='declined';}
function playerOffer(state){
  const g=state.game,box=$('trade-offers'),offer=g?.tradeOffer||g?.tradeDecline;box.replaceChildren();box.hidden=!offer||g.phase!=='build';if(box.hidden)return;
  const avatar=id=>{const p=state.players.find(p=>p.id===id),a=document.createElement('span');a.className='offer-avatar';a.style.borderColor=g.colors[id];a.title=p?.name||'Player';a.style.backgroundColor=g.colors[id];const image=document.createElement('img');image.src='/assets/'+(p?.bot?'icon_bot.551858c518b9f2f8357a.svg':'icon_player_loggedin.0269225ae4f7db8480ca.svg');image.alt=p?.name||'Player';a.append(image);return a;};
  const header=document.createElement('div');header.className='offer-title';header.append(avatar(offer.from));const name=document.createElement('strong');name.textContent=state.players.find(p=>p.id===offer.from)?.name+' offers a trade';header.append(name);const badges=document.createElement('div');badges.className='offer-responses';for(const id of tradeTargets(offer)){const badge=avatar(id),declined=offer.responses?.[id]==='declined'||offer.declinedBy===id,accepted=offer.responses?.[id]==='accepted';badge.title=(state.players.find(p=>p.id===id)?.name||'Player')+(declined?' · Declined':accepted?' · Accepted':' · Awaiting response');badge.setAttribute('aria-label',badge.title);if(declined||accepted){const x=document.createElement('strong');x.className=accepted?'trade-accepted':'trade-rejected';x.textContent=accepted?'✓':'✕';badge.append(x);}badges.append(badge);}header.append(badges);box.append(header);
  for(const [id,amounts,arrow,label]of [[offer.from,offer.give,'↓','Receive'],[offer.to||(tradeTargets(offer).includes(joined.playerId)?joined.playerId:null),offer.receive,'↑','Give']]){const row=document.createElement('div');row.className='incoming-offer-row';row.append(id?avatar(id):sprite('icon_players'));const direction=document.createElement('span');direction.className=arrow==='↓'?'offer-down':'offer-up';direction.textContent=arrow;direction.title=label;row.append(direction);for(const [r,n]of Object.entries(amounts))row.append(cardBadge(r,n));box.append(row);}
  const controls=document.createElement('div');controls.className='offer-response';
  if(offer.declinedBy){const rejected=avatar(offer.declinedBy),x=document.createElement('strong');x.className='trade-rejected';x.textContent='✕';rejected.append(x);controls.append(rejected);const text=document.createElement('span');text.textContent='Declined';controls.append(text);}
  else if(mayRespond(offer,joined.playerId)){for(const [label,glyph,type,disabled]of [['Decline offer','✕','DeclineTrade',false],['Accept offer','✓','AcceptTrade',!g.canAcceptTrade]]){const b=document.createElement('button');b.textContent=glyph;b.setAttribute('aria-label',label);b.title=disabled?(offer.responses?.[joined.playerId]==='accepted'?'Accepted · waiting for the trader to choose':'You do not have the requested cards'):label;b.disabled=disabled;b.onclick=()=>send(type,{offerId:offer.id});controls.append(b);}}
  else if(offer.from===joined.playerId){for(const id of tradeTargets(offer).filter(id=>offer.responses?.[id]==='accepted')){const name=state.players.find(p=>p.id===id)?.name||'Player',confirm=document.createElement('button');confirm.className='confirm-player-trade';confirm.textContent='✓ '+name;confirm.setAttribute('aria-label','Confirm trade with '+name);confirm.title='Complete this trade with '+name;confirm.disabled=!(g.confirmableTradePlayers||[]).includes(id);confirm.onclick=()=>send('ConfirmTrade',{offerId:offer.id,player:id});controls.append(confirm);}const b=document.createElement('button');b.textContent='✕';b.setAttribute('aria-label','Cancel offer');b.onclick=()=>send('CancelTrade',{offerId:offer.id});controls.append(b);}
  if(offer.responses?.[joined.playerId]==='accepted'){const waiting=document.createElement('span');waiting.textContent='Accepted · waiting for trader';controls.append(waiting);}
  box.append(controls);
}
let endgameTab='Overview',endgameDismissed;
const endOverlay=document.createElement('section');endOverlay.id='game-end';endOverlay.hidden=true;endOverlay.setAttribute('aria-label','Game results');document.body.append(endOverlay);
function gameEnd(state){
  const g=state.game,score=g?.scoring;endOverlay.replaceChildren();endOverlay.hidden=!score?.winner||endgameDismissed===state.code;if(!score?.winner){endgameDismissed=null;endgameTab='Overview';return;}if(endOverlay.hidden)return;
  const header=document.createElement('header'),brand=document.createElement('strong'),title=document.createElement('h1'),subtitle=document.createElement('p');brand.textContent='PRIVATE SETTLERS';title.textContent=score.winner===joined.playerId?'Victory!':state.players.find(p=>p.id===score.winner)?.name+' wins!';subtitle.textContent=score.winningPoints+' victory points';header.append(brand,title,subtitle);endOverlay.append(header);
  const map=document.createElement('button');map.className='end-map';map.textContent='View board';map.onclick=()=>{endgameDismissed=state.code;endOverlay.hidden=true;$('score-panel').hidden=false;const reopen=document.createElement('button');reopen.textContent='Show results';reopen.onclick=()=>{endgameDismissed=null;gameEnd(state);};$('score-panel').append(reopen);};endOverlay.append(map);
  const tabs=document.createElement('nav');tabs.setAttribute('aria-label','Result categories');for(const tab of ['Overview','Pieces','Development']){const b=document.createElement('button');b.textContent=tab;b.setAttribute('aria-pressed',String(tab===endgameTab));b.onclick=()=>{endgameTab=tab;gameEnd(state);};tabs.append(b);}endOverlay.append(tabs);
  const wrapper=document.createElement('div');wrapper.className='end-results';const table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody');const labels=endgameTab==='Overview'?['Player','Public points','Settlements','Cities','Army bonus','Road bonus']:endgameTab==='Pieces'?['Player','Settlements','Cities','Road pieces','Longest road']:['Player','Knights played','Cards held','Revealed VP'];const tr=document.createElement('tr');for(const label of labels){const th=document.createElement('th');th.textContent=label;tr.append(th);}head.append(tr);table.append(head,body);
  const players=state.players.filter(p=>p.playing).sort((a,b)=>(b.id===score.winner?1:0)-(a.id===score.winner?1:0)||b.points-a.points);
  for(const p of players){const row=document.createElement('tr');if(p.id===score.winner)row.className='end-winner';const name=document.createElement('td'),avatar=document.createElement('span');avatar.className='offer-avatar';const avatarColor=['#d63641','#205abd','#bf6028','#218b19','#8944ab','#777'][state.players.filter(p=>p.playing).findIndex(player=>player.id===p.id)]||g.colors[p.id];avatar.style.setProperty('--avatar-color',avatarColor);const avatarImage=document.createElement('img');avatarImage.src='/assets/'+(p.bot?'icon_bot.551858c518b9f2f8357a.svg':'icon_player_loggedin.0269225ae4f7db8480ca.svg');avatarImage.alt=p.bot?'Bot':'Player avatar';avatarImage.draggable=false;avatar.append(avatarImage);name.append(avatar,document.createTextNode(p.name));row.append(name);const settlements=g.vertices.filter(v=>v.owner===p.id&&!v.city).length,cities=g.vertices.filter(v=>v.owner===p.id&&v.city).length;const values=endgameTab==='Overview'?[p.points,settlements,cities,score.largestArmy===p.id?2:0,score.longestRoad===p.id?2:0]:endgameTab==='Pieces'?[settlements,cities,g.edges.filter(e=>e.owner===p.id).length,score.roadLengths[p.id]||0]:[p.knightsPlayed,p.developmentCount,p.id===score.winner?score.revealedVictoryPoints:p.id===joined.playerId?g.development.privateVictoryPoints:'—'];for(const value of values){const td=document.createElement('td');td.textContent=value;if(value===2&&endgameTab==='Overview'&&row.children.length>=4)td.className='end-award';row.append(td);}body.append(row);}wrapper.append(table);endOverlay.append(wrapper);
  const note=document.createElement('p');note.className='end-note';note.textContent='Winner points include revealed victory cards. Other players retain private cards. Dice and resource-history statistics are not recorded yet.';endOverlay.append(note);
  const footer=document.createElement('footer');const board=document.createElement('button');board.textContent='View board';board.onclick=map.onclick;footer.append(board);if(state.host===joined.playerId){const play=document.createElement('button');play.textContent='Play again';play.className='end-play';play.onclick=()=>send('Rematch');footer.append(play);}else{const wait=document.createElement('span');wait.textContent='Waiting for the host to start a rematch';footer.append(wait);}endOverlay.append(footer);
}
let discardDraft={},discardRoom;
function discardAction(state){
  const g=state.game;if(!g?.discardCount||g.phase!=='discard'){discardDraft={};return;}
  if(discardRoom!==state.code){discardRoom=state.code;discardDraft={};}
  const box=$('action-box');box.hidden=false;box.replaceChildren();
  const title=document.createElement('strong');title.textContent='Discard half your resource cards';const description=document.createElement('p');description.textContent='You have '+Object.values(g.resources).reduce((a,b)=>a+b,0)+' resource cards. Select exactly '+g.discardCount+' to return to the bank. Development cards do not count.';const header=document.createElement('div');header.className='discard-header';header.append(title,description);box.append(header);
  const total=Object.values(discardDraft).reduce((a,b)=>a+b,0),row=document.createElement('div');row.className='action-resource-options';
  for(const [r,n]of Object.entries(g.resources)){const b=document.createElement('button');b.append(cardBadge(r,n-(discardDraft[r]||0)));b.disabled=total>=g.discardCount||(discardDraft[r]||0)>=n;b.setAttribute('aria-label','Discard '+r);b.title='Add '+r+' to discard';b.onclick=()=>{discardDraft[r]=(discardDraft[r]||0)+1;discardAction(state);};row.append(b);}box.append(row);
  const footer=document.createElement('div');footer.className='action-choice-footer';const selected=document.createElement('div');selected.className='action-selected-cards';
  for(const [r,n]of Object.entries(discardDraft))if(n){const b=document.createElement('button');b.append(cardBadge(r,n));b.setAttribute('aria-label','Keep one '+r);b.title='Remove one '+r+' from discard';b.onclick=()=>{discardDraft[r]--;discardAction(state);};selected.append(b);}footer.append(selected);
  const confirm=document.createElement('button');confirm.textContent='Discard '+total+' / '+g.discardCount;confirm.className='discard-confirm';confirm.disabled=total!==g.discardCount;confirm.onclick=()=>send('Discard',{cards:{...discardDraft}});footer.append(confirm);box.append(footer);
}
function controls(state){
  const g=state.game, mine=g?.currentPlayer===joined?.playerId;
  robberAction(state,mine);
  $('hand').hidden=!g;
  $('hand').textContent='';
  $('dice').replaceChildren();if(g){const roll=document.createElement('button');roll.className='dice-button';roll.setAttribute('aria-label','Roll dice');roll.title=g.phase==='roll'&&g.currentPlayer===joined.playerId?'Click to roll':'Latest dice roll';roll.disabled=g.phase!=='roll'||g.currentPlayer!==joined.playerId;for(const value of g.dice||[1,1]){const die=document.createElement('img');die.className='dice-face';die.src='/assets/'+diceArtwork[value];die.alt='Die showing '+value;die.draggable=false;roll.append(die);}roll.onclick=()=>send('RollDice');$('dice').append(roll);}
  $('score-panel').replaceChildren();
  const hints={settlement:'Choose a white corner marker for your settlement.',road:'Choose a white edge marker for your starting road.',roll:'Roll the dice to collect resources.',build:'Build, trade, or play a development card, then end your turn.',discard:'Players with more than seven cards must discard half their hand.',robber:'Choose a white tile marker to move the robber.',steal:'Choose a player to steal one random resource.', 'free-road':'Choose a white edge marker for a free road.',finished:'The host can return everyone to the lobby for a rematch.'};
  $('hint').textContent=g?(g.discardCount?`Select exactly ${g.discardCount} cards to discard.`:mine?hints[g.phase]||'':`Waiting for ${state.players.find(p=>p.id===g.currentPlayer)?.name||'the other players'}. ${g.phase==='discard'?hints.discard:''}`):'Start with bots to play alone, or invite friends with the room link.';
  $('room-info').classList.toggle('extended-roster',state.players.filter(p=>p.playing).length>4);
  $('room-info').replaceChildren();
  const roomTitle=document.createElement('strong');roomTitle.textContent=`Room ${state.code}`;$('room-info').append(roomTitle);
  const seats=document.createElement('div');seats.className='player-seats';$('room-info').append(seats);
  for(const p of [...state.players.filter(p=>p.id!==joined.playerId),...state.players.filter(p=>p.id===joined.playerId)]){const seat=document.createElement('div');seat.className='player-seat';seat.dataset.playerId=p.id;if(p.id===joined.playerId)seat.classList.add('your-seat');if(p.id===g?.currentPlayer)seat.classList.add('active-seat');const name=document.createElement('strong');name.textContent=p.name+(p.autopilot?' · Bot playing':p.online?'':' · Offline');seat.append(name);if(p.playing){const stats=document.createElement('div');stats.className='seat-stats';const avatar=document.createElement('div');avatar.className='seat-avatar';const avatarColor=['#d63641','#205abd','#bf6028','#218b19','#8944ab','#777'][state.players.filter(p=>p.playing).findIndex(player=>player.id===p.id)]||g.colors[p.id];avatar.style.setProperty('--avatar-color',avatarColor);const avatarImage=document.createElement('img');avatarImage.src='/assets/'+(p.bot?'icon_bot.551858c518b9f2f8357a.svg':'icon_player_loggedin.0269225ae4f7db8480ca.svg');avatarImage.alt=p.bot?'Bot':'Player avatar';avatarImage.draggable=false;avatar.append(avatarImage);const score=document.createElement('span');score.className='avatar-score';score.textContent=p.id===joined.playerId&&g.scoring?.yourPoints!=null&&g.scoring.yourPoints!==p.points?`${p.points} (${g.scoring.yourPoints})`:p.points;score.title=p.id===joined.playerId?'Public points (total including private victory points)':'Public victory points';avatar.append(score);stats.append(avatar,cardBadge('resources',p.resourceCount),cardBadge('development',p.developmentCount));for(const [kind,count]of [['army',p.knightsPlayed],['road',g.scoring?.roadLengths[p.id]||0]]){const metric=document.createElement('div');metric.className='seat-metric';metric.title=kind==='army'?'Played knights':'Longest road length';const held=(kind==='army'?g.scoring?.largestArmy:g.scoring?.longestRoad)===p.id;metric.classList.toggle('award-held',held);metric.title+=(held?' · Award holder (+2 points)':'');metric.setAttribute('aria-label',metric.title+': '+count);metric.append(sidebarIcon(kind==='army'?'army':held?'roadAward':'road'));const number=document.createElement('span');number.textContent=count;metric.append(number);stats.append(metric);}seat.append(stats);}seats.append(seat);}
  $('bank').replaceChildren();if(g){const label=document.createElement('strong');label.textContent='';label.append(sidebarIcon('bank'));label.title='Bank';$('bank').append(label);for(const r of Object.keys(cardSprites))$('bank').append(cardBadge(r,g.bank?.[r]??'—'));$('bank').append(cardBadge('development',g.development?.remaining??'—'));}
  $('actions').replaceChildren();
  const button=(label,action,disabled=false)=>{const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=action;$('actions').append(b);b.onfocus=()=>{const key=Object.keys(actionCosts).find(k=>b.getAttribute('aria-label')?.startsWith(k));if(key)showCostTip(b,key);};b.onblur=()=>cardTip.hidden=true;return b;};
  if(!g){gameEnd(state);$('turn').textContent='Waiting to start';if(state.host===joined.playerId){button('Start with bots',()=>send('StartGame',{bots:true}));button('Start game',()=>send('StartGame'),state.players.filter(p=>p.online&&!p.bot).length<2);}return;}
  const player=state.players.find(p=>p.id===g.currentPlayer);
  $('turn').textContent=g.discardCount?'Discard '+g.discardCount+' cards':mine?(g.phase==='roll'?'Roll Dice':g.phase==='build'?'Your Turn':hints[g.phase]||g.phase):`${player?.name||'Player'} · ${g.phase}`;$('turn').title=$('hint').textContent;
  for(const [resource,count]of Object.entries(g.resources||{})){if(count<=0)continue;const card=cardBadge(resource,count);resourceStack(card,count);$('hand').append(card);}
  developmentHand(state,mine);
  playerOffer(state);
  gameEnd(state);
  $('score-panel').replaceChildren();$('score-panel').hidden=!g.scoring?.winner;if(g.scoring?.winner){const result=document.createElement('p');result.textContent=`${state.players.find(p=>p.id===g.scoring.winner)?.name} wins with ${g.scoring.winningPoints} points!`;$('score-panel').append(result);if(state.host===joined.playerId){const rematch=document.createElement('button');rematch.textContent='Rematch · return to lobby';rematch.onclick=()=>send('Rematch');$('score-panel').append(rematch);}}if(g.phase==='finished'){$('turn').textContent=`${player.name} wins with ${g.scoring.winningPoints} points!`;return;}
  if(g.phase!=='finished'){
    for(const [type,label]of Object.entries({BuildRoad:'Build road · wood + brick',BuildSettlement:'Build settlement · wood + brick + sheep + wheat',BuildCity:'Upgrade city · 2 wheat + 3 ore'})){const available=mine&&g.phase==='build'&&(g.builds?.[type]||[]).length>0;const b=button(label,()=>{buildMode=buildMode===type?null:type;controls(state);scheduleRender(state.renderer.fixture,state.renderer,state);},!available);b.style.order=({BuildRoad:'2',BuildSettlement:'3',BuildCity:'4'}[type]);b.setAttribute('aria-label',label);b.replaceChildren(actionIcon(({BuildRoad:'road_',BuildSettlement:'settlement_',BuildCity:'city_'}[type])+(['red','blue','orange','green','purple','white'][state.players.filter(p=>p.playing).findIndex(p=>p.id===joined.playerId)]||'red')));const counter=document.createElement('span');counter.className='piece-counter';counter.style.backgroundColor=g.colors[joined.playerId];counter.textContent=type==='BuildRoad'?15-g.edges.filter(e=>e.owner===joined.playerId).length:type==='BuildCity'?4-g.vertices.filter(v=>v.owner===joined.playerId&&v.city).length:5-g.vertices.filter(v=>v.owner===joined.playerId&&!v.city).length;b.append(counter);b.setAttribute('aria-pressed',String(buildMode===type));b.title=label+(available?' · Choose a legal location.':' · Requires resources, a piece, and a legal location.');}
    if(buildMode)$('hint').textContent='Choose a marker to build. Click the selected build icon again to exit placement.';
    const end=button('End turn',()=>{buildMode=null;send('EndTurn');},!mine||g.phase!=='build');end.style.order='5';end.replaceChildren(actionIcon('icon_pass_turn'));end.setAttribute('aria-label','End turn');end.title='End turn';
  }
  discardAction(state);
  const buy=button('Buy development card',()=>{closePanels();send('BuyDevelopmentCard');},!mine||g.phase!=='build'||!g.development?.canBuy);buy.style.order='1';buy.replaceChildren(actionIcon('card_devcardback'));buy.title='Buy development card · sheep + wheat + ore';buy.setAttribute('aria-label',buy.title);
  actionPanel('Trade','trade',state,referenceTrade,g.phase==='build'&&(mine&&Object.values(g.resources).some(n=>n>0)||g.tradeOffer&&mayRespond(g.tradeOffer,joined.playerId)));
  for(const panel of $('actions').querySelectorAll('.action-panel')){panel.style.order=panel.dataset.panel==='trade'?'0':'1';if(panel.dataset.panel==='trade')syncTradeInventory(state,panel);}
}
let joiningRoom=null;
function showInvite(){if(!$('invite-dialog').open)$('invite-dialog').showModal();}
function beginInvite(code){
  joiningRoom=String(code).trim().toUpperCase();$('lobby').hidden=true;$('room-menu').hidden=true;$('game-layout').hidden=true;$('invite-loading').hidden=false;
  $('invite-title').textContent='Join room '+joiningRoom;$('invite-error').textContent='';$('invite-submit').disabled=false;
  if(!$('invite-name').value)$('invite-name').value=$('name').value;
  send('PreviewRoom',{code:joiningRoom});
}
function connect(){
  socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/socket`);
  socket.onmessage=event=>{
    const state=JSON.parse(event.data);if(state.type==='RoomState')$('menu-error').textContent='';
    if(state.type==='SessionEstablished'){$('connection').textContent='Connected to local game server';$('create').disabled=$('join').disabled=false;const saved=joined?seatSessions.find(joined.code):seatSessions.automatic(new URLSearchParams(location.search).get('room'));if(saved){if(!joined&&new URLSearchParams(location.search).get('room')){joiningRoom=saved.code;$('invite-title').textContent='Return to room '+saved.code;}resumeSeat(saved);}else{const code=joiningRoom||new URLSearchParams(location.search).get('room');if(code)beginInvite(code);}}
    if(state.type==='LobbyPreview'&&joiningRoom===state.code){$('invite-loading').hidden=true;MainMenu.render(state,null,send);showInvite();}
    if(state.type==='InviteClosed'&&joiningRoom){$('invite-error').textContent=state.message;$('invite-submit').disabled=false;showInvite();}
    if(state.type==='LeftRoom'){seatSessions.forget(joined?.code);location.assign('/');return;}
    if(state.type==='Joined'){$('quit-game').hidden=$('quit-hint').hidden=false;joined=state;joiningRoom=null;$('invite-loading').hidden=true;$('invite-dialog').close();$('invite-key').value='';pendingResume=null;seatSessions.remember(state);$('recovery-settings').hidden=false;$('seat-key').value=state.token;$('recovery-key').value='';$('lobby').hidden=true;$('probe').hidden=true;$('share').hidden=false;}
    if(state.type==='RoomState'){$('connection').textContent=state.persistence?'Connected · games saved locally':'Connected · temporary games';const previous=latestState;reconcileTradeDraft(previous,state);turnFeedback(state);publicEvents(state);latestState=state;updateTurnClock();if(state.game?.phase!=='build'||state.game?.edges.some(e=>e.owner===joined.playerId&&previous?.game?.edges[e.id]?.owner!==e.owner)||state.game?.vertices.some(v=>v.owner===joined.playerId&&(previous?.game?.vertices[v.id]?.owner!==v.owner||previous?.game?.vertices[v.id]?.city!==v.city)))buildMode=null;MainMenu.render(state,joined.playerId,send);controls(state);resourceFeedback(previous,state);scheduleRender(state.renderer.fixture,state.renderer,state);}
    if(state.type==='Chat'){if(latestState)appendLog($('chat-messages'),feedEntry(latestState,state.playerId||state.player||state.id,state.text));else appendLog($('chat-messages'),state.name+': '+state.text);}
    if(state.type==='Error'){if(joiningRoom){$('invite-error').textContent=state.message;$('invite-submit').disabled=false;showInvite();}$('menu-error').textContent=state.message;$('error').textContent=state.message;if(state.message.startsWith('Saved session')){if(pendingResume)seatSessions.forget(pendingResume.code);pendingResume=null;joined=null;latestState=null;$('recovery-settings').hidden=true;$('seat-key').value='';$('game-layout').hidden=true;$('room-menu').hidden=true;$('lobby').hidden=false;$('probe').hidden=false;$('menu-error').hidden=false;if(joiningRoom){$('lobby').hidden=true;$('invite-loading').hidden=false;}}}
  };
  socket.onclose=()=>{$('connection').textContent='Disconnected. Reconnecting…';$('create').disabled=$('join').disabled=true;clearTimeout(retry);retry=setTimeout(connect,1500);};
  socket.onerror=()=>{$('connection').textContent='Unable to reach local server';};
}
$('quit-game').onclick=()=>send('LeaveRoom');
rememberPlayerName();
$('create').onclick=()=>send('CreateRoom',{name:$('name').value});
$('join').onclick=()=>{const code=$('code').value.trim().toUpperCase(),token=$('recovery-key').value.trim(),saved=token?{code,token}:seatSessions.find(code);if(saved){if(!SeatSessions.valid(saved)){$('menu-error').textContent='Use the 48-character seat recovery key from game settings.';return;}resumeSeat(saved);}else beginInvite(code);};
$('copy-seat-key').onclick=async()=>{try{await navigator.clipboard.writeText(joined.token);$('copy-seat-key').textContent='Recovery key copied';}catch{$('seat-key').type='text';$('seat-key').select();}};
$('invite-form').onsubmit=event=>{event.preventDefault();const code=joiningRoom,name=$('invite-name').value.trim(),token=$('invite-key').value.trim();if(!code)return;
  if(token){if(!SeatSessions.valid({code,token})){$('invite-error').textContent='Use the 48-character private seat recovery key.';return;}resumeSeat({code,token});}
  else{if(!name||name.length>24){$('invite-error').textContent='Enter a name of 1–24 characters.';$('invite-name').focus();return;}send('JoinRoom',{code,name});}
  $('invite-submit').disabled=true;
};
$('invite-cancel').onclick=()=>{send('CancelPreview');location.assign('/');};
$('invite-dialog').addEventListener('cancel',event=>{event.preventDefault();$('invite-cancel').click();});
$('code').value=new URLSearchParams(location.search).get('room')||'';
if($('code').value){$('lobby').hidden=true;$('invite-loading').hidden=false;}
$('sound').checked=soundEnabled;$('sound').onchange=()=>{soundEnabled=$('sound').checked;localStorage.setItem('settlers-sound',soundEnabled?'on':'off');if(soundEnabled){unlockSound();audioContext?.resume().then(()=>cue()).catch(()=>{});}else diceRollAudio?.pause();};
$('chat-form').onsubmit=event=>{event.preventDefault();const text=$('chat-input').value.trim();if(text){send('Chat',{text});$('chat-input').value='';}};
$('share').onclick=async()=>{const url=new URL(location.href);url.searchParams.set('room',joined.code);try{await navigator.clipboard.writeText(url.href);$('share').textContent='Copied room link';setTimeout(()=>$('share').textContent='Copy room link',2000);}catch{$('error').textContent=`Room code: ${joined.code}. Copy the address and add ?room=${joined.code}`;}};
$('probe').onclick=async()=>{try{const fixture=await(await fetch('/fixture.json')).json();scheduleRender(fixture,{robber:Object.values(fixture.gameState.mapState.tileHexStates).findIndex(t=>t.type===0)});}catch(error){log(error.message);}};
fetch('/development-cards.json').then(r=>{if(!r.ok)throw Error('Restart renderer server to load development-card catalog');return r.json();}).then(catalog=>{developmentCatalog=catalog;if(latestState)controls(latestState);}).catch(()=>{/* Built-in catalog keeps the private hand usable on older server sessions. */});
connect();
