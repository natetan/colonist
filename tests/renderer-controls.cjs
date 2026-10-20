const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
class Element{constructor(){this.children=[];this.dataset={};this.style={setProperty(){}};this.classList={add(){},toggle(){}};}append(...v){this.children.push(...v)}replaceChildren(...v){this.children=v}setAttribute(){}querySelectorAll(){return []}}
const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
const context={document:{createElement:()=>new Element()},$:get,joined:{playerId:'A'},discardAction(){},robberAction(){},gameEnd(){},developmentHand(){},playerOffer(){},sprite:()=>new Element(),sidebarIcon:()=>new Element(),actionIcon:()=>new Element(),cardBadge:()=>new Element(),resourceStack(){},referenceTrade(){},actionPanel(){},send(){},diceArtwork:{1:"one.svg"},actionCosts:{},cardTip:new Element(),cardSprites:{wood:'card_lumber'},buildMode:null};vm.createContext(context);
const source=fs.readFileSync(require('path').resolve(__dirname,'../tools/renderer-lab.js'),'utf8');vm.runInContext(source.slice(source.indexOf('function controls(state)'),source.indexOf('function connect()')),context);
const state={code:'TEST',host:'A',players:[{id:'A',name:'Tester',online:true,playing:true,points:0,resourceCount:0,developmentCount:0,knightsPlayed:0}],game:{phase:'settlement',currentPlayer:'A',colors:{A:'#f00'},vertices:[],edges:[],resources:{wood:0},bank:{wood:19}}};
assert.doesNotThrow(()=>context.controls(state));assert.equal(get('turn').textContent,'Choose a white corner marker for your settlement.');assert(!get('actions').children.some(b=>b.textContent==='Start with bots'));console.log('PASS: setup controls render without scoring, builds, or development fields');
const orderedState={players:['A','B','C','D'].map(id=>({id})),game:{turnOrder:['C','A','D','B']}};
for(const [viewer,expected]of [['A',['D','B','C','A']],['B',['C','A','D','B']],['C',['A','D','B','C']],['D',['B','C','A','D']]])assert.deepEqual(Array.from(context.sidebarPlayers(orderedState,viewer),p=>p.id),expected);
assert.deepEqual(orderedState.players.map(p=>p.id),['A','B','C','D'],'Display ordering preserves seat/color assignments');
console.log('PASS: sidebar follows randomized turn order with each viewer at the bottom');
assert.equal(context.playerColorIndex({players:[{id:'A',playing:true}],game:{colors:{A:'#d592dc'}}},'A'),4);
assert.equal(context.playerColorIndex({players:[{id:'A',playing:true}],game:{colors:{A:'#ffffff'}}},'A'),5);
const costTip={style:{},offsetHeight:50,insertBefore(row){this.row=row;}},costContext={document:{createElement:()=>new Element()},showCardTip(){},cardTip:costTip,sprite:()=>new Element(),cardSprites:{wood:'wood',wheat:'wheat',ore:'ore'},actionCosts:{City:{wheat:2,ore:3}},latestState:{game:{resources:{wheat:1,ore:3}}}};
vm.createContext(costContext);vm.runInContext(source.slice(source.indexOf('function showCostTip('),source.indexOf('function robberAction(')),costContext);
costContext.showCostTip({disabled:true,getBoundingClientRect:()=>({top:100})},'City');
assert.equal(costTip.row.children[0].className,'cost-resource-missing');assert.equal(costTip.row.children[0].children[1].textContent,2);assert.equal(costTip.row.children[1].className,'');assert.equal(costTip.row.children[1].children[1].textContent,3);
costContext.latestState.game.resources.wheat=2;costContext.showCostTip({disabled:false,getBoundingClientRect:()=>({top:100})},'City');assert.equal(costTip.row.children[0].className,'');
console.log('PASS: cost tooltips mark insufficient resources, keep required counts, and leave affordable cards unfaded');
let unread=false,chatLabel;const chatInput={},chatHeading={classList:{toggle(_,value){unread=value;}},setAttribute(_,value){chatLabel=value;}};
const chatContext={joined:{playerId:'A'},document:{activeElement:null},$:id=>id==='chat-input'?chatInput:chatHeading};vm.createContext(chatContext);
vm.runInContext(source.slice(source.indexOf('function updateChatUnread('),source.indexOf('function connect(')),chatContext);
chatContext.updateChatUnread({player:'A'});assert.equal(unread,false);chatContext.updateChatUnread({player:'B'});assert.equal(unread,true);assert.match(chatLabel,/unread/);
chatContext.updateChatUnread({player:'A'});assert.equal(unread,true,'Own messages do not clear unread messages');chatContext.updateChatUnread();assert.equal(unread,false);assert.equal(chatLabel,'Chat');
chatContext.document.activeElement=chatInput;chatContext.updateChatUnread({player:'B'});assert.equal(unread,false,'Messages received while typing are already read');
console.log('PASS: unread chat indicator ignores own messages, clears on input focus, and stays clear while typing');
const theftLog=[],theftBefore={code:'THEFT',game:{vertices:[],edges:[],resources:{},robber:1}},theftAfter={code:'THEFT',players:[{id:'A',name:'Thief'},{id:'B',name:'Victim'}],game:{...theftBefore.game,robber:2,currentPlayer:'A',lastTheft:{sequence:1,thief:'A',victim:'B'}}};
const theftContext={latestState:theftBefore,$:()=>({replaceChildren(){}}),appendLog:(_,entry)=>theftLog.push(entry),feedEntry:(_,id,text)=>id+' '+text,sprite:()=>({}),joined:{playerId:'C'}};vm.createContext(theftContext);
vm.runInContext(source.slice(source.indexOf('function publicEvents('),source.indexOf('const panelOpen=')),theftContext);theftContext.publicEvents(theftAfter);assert(theftLog.includes('A stole 1 card from Victim'));
theftContext.latestState=theftAfter;theftContext.publicEvents(theftAfter);assert.equal(theftLog.filter(entry=>entry.includes('stole')).length,1);theftContext.latestState=null;theftContext.publicEvents(theftAfter);assert.equal(theftLog.filter(entry=>entry.includes('stole')).length,1);
console.log('PASS: robber theft log names both players and suppresses repeated snapshots and reconnect replay');

