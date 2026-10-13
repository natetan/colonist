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
    sprite.anchor.set(.5,.5);sprite.height=view.hexagonHeight*.38;sprite.scale.x=sprite.scale.y;
    sprite.position.set(point.x-view.hexagonWidth*.28,point.y+view.hexagonHeight*.08);sprite.zIndex=view.layers.robber;view.addChild(sprite);
  }
  const harborMarkers=[];
  for(const harbor of state?.harbors||[]){
    const edge=map.tileEdges[presentation.mapping.edges[harbor.edge]],point=edge.hexEdge.centerPointToPixel(view.mapCenter,view.hexagonHeight/2);

    // Shift the badge outwards; endpoint positions make harbor ownership unambiguous.
    const anchor=presentation.harborLocations.find(h=>h.edge===harbor.edge);const {x,y}=anchor,n=Math.hypot(x,y),dx=x/n,dy=y/n;
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
const diceArtwork={"1":"dice_1.6828d855c054bbb331d3.svg","2":"dice_2.05d31959b2838006865b.svg","3":"dice_3.bdf9bed70b715ad2ab2c.svg","4":"dice_4.ec56593699eed0f02856.svg","5":"dice_5.e2e4c9085fa4a5ed783a.svg","6":"dice_6.68f39630050519374015.svg"};
const actionArtwork={"bg_button":"bg_button.6fb386c356a3e9b580e2.svg","icon_pass_turn":"icon_pass_turn.8d5b7a48c40a85b859cd.svg","icon_trade":"icon_trade.db2aa231787fcdbc1a67.svg","card_devcardback":"card_devcardback.92569a1abd04a8c1c17e.svg","road_red":"road_red.41c6cbd9278108542715.svg","settlement_red":"settlement_red.22949197b57f9cfd968b.svg","city_red":"city_red.991ae0c7a0b95da9811d.svg","road_blue":"road_blue.3301e2eed15cae5a6a05.svg","settlement_blue":"settlement_blue.bad4cdb43d65c329deda.svg","city_blue":"city_blue.43d846e83515f35f51f6.svg","road_orange":"road_orange.07bb26b8c1e63dd438c7.svg","settlement_orange":"settlement_orange.774ddafc8cc0595acdb7.svg","city_orange":"city_orange.f49c8fb13a589f8d0c68.svg","road_green":"road_green.d206aed3747b3687bc40.svg","settlement_green":"settlement_green.1b78c696cd137be02fae.svg","city_green":"city_green.d7ea2b2bde643e17efe1.svg","road_purple":"road_purple.44404500b4749200ee0c.svg","settlement_purple":"settlement_purple.af6c0adb105271efbfb5.svg","city_purple":"city_purple.a9868c1fc12671447ea3.svg","road_white":"road_white.78e66baab120779d5c30.svg","settlement_white":"settlement_white.a642a431b4bb73d63dae.svg","city_white":"city_white.cca576079023a2bdc80f.svg"};
function actionIcon(name){const img=document.createElement('img');img.className='action-icon';img.src='/assets/'+actionArtwork[name];img.alt='';img.draggable=false;return img;}
function sidebarIcon(name){const img=document.createElement('img');img.src='/assets/'+({army:'icon_largest_army.206b49b3c9d2b206f699.svg',road:'icon_longest_road.5cfdeb3352b20463e64b.svg',roadAward:'icon_longest_road_highlight.50dc66b851ecee9a8662.svg',back:'card_rescardback.03c18312a76028b0d9c9.svg',bank:'bank.825b2690b4b1b694d646.svg'}[name]);img.alt='';img.draggable=false;return img;}
function cardBadge(resource,count){const card=document.createElement('div');card.className='resource-card';card.dataset.resource=resource;card.append(resource==='resources'?sidebarIcon('back'):sprite(cardSprites[resource]||'card_devcardback'));const n=document.createElement('strong');n.textContent=count;card.append(n);card.setAttribute('aria-label',`${resource}: ${count} cards`);card.title=`${resource}: ${count}`;return card;}
function resourceFeedback(previous,state){
  if(!previous?.game?.resources||previous.code!==state.code||!state.game?.resources)return;
  const gains=Object.entries(state.game.resources).filter(([r,n])=>n>(previous.game.resources[r]||0)).map(([r,n])=>[r,n-(previous.game.resources[r]||0)]);
  if(!gains.length)return;
  const notice=document.createElement('div');notice.className='resource-notice';notice.setAttribute('role','status');notice.textContent='Received '+gains.map(([r,n])=>`+${n} ${r}`).join(' · ');$('hand').append(notice);setTimeout(()=>notice.remove(),4000);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  for(const [r,n]of gains){const target=$('hand').querySelector(`[data-resource="${r}"]`),bank=$('bank').querySelector(`[data-resource="${r}"]`),fromBank=(previous.game.bank?.[r]??0)-(state.game.bank?.[r]??0)>=n,origin=fromBank?bank:$('board');if(!target||!origin||reduced)continue;const a=origin.getBoundingClientRect(),b=target.getBoundingClientRect();for(let i=0;i<Math.min(n,5);i++){const flight=sprite(cardSprites[r]);flight.classList.add('flying-card');flight.style.left=`${a.left+a.width/2-21}px`;flight.style.top=`${a.top+a.height/2-30}px`;document.body.append(flight);const animation=flight.animate([{transform:'translate(0,0) scale(.8)',opacity:1},{transform:`translate(${b.left+b.width/2-a.left-a.width/2}px,${b.top+b.height/2-a.top-a.height/2}px) scale(1)`,opacity:1}],{duration:650,delay:i*90,easing:'cubic-bezier(.2,.6,.3,1)'});animation.finished.catch(()=>{}).finally(()=>flight.remove());}}
}
function appendLog(parent,content){const follow=parent.scrollHeight-parent.scrollTop-parent.clientHeight<35,p=document.createElement('p');if(typeof content==='string')p.textContent=content;else p.append(content);parent.append(p);while(parent.children.length>500)parent.firstElementChild.remove();if(follow)parent.scrollTop=parent.scrollHeight;}
function feedEntry(state,id,verb,icons=[]){const row=document.createElement('span');row.className='feed-entry';const player=state.players.find(p=>p.id===id);if(player){const avatar=sprite(player.bot?'icon_bot':'icon_player');avatar.classList.add('feed-avatar');const name=document.createElement('strong');name.textContent=player.name;const colors=['#d9363e','#205ebd','#ba5d24','#237c1d','#8746ac','#666'];name.style.color=colors[state.players.filter(p=>p.playing).findIndex(p=>p.id===id)]||'#555';row.append(avatar,name);}row.append(document.createTextNode(' '+verb+' '));for(const icon of icons){icon.classList.add('feed-icon');row.append(icon);}return row;}
function publicEvents(state){const prev=latestState;if(!prev||prev.code!==state.code){if(prev?.code!==state.code){$('events').replaceChildren();$('chat-messages').replaceChildren();appendLog($('events'),'Welcome to your private table.');}return;}const g=state.game,old=prev.game;if(!g){if(old)appendLog($('events'),'The host returned the table to the lobby.');return;}
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
function closePanels(except){for(const p of $('actions').querySelectorAll('.action-panel'))if(p!==except){p.open=false;panelOpen[p.dataset.panel]=false;}}
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.action-panel'))closePanels();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closePanels();});
function actionPanel(label,key,state,render,enabled=true){const panel=document.createElement('details');panel.className='action-panel';panel.dataset.panel=key;panel.open=enabled&&!!panelOpen[key];if(!enabled)panelOpen[key]=false;panel.ontoggle=()=>{if(panel.isConnected)panelOpen[key]=panel.open;};const summary=document.createElement('summary');summary.setAttribute('aria-label',label);summary.setAttribute('aria-disabled',String(!enabled));summary.title=enabled?label:label+' · Roll first, or wait for your turn';summary.onclick=event=>{if(!enabled){event.preventDefault();return;}closePanels(panel);panelOpen[key]=!panel.open;};summary.append(actionIcon(key==='trade'?'icon_trade':'card_devcardback'));panel.append(summary);if(enabled)render(panel,state,joined.playerId,send);$('actions').append(panel);}
let tradeDraft={give:{},receive:{},to:''},tradeRoom;
function referenceTrade(parent,state,viewerId,send){
  const g=state.game;if(tradeRoom!==state.code){tradeRoom=state.code;tradeDraft={give:{},receive:{},to:''};}
  let ui=parent.querySelector('.reference-trade');if(!ui){ui=document.createElement('section');ui.className='reference-trade trade-controls';parent.append(ui);}else ui.replaceChildren();
  const chooser=document.createElement('div'),offer=document.createElement('div'),hand=document.createElement('div'),rail=document.createElement('div');chooser.className='trade-selector parchment';offer.className='trade-proposal parchment';hand.className='trade-hand parchment';rail.className='trade-rail';ui.append(chooser,offer,hand,rail);
  const repaint=()=>{const focused=ui.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;referenceTrade(parent,state,viewerId,send);if(focused){const next=[...ui.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===focused&&!b.disabled);next?.focus({preventScroll:true});}};
  const card=(container,r,n,label,click,disabled=false)=>{const b=document.createElement('button');b.type='button';b.className='trade-stack';b.setAttribute('aria-label',label);b.title=label;b.disabled=disabled;b.append(cardBadge(r,n));b.onclick=()=>{click();repaint();};container.append(b);};
  const mine=g.currentPlayer===viewerId;
  for(const r of Object.keys(cardSprites))card(chooser,r,'',`Request ${r}`,()=>{tradeDraft.receive[r]=(tradeDraft.receive[r]||0)+1;},!mine||!!tradeDraft.give[r]);
  const wanted=document.createElement('div'),given=document.createElement('div');wanted.className='offer-row';given.className='offer-row';const incoming=document.createElement('span'),outgoing=document.createElement('span');incoming.textContent='♧ ↓';outgoing.textContent='You ↑';wanted.append(incoming);given.append(outgoing);offer.append(wanted,given);
  for(const [r,n]of Object.entries(tradeDraft.receive))if(n)card(wanted,r,n,`Remove requested ${r}`,()=>tradeDraft.receive[r]--);
  for(const [r,n]of Object.entries(tradeDraft.give))if(n)card(given,r,n,`Remove offered ${r}`,()=>tradeDraft.give[r]--);
  for(const [r,n]of Object.entries(g.resources))card(hand,r,Math.max(0,n-(tradeDraft.give[r]||0)),`Offer ${r}`,()=>{tradeDraft.give[r]=(tradeDraft.give[r]||0)+1;},!mine||!!tradeDraft.receive[r]||(tradeDraft.give[r]||0)>=n);
  const give=Object.fromEntries(Object.entries(tradeDraft.give).filter(([,n])=>n>0)),receive=Object.fromEntries(Object.entries(tradeDraft.receive).filter(([,n])=>n>0)),a=Object.keys(give),b=Object.keys(receive),valid=mine&&a.length>0&&b.length>0&&a.every(r=>give[r]<=g.resources[r]&&!receive[r]);
  const bankValid=valid&&a.length===1&&b.length===1&&receive[b[0]]===1&&give[a[0]]===(g.bankRates?.[a[0]]||4)&&g.bank[b[0]]>0;
  const opponents=state.players.filter(p=>p.playing&&!p.bot&&p.online&&p.id!==viewerId);
  if(opponents.length){const select=document.createElement('select');select.setAttribute('aria-label','Trade recipient');for(const p of opponents){const o=document.createElement('option');o.value=p.id;o.textContent=p.name;select.append(o);}if(opponents.some(p=>p.id===tradeDraft.to))select.value=tradeDraft.to;tradeDraft.to=select.value;select.onchange=()=>tradeDraft.to=select.value;offer.append(select);}
  const action=(label,icon,disabled,fn)=>{const button=document.createElement('button');button.setAttribute('aria-label',label);button.title=label;button.disabled=disabled;button.append(sprite(icon));button.onclick=fn;rail.append(button);};
  action('Trade with bank','icon_tradehouse',!bankValid,()=>{send('BankTrade',{give:a[0],receive:b[0]});tradeDraft.give={};tradeDraft.receive={};closePanels();});
  action('Send player offer','icon_players',!valid||!opponents.length,()=>send('OfferTrade',{player:tradeDraft.to,give,receive}));
  const cancel=document.createElement('button');cancel.textContent='✕';cancel.setAttribute('aria-label','Close trade');cancel.onclick=()=>closePanels();rail.append(cancel);
  const help=document.createElement('p');help.className='trade-requirements';help.textContent=bankValid?'Bank exchange ready':a.length===1?`Bank rate: ${g.bankRates?.[a[0]]||4} ${a[0]} for one card. Select cards to offer below, then request above.`:'Select cards to offer below, then request above.';offer.append(help);
  if(g.tradeOffer){const existing=g.tradeOffer;const status=document.createElement('p');status.textContent='Pending offer · '+state.players.find(p=>p.id===existing.from)?.name+' → '+state.players.find(p=>p.id===existing.to)?.name;offer.append(status);for(const [label,type,allowed]of [['Cancel offer','CancelTrade',existing.from===viewerId],['Accept offer','AcceptTrade',existing.to===viewerId&&g.canAcceptTrade],['Decline offer','DeclineTrade',existing.to===viewerId]])if(allowed){const button=document.createElement('button');button.textContent=label;button.onclick=()=>send(type,{offerId:existing.id});offer.append(button);}}
}
let audioContext,soundEnabled=localStorage.getItem('settlers-sound')!=='off',turnStarted=Date.now(),turnKey;
document.addEventListener('pointerdown',()=>{if(soundEnabled){audioContext??=new AudioContext();audioContext.resume().catch(()=>{});}});
function cue(dice=false){if(!soundEnabled||!audioContext||audioContext.state!=='running')return;for(let i=0;i<(dice?5:2);i++){const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),start=audioContext.currentTime+i*.075;oscillator.type=dice?'triangle':'sine';oscillator.frequency.value=dice?180+i*67:660+i*220;gain.gain.setValueAtTime(.035,start);gain.gain.exponentialRampToValueAtTime(.001,start+.065);oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(start);oscillator.stop(start+.07);}}
function turnFeedback(state){const g=state.game,key=state.code+':'+g?.currentPlayer+':'+g?.phase;if(key!==turnKey){turnStarted=Date.now();turnKey=key;if(g?.currentPlayer===joined.playerId&&['roll','settlement'].includes(g.phase))cue();}if(g?.dice&&latestState?.game?.phase==='roll'&&g.phase!=='roll')cue(true);}
setInterval(()=>{const elapsed=Math.floor((Date.now()-turnStarted)/1000);$('phase-clock').textContent=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}`;},1000);
let developmentChoice,selectedVictim,developmentCatalog={"Knight":{"name":"Knight","picture":"card_knight","effect":"Move the robber to another tile, then steal one random resource card from an eligible player."},"VictoryPoint":{"name":"Victory point","picture":"card_victorypoint","effect":"Adds one private victory point automatically. You do not play this card."},"Monopoly":{"name":"Monopoly","picture":"card_monopoly","effect":"Choose one resource. Collect all cards of that resource from every other player."},"RoadBuilding":{"name":"Road building","picture":"card_roadbuilding","effect":"Place up to two roads for free, following normal placement rules and piece limits."},"YearOfPlenty":{"name":"Year of plenty","picture":"card_yearofplenty","effect":"Choose two available resource cards from the bank. You may choose the same resource twice if available."}},developmentPicks=[];
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
    const stack=document.createElement('div');stack.className='development-stack';stack.tabIndex=0;stack.setAttribute('aria-label',info.name+' · '+cards.length+' cards');stack.setAttribute('aria-describedby',cardTip.id);
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

function controls(state){
  const g=state.game, mine=g?.currentPlayer===joined?.playerId;
  robberAction(state,mine);
  $('hand').hidden=!g;
  $('hand').textContent='';
  $('dice').replaceChildren();if(g){const roll=document.createElement('button');roll.className='dice-button';roll.setAttribute('aria-label','Roll dice');roll.title=g.phase==='roll'&&g.currentPlayer===joined.playerId?'Click to roll':'Latest dice roll';roll.disabled=g.phase!=='roll'||g.currentPlayer!==joined.playerId;for(const value of g.dice||[1,1]){const die=document.createElement('img');die.className='dice-face';die.src='/assets/'+diceArtwork[value];die.alt='Die showing '+value;die.draggable=false;roll.append(die);}roll.onclick=()=>send('RollDice');$('dice').append(roll);}
  $('score-panel').replaceChildren();
  const hints={settlement:'Choose a white corner marker for your settlement.',road:'Choose a white edge marker for your starting road.',roll:'Roll the dice to collect resources.',build:'Build, trade, or play a development card, then end your turn.',discard:'Players with more than seven cards must discard half their hand.',robber:'Choose a white tile marker to move the robber.',steal:'Choose a player to steal one random resource.', 'free-road':'Choose a white edge marker for a free road.',finished:'The host can return everyone to the lobby for a rematch.'};
  $('hint').textContent=g?(g.discardCount?`Select exactly ${g.discardCount} cards to discard.`:mine?hints[g.phase]||'':`Waiting for ${state.players.find(p=>p.id===g.currentPlayer)?.name||'the other players'}. ${g.phase==='discard'?hints.discard:''}`):'Start with bots to play alone, or invite friends with the room link.';
  $('room-info').replaceChildren();
  const roomTitle=document.createElement('strong');roomTitle.textContent=`Room ${state.code}`;$('room-info').append(roomTitle);
  const seats=document.createElement('div');seats.className='player-seats';$('room-info').append(seats);
  for(const p of [...state.players.filter(p=>p.id!==joined.playerId),...state.players.filter(p=>p.id===joined.playerId)]){const seat=document.createElement('div');seat.className='player-seat';if(p.id===joined.playerId)seat.classList.add('your-seat');if(p.id===g?.currentPlayer)seat.classList.add('active-seat');const name=document.createElement('strong');name.textContent=p.name+(p.online?'':' · Offline');seat.append(name);if(p.playing){const stats=document.createElement('div');stats.className='seat-stats';const avatar=document.createElement('div');avatar.className='seat-avatar';avatar.style.borderColor=g.colors[p.id];avatar.append(sprite(p.bot?'icon_bot':'icon_player'));const score=document.createElement('span');score.className='avatar-score';score.textContent=p.id===joined.playerId&&g.scoring?.yourPoints!==p.points?`${p.points} (${g.scoring.yourPoints})`:p.points;score.title=p.id===joined.playerId?'Public points (total including private victory points)':'Public victory points';avatar.append(score);stats.append(avatar,cardBadge('resources',p.resourceCount),cardBadge('development',p.developmentCount));for(const [kind,count]of [['army',p.knightsPlayed],['road',g.scoring?.roadLengths[p.id]||0]]){const metric=document.createElement('div');metric.className='seat-metric';metric.title=kind==='army'?'Played knights':'Longest road length';const held=(kind==='army'?g.scoring?.largestArmy:g.scoring?.longestRoad)===p.id;metric.classList.toggle('award-held',held);metric.title+=(held?' · Award holder (+2 points)':'');metric.setAttribute('aria-label',metric.title+': '+count);metric.append(sidebarIcon(kind==='army'?'army':held?'roadAward':'road'));const number=document.createElement('span');number.textContent=count;metric.append(number);stats.append(metric);}seat.append(stats);}seats.append(seat);}
  $('bank').replaceChildren();if(g){const label=document.createElement('strong');label.textContent='';label.append(sidebarIcon('bank'));label.title='Bank';$('bank').append(label);for(const r of Object.keys(cardSprites))$('bank').append(cardBadge(r,g.bank?.[r]??'—'));$('bank').append(cardBadge('development',g.development?.remaining??'—'));}
  $('actions').replaceChildren();
  const button=(label,action,disabled=false)=>{const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=action;$('actions').append(b);b.onfocus=()=>{const key=Object.keys(actionCosts).find(k=>b.getAttribute('aria-label')?.startsWith(k));if(key)showCostTip(b,key);};b.onblur=()=>cardTip.hidden=true;return b;};
  if(!g){$('turn').textContent='Waiting to start';if(state.host===joined.playerId){button('Start with bots',()=>send('StartGame',{bots:true}));button('Start game',()=>send('StartGame'),state.players.filter(p=>p.online&&!p.bot).length<2);}return;}
  const player=state.players.find(p=>p.id===g.currentPlayer);
  $('turn').textContent=mine?(g.phase==='roll'?'Roll Dice':g.phase==='build'?'Your Turn':hints[g.phase]||g.phase):`${player?.name||'Player'} · ${g.phase}`;$('turn').title=$('hint').textContent;
  for(const [resource,count]of Object.entries(g.resources||{}))$('hand').append(cardBadge(resource,count));
  developmentHand(state,mine);
  $('score-panel').replaceChildren();$('score-panel').hidden=!g.scoring?.winner;if(g.scoring?.winner){const result=document.createElement('p');result.textContent=`${state.players.find(p=>p.id===g.scoring.winner)?.name} wins with ${g.scoring.winningPoints} points!`;$('score-panel').append(result);if(state.host===joined.playerId){const rematch=document.createElement('button');rematch.textContent='Rematch · return to lobby';rematch.onclick=()=>send('Rematch');$('score-panel').append(rematch);}}if(g.phase==='finished'){$('turn').textContent=`${player.name} wins with ${g.scoring.winningPoints} points!`;return;}
  if(g.phase!=='finished'){
    for(const [type,label]of Object.entries({BuildRoad:'Build road · wood + brick',BuildSettlement:'Build settlement · wood + brick + sheep + wheat',BuildCity:'Upgrade city · 2 wheat + 3 ore'})){const available=mine&&g.phase==='build'&&(g.builds[type]||[]).length>0;const b=button(label,()=>{buildMode=type;controls(state);scheduleRender(state.renderer.fixture,state.renderer,state);},!available);b.style.order=({BuildRoad:'2',BuildSettlement:'3',BuildCity:'4'}[type]);b.setAttribute('aria-label',label);b.replaceChildren(actionIcon(({BuildRoad:'road_',BuildSettlement:'settlement_',BuildCity:'city_'}[type])+(['red','blue','orange','green','purple','white'][state.players.filter(p=>p.playing).findIndex(p=>p.id===joined.playerId)]||'red')));const counter=document.createElement('span');counter.className='piece-counter';counter.style.backgroundColor=g.colors[joined.playerId];counter.textContent=type==='BuildRoad'?15-g.edges.filter(e=>e.owner===joined.playerId).length:type==='BuildCity'?4-g.vertices.filter(v=>v.owner===joined.playerId&&v.city).length:5-g.vertices.filter(v=>v.owner===joined.playerId&&!v.city).length;b.append(counter);b.setAttribute('aria-pressed',String(buildMode===type));b.title=label+(available?' · Choose a legal location.':' · Requires resources, a piece, and a legal location.');}
    if(buildMode){$('hint').textContent='Choose a white marker to build, or cancel placement.';button('Cancel placement',()=>{buildMode=null;controls(state);scheduleRender(state.renderer.fixture,state.renderer,state);});}
    const end=button('End turn',()=>{buildMode=null;send('EndTurn');},!mine||g.phase!=='build');end.style.order='5';end.replaceChildren(actionIcon('icon_pass_turn'));end.setAttribute('aria-label','End turn');end.title='End turn';
  }
  if(g.discardCount){
    const fields={};let discardButton;
    const update=()=>{const entries=Object.entries(fields),total=entries.reduce((sum,[,input])=>sum+Number(input.value),0);discardButton.textContent=`Discard ${total} / ${g.discardCount} cards`;discardButton.disabled=total!==g.discardCount||entries.some(([r,input])=>!Number.isInteger(Number(input.value))||Number(input.value)<0||Number(input.value)>g.resources[r]);};
    for(const [name,n]of Object.entries(g.resources)){const label=document.createElement('label');label.textContent=`${name} (${n} available)`;const input=document.createElement('input');input.type='number';input.min=0;input.max=n;input.value=0;input.oninput=update;label.append(input);fields[name]=input;$('actions').append(label);}
    discardButton=document.createElement('button');discardButton.onclick=()=>send('Discard',{cards:Object.fromEntries(Object.entries(fields).map(([r,input])=>[r,Number(input.value)]))});$('actions').append(discardButton);update();
  }
  const buy=button('Buy development card',()=>{closePanels();send('BuyDevelopmentCard');},!mine||g.phase!=='build'||!g.development?.canBuy);buy.style.order='1';buy.replaceChildren(actionIcon('card_devcardback'));buy.title='Buy development card · sheep + wheat + ore';buy.setAttribute('aria-label',buy.title);
  actionPanel('Trade','trade',state,referenceTrade,g.phase==='build'&&(mine&&Object.values(g.resources).some(n=>n>0)||g.tradeOffer?.to===joined.playerId));
  for(const panel of $('actions').querySelectorAll('.action-panel'))panel.style.order=panel.dataset.panel==='trade'?'0':'1';
}
function connect(){
  socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/socket`);
  socket.onmessage=event=>{
    const state=JSON.parse(event.data);
    if(state.type==='SessionEstablished'){$('connection').textContent='Connected to local game server';$('create').disabled=$('join').disabled=false;let saved;try{saved=JSON.parse(sessionStorage.getItem(sessionKey));}catch{}if(saved)send('Resume',saved);}
    if(state.type==='Joined'){joined=state;sessionStorage.setItem(sessionKey,JSON.stringify({code:state.code,token:state.token}));$('lobby').hidden=true;$('probe').hidden=true;$('share').hidden=false;}
    if(state.type==='RoomState'){$('connection').textContent=state.persistence?'Connected · games saved locally':'Connected · temporary games';const previous=latestState;turnFeedback(state);publicEvents(state);latestState=state;if(state.game?.phase!=='build')buildMode=null;controls(state);resourceFeedback(previous,state);scheduleRender(state.renderer.fixture,state.renderer,state);}
    if(state.type==='Chat'){if(latestState)appendLog($('chat-messages'),feedEntry(latestState,state.playerId||state.player||state.id,state.text));else appendLog($('chat-messages'),state.name+': '+state.text);}
    if(state.type==='Error'){$('error').textContent=state.message;if(state.message.startsWith('Saved session')){sessionStorage.removeItem(sessionKey);joined=null;$('lobby').hidden=false;$('probe').hidden=false;}}
  };
  socket.onclose=()=>{$('connection').textContent='Disconnected. Reconnecting…';$('create').disabled=$('join').disabled=true;clearTimeout(retry);retry=setTimeout(connect,1500);};
  socket.onerror=()=>{$('connection').textContent='Unable to reach local server';};
}
$('create').onclick=()=>send('CreateRoom',{name:$('name').value});
$('join').onclick=()=>send('JoinRoom',{name:$('name').value,code:$('code').value.trim().toUpperCase()});
$('code').value=new URLSearchParams(location.search).get('room')||'';
$('sound').checked=soundEnabled;$('sound').onchange=()=>{soundEnabled=$('sound').checked;localStorage.setItem('settlers-sound',soundEnabled?'on':'off');};
$('chat-form').onsubmit=event=>{event.preventDefault();const text=$('chat-input').value.trim();if(text){send('Chat',{text});$('chat-input').value='';}};
$('share').onclick=async()=>{const url=new URL(location.href);url.searchParams.set('room',joined.code);try{await navigator.clipboard.writeText(url.href);$('share').textContent='Copied room link';setTimeout(()=>$('share').textContent='Copy room link',2000);}catch{$('error').textContent=`Room code: ${joined.code}. Copy the address and add ?room=${joined.code}`;}};
$('probe').onclick=async()=>{try{const fixture=await(await fetch('/fixture.json')).json();scheduleRender(fixture,{robber:Object.values(fixture.gameState.mapState.tileHexStates).findIndex(t=>t.type===0)});}catch(error){log(error.message);}};
fetch('/development-cards.json').then(r=>{if(!r.ok)throw Error('Restart renderer server to load development-card catalog');return r.json();}).then(catalog=>{developmentCatalog=catalog;if(latestState)controls(latestState);}).catch(()=>{/* Built-in catalog keeps the private hand usable on older server sessions. */});
connect();
