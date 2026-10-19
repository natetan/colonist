const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),sessions=require('../public/reconnect.js');
function storage(){const entries=new Map();return {getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};}
const persistent=storage(),tab=storage(),a={code:'ABCDEF',token:'a'.repeat(48)},b={code:'123ABC',token:'b'.repeat(48)};
let seats=sessions.create(persistent,tab);seats.remember(a);seats.remember(b);
assert.equal(seats.find(' abcdef ').token,a.token);assert.equal(seats.automatic().code,b.code);assert.equal(seats.automatic(a.code).token,a.token);assert.equal(seats.automatic('FEDCBA'),null,'An invite must not resume an unrelated table');
seats=sessions.create(persistent,storage());assert.equal(seats.find(a.code).token,a.token,'Closing the original tab preserves its seat');assert.equal(seats.automatic(),null,'A fresh homepage does not silently join an old table');
seats.forget(a.code);assert.equal(sessions.create(persistent,storage()).find(a.code),null);assert.equal(seats.find(b.code).token,b.token);
const legacy=storage();legacy.setItem('private-settlers-renderer-session',JSON.stringify(a));assert.equal(sessions.create(persistent,legacy).automatic().token,a.token);assert.equal(sessions.create(persistent,storage()).find(a.code).token,a.token);
const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};const memory=sessions.create(blocked,blocked);memory.remember(a);assert.equal(memory.automatic().token,a.token);memory.forget(a.code);assert.equal(memory.find(a.code),null);
assert(!sessions.valid({...a,token:'wrong'}));
const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:false,textContent:'',addEventListener(){},focus(){}});return elements.get(id);},sent=[];
const source=fs.readFileSync('tools/renderer-lab.js','utf8'),context={SeatSessions:sessions,seatSessions:sessions.create(persistent,storage()),$:get,send:(...v)=>sent.push(v),resumeSeat:s=>sent.push(['Resume',s]),beginInvite:code=>sent.push(['PreviewRoom',{code}]),navigator:{}};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf("$('join').onclick="),source.indexOf("$('code').value=")),context);
get('code').value=a.code;get('name').value='';get('join').onclick();assert.equal(sent.at(-1)[0],'Resume');assert.equal(sent.at(-1)[1].token,a.token);
get('code').value='FEDCBA';get('recovery-key').value=b.token;get('join').onclick();assert.equal(sent.at(-1)[1].token,b.token);get('recovery-key').value='';get('name').value='New player';get('join').onclick();assert.equal(sent.at(-1)[0],'PreviewRoom');
console.log('PASS: durable per-room seats, closed tabs, legacy migration, invite isolation, storage denial, quit cleanup, and real join-button recovery without a name');