context.cardBadge=()=>new Element();const sent=[];context.send=(...args)=>sent.push(args);vm.runInContext(source.slice(source.indexOf('let discardDraft='),source.indexOf('function controls(state)')),context);const discardState={code:'TEST',game:{phase:'discard',discardCount:4,resources:{wood:0,brick:0,wheat:3,sheep:4,ore:1}}};context.discardAction(discardState);const box=get('action-box');assert.equal(box.hidden,false);assert.equal(box.children[2].children[1].disabled,true);for(let i=0;i<4;i++)box.children[1].children[3].onclick();assert.equal(box.children[2].children[1].disabled,false);box.children[2].children[0].children[0].onclick();assert.equal(box.children[2].children[1].disabled,true);box.children[1].children[4].onclick();box.children[2].children[1].onclick();assert.equal(sent[0][0],'Discard');assert.equal(sent[0][1].cards.sheep,3);assert.equal(sent[0][1].cards.ore,1);console.log('PASS: discard chooser selection, undo, exact count, and submit');

// Exercise the actual turn notification and audio envelope without audio hardware.
const tones=[],listeners={},notifications=[];
class FakeAudio{constructor(){this.state='running';this.currentTime=10;this.destination={};}resume(){return Promise.resolve();}createOscillator(){const tone={frequency:{setValueAtTime(value){this.value=value;},exponentialRampToValueAtTime(){}},connect(){},disconnect(){},start(time){this.startTime=time;},stop(time){this.stopTime=time;}};tones.push(tone);return tone;}createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}}
const audio={notify:(text,options)=>notifications.push({text,options}),localStorage:{getItem:()=>null},document:{addEventListener:(event,fn)=>listeners[event]=fn},AudioContext:FakeAudio,joined:{playerId:'A'},latestState:null};vm.createContext(audio);vm.runInContext(source.slice(source.indexOf('let audioContext,'),source.indexOf('setInterval(updateTurnClock')),audio);
listeners.keydown();audio.turnFeedback({code:'ONE',game:{currentPlayer:'B',phase:'roll'}});assert.equal(tones.length,0);
const yourTurn={code:'ONE',game:{currentPlayer:'A',phase:'roll'}};audio.turnFeedback(yourTurn);assert.equal(tones.length,3);assert.equal(tones[0].frequency.value,880);assert(tones[0].stopTime-tones[0].startTime>.9);
audio.turnFeedback(yourTurn);assert.equal(tones.length,3,'Repeated snapshots do not repeat the ding');
vm.runInContext('soundEnabled=false',audio);audio.turnFeedback({code:'TWO',game:{currentPlayer:'A',phase:'settlement'}});assert.equal(tones.length,3,'Mute suppresses turn audio');
console.log('PASS: turn bell, keyboard audio unlock, duplicate suppression, and mute');

