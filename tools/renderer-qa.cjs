// Replays real, redacted WebSocket snapshots without touching saved player rooms.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const {presentBoard}=require('./renderer-state.cjs');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'.rea-tools/renderer/assets');
for(const test of ['base-game-network','trading-network']){
  const result=spawnSync(process.execPath,[path.join(root,'tests',test+'.cjs')],{cwd:root,env:{...process.env,SETTLERS_RECORD_QA:'1'},stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
const match=JSON.parse(fs.readFileSync(path.join(root,'.rea-tools/full-game-qa.json')));
const trades=JSON.parse(fs.readFileSync(path.join(root,'.rea-tools/trading-qa.json')));
const scenarios=[];
function add(name,record,index){if(index>=0){const state=record.states[index];scenarios.push({name,viewerId:record.viewerId,state:{...state,renderer:presentBoard(state)}});}}
add('Match: setup',match,0);
add('Match: resource production',match,match.states.findIndex(s=>s.game.production?.transfers.length));
add('Match: discard',match,match.states.findIndex(s=>s.game.discardCount));
add('Match: development hand',match,match.states.findIndex(s=>s.game.development?.cards.length>=3));
for(const [i,record]of trades.entries()){
  add('Trade '+(i?'recipient':'sender')+': pending',record,record.states.findIndex(s=>s.game.tradeOffer));
  add('Trade '+(i?'recipient':'sender')+': declined',record,record.states.findIndex(s=>s.game.tradeDecline));
}
add('Match: results',match,match.states.length-1);
for(const [name,predicate]of [
  ['Settlement',(s,p)=>s.game.vertices.some(v=>v.owner&&!p.game.vertices[v.id]?.owner)],
  ['Road',(s,p)=>s.game.edges.some(e=>e.owner&&!p.game.edges[e.id]?.owner)],
  ['City',(s,p)=>s.game.vertices.some(v=>v.city&&!p.game.vertices[v.id]?.city)],
  ['Production',(s,p)=>s.game.production?.transfers.length&&s.game.production.sequence!==p.game.production?.sequence],
  ['Development purchase',(s,p)=>(s.game.development?.cards.length||0)>(p.game.development?.cards.length||0)]
]){
  const index=match.states.findIndex((s,i)=>i>0&&predicate(s,match.states[i-1]));
  if(index>0){add('Animation: '+name,match,index);const prior=match.states[index-1];scenarios[scenarios.length-1].before={...prior,renderer:presentBoard(prior)};}
}
// Keep every match frame for animation playback, not only the named checkpoints.
const frames=match.states.map(state=>({viewerId:match.viewerId,state:{...state,renderer:presentBoard(state)}}));
fs.writeFileSync(path.join(assets,'qa-snapshots.json'),JSON.stringify({scenarios,frames}));
const html=fs.readFileSync(path.join(__dirname,'renderer-lab.html'),'utf8').replace('<title>Private Settlers</title>','<title>Renderer QA replay</title>').replace('<script src="/lab.js">','<script src="/assets/qa-transport.js"></script><script src="/lab.js">');
fs.writeFileSync(path.join(assets,'qa.html'),html);
fs.copyFileSync(path.join(__dirname,'renderer-qa-transport.js'),path.join(assets,'qa-transport.js'));
require('./renderer-server.cjs').startRendererLab(Number(process.env.RENDERER_QA_PORT||3010)).then(server=>{
  console.log('Visual QA: http://127.0.0.1:'+server.address().port+'/assets/qa.html');
  process.on('SIGINT',()=>server.closeLab().then(()=>process.exit()));
});
