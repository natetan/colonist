const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
// Minimal DOM for exercising interaction decisions without loading the renderer.
class Element{
  constructor(tag){this.tag=tag;this.children=[];this.value='';this.disabled=false;this.textContent='';this.attributes={};}
  append(...nodes){this.children.push(...nodes);if(this.tag==='select'&&!this.value)this.value=nodes[0]?.value||'';}
  setAttribute(k,v){this.attributes[k]=v;}
}
function load(file){const context={window:{},document:{createElement:tag=>new Element(tag)}};vm.runInNewContext(fs.readFileSync(file,'utf8'),context);return context.window;}
function all(root){return [root,...root.children.flatMap(all)];}
const resources={wood:4,brick:1,sheep:0,wheat:0,ore:0},bank={wood:1,brick:2,sheep:0,wheat:2,ore:2};
const state={code:'UI',players:[{id:'a',name:'A',playing:true,online:true},{id:'b',name:'B',playing:true,online:true}],game:{phase:'build',currentPlayer:'a',resources,bank,bankRates:{wood:2},tradeOffer:null}};
const root=new Element('div'),sent=[];load('public/trading.js').TradeControls.render(root,state,'a',(type,data)=>sent.push({type,data}));
const offer=all(root).find(e=>e.textContent==='Send trade offer');assert(offer.disabled);
const input=label=>all(root).find(e=>e.attributes['aria-label']===label);
const set=(label,value)=>{const e=input(label);e.value=value;e.oninput();};
set('Offer wood',1);set('Request brick',1);assert(!offer.disabled);offer.onclick();assert.equal(sent[0].data.give.wood,1);
set('Request wood',1);assert(offer.disabled);set('Request wood',0);set('Offer wood',5);assert(offer.disabled);set('Offer wood',1.5);assert(offer.disabled);
const exchange=all(root).find(e=>e.textContent==='Trade 2 wood for 1 brick');assert(!exchange.disabled);exchange.onclick();assert.equal(sent[1].type,'BankTrade');
const devRoot=new Element('div');state.game.development={remaining:20,privateVictoryPoints:0,canBuy:false,cards:[{id:'plenty',type:'YearOfPlenty',playable:true},{id:'mono',type:'Monopoly',playable:true},{id:'new',type:'Knight',newThisTurn:true,playable:false}]};
load('public/development.js').DevelopmentControls.render(devRoot,state,'a',()=>{});
const cards=all(devRoot).filter(e=>e.className==='development-card');assert.equal(cards.length,3);
const choices=all(cards[0]).filter(e=>e.tag==='select'),play=all(cards[0]).find(e=>e.textContent==='Play Year of plenty');
assert(play.disabled);choices[1].value='brick';choices[1].onchange();assert(!play.disabled);assert(choices[0].children.find(e=>e.value==='sheep').disabled);
assert(all(cards[1]).filter(e=>e.tag==='select')[0].children.every(e=>!e.disabled));
assert(all(cards[2]).find(e=>e.textContent==='Play Knight').disabled);
console.log('PASS: valid/invalid player offers, harbor exchange action, card availability, bank-aware plenty choices, unrestricted monopoly choices');