let plays=0;audio.Audio=class{constructor(url){assert.equal(url,'/audio/dice-roll-sound.mp3');}play(){plays++;return Promise.resolve();}};
vm.runInContext("soundEnabled=true;cue('dice');cue('dice');soundEnabled=false;cue('dice');",audio);assert.equal(plays,2,'MP3 plays on each roll and respects mute');
const sounds=[];audio.cue=kind=>sounds.push(kind||'turn');
const before={code:'SOUND',game:{phase:'build',currentPlayer:'B',vertices:[{id:0,owner:null,city:false}],edges:[{id:0,owner:null}],robber:1,scoring:{longestRoad:null,largestArmy:null}}};
audio.latestState=before;const after=JSON.parse(JSON.stringify(before));after.game.edges[0].owner='B';audio.turnFeedback(after);assert.deepEqual(sounds,['road']);sounds.length=0;
audio.latestState=after;audio.turnFeedback(after);assert.equal(sounds.length,0,'Unchanged placement stays silent');
const house=JSON.parse(JSON.stringify(after));house.game.vertices[0].owner='B';audio.turnFeedback(house);assert.deepEqual(sounds,['settlement']);sounds.length=0;
audio.latestState=house;const city=JSON.parse(JSON.stringify(house));city.game.vertices[0].city=true;audio.turnFeedback(city);assert.deepEqual(sounds,['city']);sounds.length=0;
audio.latestState=city;const awards=JSON.parse(JSON.stringify(city));awards.players=[{id:'A',name:'Nate'},{id:'B',name:'Bot 1'}];awards.game.scoring={longestRoad:'B',largestArmy:'A'};audio.turnFeedback(awards);assert.deepEqual(sounds,['longestRoad','largestArmy']);sounds.length=0;audio.latestState=awards;audio.turnFeedback(awards);assert.equal(sounds.length,0);
audio.latestState={code:'SOUND',game:{...city.game,production:{sequence:1},dice:[3,4]}};
const rolled={...city,game:{...city.game,production:{sequence:2},dice:[3,4]}};audio.turnFeedback(rolled);assert.deepEqual(sounds,['dice'],'Any player roll sounds even with identical dice and no observed roll phase');sounds.length=0;
audio.latestState=rolled;audio.turnFeedback(rolled);assert.equal(sounds.length,0,'Repeated roll snapshot stays silent');
audio.latestState=null;audio.turnFeedback(rolled);assert.equal(sounds.length,0,'Initial connection does not replay the last roll');
assert.deepEqual(notifications.map(n=>n.text),['Bot 1 has achieved Longest Road!','Nate has achieved Largest Army!']);
assert.equal(notifications[0].options.celebrate,true);assert.equal(notifications[1].options.celebrate,false);
assert.equal(notifications.length,2,'Repeated snapshots and initial connections never replay awards');
const transfer=JSON.parse(JSON.stringify(awards));transfer.game.scoring.longestRoad='A';audio.latestState=awards;audio.turnFeedback(transfer);assert.equal(notifications.at(-1).text,'Nate has achieved Longest Road!');
console.log('PASS: dice, road, settlement, city and award sound transitions; named award notifications, transfers, one celebration per update, and no snapshot repeats');
const won=JSON.parse(JSON.stringify(transfer));won.game.scoring.winner='A';won.game.phase='finished';audio.latestState=transfer;audio.turnFeedback(won);
assert.equal(notifications.at(-1).text,'Nate has won!');assert.equal(notifications.at(-1).options.celebrate,true);
const notificationCount=notifications.length;audio.latestState=won;audio.turnFeedback(won);audio.latestState=null;audio.turnFeedback(won);assert.equal(notifications.length,notificationCount,'Victory does not replay on unchanged snapshots or reconnect');
const awardWin=JSON.parse(JSON.stringify(awards));awardWin.game.scoring.longestRoad='A';awardWin.game.scoring.winner='A';audio.latestState=awards;const startNotifications=notifications.length;audio.turnFeedback(awardWin);
assert.equal(notifications.at(-1).text,'Nate has won!');assert.equal(notifications.slice(startNotifications).filter(n=>n.options.celebrate).length,1,'Award and victory share one confetti burst');
console.log('PASS: named victory toast, confetti, duplicate/reconnect suppression and simultaneous award win');

let clockNow=100000;audio.Date={now:()=>clockNow};audio.$=get;sounds.length=0;audio.latestState={code:'CLOCK',game:{currentPlayer:'A',turnTimer:{key:'turn:1:0',deadline:109000}}};audio.updateTurnClock();assert.equal(sounds.length,0);
for(let remaining=8;remaining>=1;remaining--){clockNow=109000-remaining*1000;audio.updateTurnClock();audio.updateTurnClock();}assert.equal(sounds.filter(s=>s==='warning').length,8,'Exactly one warning per final second');
clockNow=109000;audio.updateTurnClock();assert.equal(get('phase-clock').textContent,'00:00');assert.equal(sounds.length,8,'No warning at zero');
audio.latestState.game={currentPlayer:'B',turnTimer:{key:'turn:2:1',deadline:clockNow+8000}};audio.updateTurnClock();assert.equal(sounds.length,8,'Other players do not hear someone else’s warning');audio.latestState.game.discardCount=2;audio.updateTurnClock();assert.equal(sounds.length,9,'A player waiting to discard is warned');
audio.latestState.game.turnTimer=null;audio.updateTurnClock();assert.equal(get('phase-clock').textContent,'Off');
console.log('PASS: synchronized countdown, final eight warning ticks, duplicate suppression, zero and inactive-player silence');
