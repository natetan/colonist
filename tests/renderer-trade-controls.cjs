const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
class Element{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.attrs={};this.style={};this.className='';this.classList={toggle(){}};}
  append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  setAttribute(k,v){this.attrs[k]=v;}
  getAttribute(k){return this.attrs[k]??null;}
  contains(node){return this===node||this.children.some(c=>c.contains(node));}
  querySelectorAll(selector){const matches=e=>selector==='button'?e.tagName==='button':selector==='strong'?e.tagName==='strong':selector==='.reference-trade'?e.className.includes('reference-trade'):selector==='.resource-card[data-resource]'?e.className==='resource-card'&&e.dataset.resource!==undefined:false;return this.children.flatMap(c=>[...(matches(c)?[c]:[]),...c.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  focus(){}
}
const hand=new Element(),panel=new Element('details');panel.open=true;
const badge=(resource,n)=>{const b=new Element();b.className='resource-card';b.dataset.resource=resource;const count=new Element('strong');count.textContent=n;b.append(count);return b;};
for(const r of ['wood','brick','sheep','wheat','ore'])hand.append(badge(r,r==='sheep'?3:0));
const sent=[],context={document:{createElement:t=>new Element(t),activeElement:null},$:()=>hand,joined:{playerId:'A'},send:(...v)=>sent.push(v),sprite:()=>new Element(),actionIcon:()=>new Element(),cardBadge:badge,resourceStack(){},cardSprites:{wood:1,brick:1,sheep:1,wheat:1,ore:1},closePanels(){panel.open=false;}};
vm.createContext(context);const source=fs.readFileSync(path.resolve(__dirname,'../tools/renderer-lab.js'),'utf8');
vm.runInContext(source.slice(source.indexOf('let tradeDraft='),source.indexOf('let audioContext')),context);
const state={code:'TEST',players:[{id:'A',playing:true,online:true},{id:'B',name:'Friend',playing:true,online:true}],game:{phase:'build',currentPlayer:'A',resources:{wood:0,brick:0,sheep:3,wheat:0,ore:0},bank:{wood:19,brick:19,sheep:16,wheat:19,ore:19},bankRates:{sheep:4}}};
context.referenceTrade(panel,state,'A',context.send);context.syncTradeInventory(state,panel);
const root=panel.querySelector('.reference-trade'),sheep=hand.children[2];
sheep.onclick();sheep.onclick();assert.equal(sheep.querySelector('strong').textContent,1);assert.equal(panel.querySelector('.reference-trade'),root,'Popup identity stays stable');assert.equal(panel.open,true);
const remove=root.querySelectorAll('button').find(b=>b.getAttribute('aria-label')==='Remove offered sheep');remove.onclick();assert.equal(sheep.querySelector('strong').textContent,2);
root.querySelectorAll('button').find(b=>b.getAttribute('aria-label')==='Request ore').onclick();const offerButton=root.querySelectorAll('button').find(b=>b.getAttribute('aria-label')==='Send player offer');offerButton.onclick();assert.equal(sent[0][1].player,'all');sent.length=0;
const bank=root.querySelectorAll('button').find(b=>b.getAttribute('aria-label')==='Trade with bank');assert.equal(bank.disabled,true,'One sheep cannot pay a 4:1 trade');assert.equal(sent.length,0);
panel.open=false;context.syncTradeInventory(state,panel);assert.equal(sheep.querySelector('strong').textContent,3);
// Run the real dismissal helper: a closed draft must not survive reopening.
context.latestState=state;context.$=id=>id==='actions'?{querySelectorAll:()=>[panel]}:hand;panel.dataset.panel='trade';context.panelOpen={trade:true};
vm.runInContext(source.slice(source.indexOf('function closePanels('),source.indexOf("document.addEventListener('pointerdown'")),context);context.closePanels();
assert.equal(vm.runInContext('Object.keys(tradeDraft.give).length',context),0);
vm.runInContext("tradeDraft={give:{sheep:1},receive:{ore:1},to:'B'}",context);panel.open=true;context.reconcileTradeDraft({game:{tradeOffer:{id:1}}},{game:{tradeOffer:null,tradeDecline:{declinedBy:'B'}}});assert.equal(panel.open,true,'Decline keeps draft editable');context.reconcileTradeDraft({game:{tradeOffer:{id:1}}},{game:{tradeOffer:null,tradeDecline:null}});assert.equal(panel.open,false,'Acceptance clears and closes sender draft');assert.equal(vm.runInContext('Object.keys(tradeDraft.give).length',context),0);
assert.equal(vm.runInContext('Object.keys(tradeDraft.receive).length',context),0);
panel.open=false;context.syncTradeInventory(state,panel);sheep.onclick();assert.equal(panel.open,true);assert.equal(vm.runInContext('tradeDraft.give.sheep',context),1);assert.equal(sheep.querySelector('strong').textContent,2);sheep.onclick();sheep.onclick();assert.equal(sheep.hidden,true,'Exhausted resource stacks disappear');const undo=panel.querySelectorAll('button').find(b=>b.getAttribute('aria-label')==='Remove offered sheep');undo.onclick();assert.equal(sheep.hidden,false,'Removing an offer restores the stack');assert.equal(sheep.querySelector('strong').textContent,1);assert.equal(hand.children[0].hidden,true,'Zero-count resource cards stay hidden');context.closePanels();
console.log('PASS: card-click opens trade with selection, zero stacks hide, and undo restores cards');
console.log('PASS: trade popup identity, remaining counters, undo, bank affordability, dismissal reset');

const incoming=new Element();context.$=()=>incoming;vm.runInContext(source.slice(source.indexOf('function tradeTargets('),source.indexOf('let endgameTab')),context);
const offers={players:[{id:'A',name:'Host'},{id:'B',name:'Friend'},{id:'C',name:'Bot 1',bot:true}],game:{phase:'build',colors:{A:'#f00',B:'#00f',C:'#0f0'},confirmableTradePlayers:['B','C'],tradeOffer:{id:7,from:'A',to:null,recipients:['B','C'],responses:{B:'accepted',C:'accepted'},give:{wood:1},receive:{brick:1}}}};
context.playerOffer(offers);const confirmations=incoming.querySelectorAll('button').filter(b=>b.getAttribute('aria-label')?.startsWith('Confirm trade with'));assert.equal(confirmations.length,2);confirmations[1].onclick();assert.equal(sent.at(-1)[0],'ConfirmTrade');assert.equal(sent.at(-1)[1].player,'C');
assert(incoming.children[0].children[2].children.every(b=>b.title.includes('Accepted')));console.log('PASS: accepted badges and separate final-confirmation buttons for each willing partner');
