const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),boards=require('../board.cjs');
class Element{constructor(){this.children=[];this.attributes={};this.namespaceURI='http://www.w3.org/2000/svg';}setAttribute(k,v){this.attributes[k]=v;}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}}
const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
const context={window:{},document:{getElementById:get,createElement:()=>new Element(),createElementNS:()=>new Element()}};vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').resolve(__dirname,'../tools/renderer-menu.js'),'utf8'),context);
const sent=[],state={code:'123ABC',host:'A',mapType:'classic',...boards.classic(),players:[{id:'A',name:'Host',online:true},{id:'B',name:'Friend',online:true}]};
context.window.MainMenu.render(state,'A',(...args)=>sent.push(args));assert.equal(get('game-layout').hidden,true);assert.equal(get('regenerate').disabled,true);assert.equal(get('menu-start').disabled,false);assert.equal(get('map-preview').children[0].children.filter(n=>n.attributes.points).length,19);
get('map-type').value='random';get('map-type').onchange();assert.equal(sent[0][0],'SetMap');assert.equal(sent[0][1].mapType,'random');
context.window.MainMenu.render({...state,mapType:'random'},'A',(...args)=>sent.push(args));assert.equal(get('regenerate').disabled,false);get('regenerate').onclick();assert.equal(sent[1][1].mapType,'random');
context.window.MainMenu.render(state,'B',()=>{});assert.equal(get('map-type').disabled,true);assert.equal(get('menu-start-bots').disabled,true);
context.window.MainMenu.render({...state,game:{phase:'settlement'}},'A',()=>{});assert.equal(get('game-layout').hidden,false);assert.equal(get('room-menu').hidden,true);
console.log('PASS: menu preview, Classic/Random controls, regeneration, guest permissions and transition into game');

const large={...state,...boards.classic(true),maxPlayers:6,mapSize:'extended'};context.window.MainMenu.render(large,'A',(...args)=>sent.push(args));assert.equal(get('map-size').value,'extended');assert.equal(get('bot-fill-label').hidden,false);assert.equal(get('lobby-count').textContent,'2 / 6');assert.equal(get('map-preview').children[0].children.filter(n=>n.attributes.points).length,30);
get('bot-fill').value='5';get('menu-start-bots').onclick();assert.equal(sent[sent.length-1][1].targetPlayers,5);get('map-size').value='standard';get('map-size').onchange();assert.equal(sent[sent.length-1][1].mapSize,'standard');
console.log('PASS: large-map preview, six-seat lobby, bot target selection and island size requests');

context.window.MainMenu.render({...state,turnSeconds:60},'A',(...args)=>sent.push(args));assert.equal(get('turn-seconds').value,'60');get('turn-seconds').value='90';get('turn-seconds').onchange();assert.equal(sent[sent.length-1][0],'SetTurnTimer');assert.equal(sent[sent.length-1][1].seconds,90);context.window.MainMenu.render({...state,turnSeconds:90},'B',()=>{});assert.equal(get('turn-seconds').disabled,true);
console.log('PASS: shared lobby turn-duration setting and guest lock');
get('match-preset').options=[{value:'standard'},{value:'expanded'},{value:'epic'},{value:'custom'}];get('victory-points').options=[{value:'10'},{value:'20'}];get('piece-supply').options=[{value:'standard'},{value:'epic'}];
context.window.MainMenu.render(state,'A',(...args)=>sent.push(args));assert.equal(get('match-preset').options[2].disabled,true);assert.match(get('match-preset').options[2].title,/large map/);assert.equal(get('victory-points').options[1].disabled,true);
const epicState={...large,rules:{victoryPoints:20,pieceSupply:'epic'}};context.window.MainMenu.render(epicState,'A',(...args)=>sent.push(args));assert.equal(get('match-preset').value,'epic');assert.equal(get('match-preset').options[2].disabled,false);
get('victory-points').value='12';get('victory-points').onchange();assert.equal(sent.at(-1)[0],'SetMatchRules');assert.equal(sent.at(-1)[1].victoryPoints,12);assert.equal(sent.at(-1)[1].pieceSupply,'epic');
context.window.MainMenu.render({...epicState,rules:{victoryPoints:12,pieceSupply:'epic'}},'B',()=>{});assert.equal(get('match-preset').value,'custom');assert.equal(get('victory-points').disabled,true);assert.equal(get('piece-supply').disabled,true);
console.log('PASS: preset/custom lobby controls, guest lock, independent settings, and disabled Epic explanation on small maps');

for(const type of ['random-plus-plus','random-plus','star','crescent','long-island','china'])for(const extended of [false,true]){const board=boards.generate(undefined,extended,type);context.window.MainMenu.render({...state,mapType:type,board,maxPlayers:extended?6:4},'A',(...args)=>sent.push(args));assert.equal(get('regenerate').disabled,false);get('regenerate').onclick();assert.equal(sent[sent.length-1][1].mapType,type);const [x,y,w,h]=get('map-preview').children[0].attributes.viewBox.split(' ').map(Number);for(const t of board){const px=51*Math.sqrt(3)*(t.q+t.r/2),py=76.5*t.r;assert(px-51>=x&&px+51<=x+w&&py-51>=y&&py+51<=y+h);}}
console.log('PASS: shaped preview bounds for both sizes and regeneration preserves selected shape');

context.window.MainMenu.render({...state,joiningPlayers:1},'A',()=>{});assert.equal(get('lobby-count').textContent,'3 / 4');assert.equal(get('lobby-players').children.at(-1).textContent,'Player joining…');assert.equal(get('menu-start').disabled,true);assert.equal(get('menu-start-bots').disabled,true);
console.log('PASS: temporary joining entries and start controls wait for names');

const labSource=fs.readFileSync(require('path').resolve(__dirname,'../tools/renderer-lab.js'),'utf8');
const nameSetup=labSource.slice(labSource.indexOf('function rememberPlayerName(){'),labSource.indexOf('const seatSessions='));
const savedNames=new Map(),nameFields={name:{addEventListener(_,fn){this.input=fn;}},'invite-name':{addEventListener(_,fn){this.input=fn;}}};
const nameStorage={getItem:key=>savedNames.get(key),setItem:(key,value)=>savedNames.set(key,value),removeItem:key=>savedNames.delete(key)};
const nameContext={browserStorage:()=>nameStorage,$:id=>nameFields[id]};vm.createContext(nameContext);vm.runInContext(nameSetup+'rememberPlayerName();',nameContext);
assert.equal(nameFields.name.value,'');nameFields.name.value='Nate';nameFields.name.input();assert.equal(savedNames.get('settlers-player-name'),'Nate');assert.equal(nameFields['invite-name'].value,'Nate');
vm.runInContext('rememberPlayerName();',nameContext);assert.equal(nameFields.name.value,'Nate');
nameFields['invite-name'].value='Another name';nameFields['invite-name'].input();assert.equal(nameFields.name.value,'Another name');assert.equal(savedNames.get('settlers-player-name'),'Another name');
nameFields.name.value='';nameFields.name.input();assert(!savedNames.has('settlers-player-name'));assert.equal(nameFields['invite-name'].value,'');
nameContext.browserStorage=()=>({getItem(){throw Error('Blocked');},setItem(){throw Error('Blocked');}});vm.runInContext('rememberPlayerName();',nameContext);nameFields.name.value='Still works';assert.doesNotThrow(()=>nameFields.name.input());
console.log('PASS: names persist across visits, sync main/invite fields, update, clear, and tolerate blocked storage');
