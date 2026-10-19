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
