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
document.getElementById('probe').addEventListener('click',async()=>{
  const button=document.getElementById('probe');button.disabled=true;
  if(activeApp){activeApp.destroy(true,{children:true,texture:false,baseTexture:false});activeApp=undefined;}
  status.textContent='Starting isolated module probe';
  try{
    const fixture=await (await fetch('/fixture.json')).json();
    const mapModule=load(19590);
    const map=new mapModule.rP(fixture.gameState.mapState);
    log(`Original map validator loaded: ${map.tileState.tiles.length} tiles, ${map.tileState.tileCorners.length} corners, ${map.tileState.tileEdges.length} edges`);
    const controller=load(68736);log(`Game controller export: ${typeof controller.UIGameController}`);
    const renderer=load(584);log(`Map renderer export: ${typeof renderer.UIWGameMapController}`);
    const pixi=load(39304).PIXI;log(`Pixi renderer: ${pixi.VERSION}`);
    log('Parsing local texture sheets with Pixi');
    const names=['game_spritesheet_0.47fb957cffb1b48762c0.json','game_spritesheet_1.2d5edbf64b4b0e0a8b4b.json','game_spritesheet_2.3a1a30742e6f65df9781.json','game_spritesheet_3.5088f30d6ffa2dc194b4.json','game_spritesheet_4.f589fb2f92cb5c72e3f9.json'];
    const sheets={};
    for(let index=0;index<names.length;index++){
      const data=await(await fetch('/assets/'+names[index])).json();
      const image=new Image();image.src='/assets/'+data.meta.image;await image.decode();
      const sheet=new pixi.Spritesheet(pixi.BaseTexture.from(image),data);await sheet.parse();
      sheets['game_spritesheet_'+index]=sheet;
    }
    // Offline asset host adapter: avoid unrelated preload bundle machinery.
    const originalBundleLoader=pixi.Assets.loadBundle.bind(pixi.Assets);
    pixi.Assets.loadBundle=(name,progress)=>name==='game'?(progress?.(1),Promise.resolve(sheets)):originalBundleLoader(name,progress);
    await load(78046).UIGameSpriteHandler.loadAssets(false);
    log('Local asset adapter supplied five parsed sheets to the original sprite handler');
    const app=new pixi.Application({width:900,height:650,backgroundColor:0x183b4a,antialias:true});
    activeApp=app;
    document.getElementById('board').replaceChildren(app.view);
    load(71198).z.setCanvasConfigVariables(app);
    log('Pixi canvas constructed');
    const mechanics=[];
    const manager={
      gameState:new (load(35606).n)(),
      canvasController:{app,appW:900,appH:650,chatWidth:0,itemSize:0},
      eventController:{registerUIGameMechanic:value=>mechanics.push(value),registerUIGameAnimation:()=>{},sendEvent:()=>{}},
    };
    // Explicit offline host adapter; normal site startup initializes telemetry.
    load(80708).CA.sessionRecorder={conditionallyStartRecording:()=>{}};
    log('Offline adapter: session recorder disabled; event bus uses no-op dispatch');
    manager.gameController=new controller.UIGameController(manager,fixture);
    log('Original game controller constructed');
    manager.mapController=new renderer.UIWGameMapController(manager);
    log('Original map controller constructed');
    manager.mapController.createMap();
    log('Original createMap completed');
    app.render();
    log(`Scene: ${manager.mapController.tileViews.length} tile views; ${manager.mapController.mapView.children.length} map children`);
    const bounds=manager.mapController.mapView.getBounds();
    log(`Map bounds: ${bounds.x}, ${bounds.y}, ${bounds.width}, ${bounds.height}`);
    log(`Viewport: ${manager.mapController.mapView.hexagonHeight}, scale ${manager.mapController.mapView.scale.x}, center ${JSON.stringify(manager.mapController.mapView.mapCenter)}`);
  }catch(error){log(error.stack||error.message);}finally{button.disabled=false;}
});
