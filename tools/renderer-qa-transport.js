// Diagnostic-only transport: snapshots originate in real integration tests.
// The normal app never loads this file. No commands reach a live game.
class ReplaySocket {
  static OPEN=1;
  readyState=1;
  constructor(){
    fetch('/assets/qa-snapshots.json').then(r=>r.json()).then(data=>{
      const bar=document.createElement('div');bar.style.cssText='position:fixed;left:75px;top:5px;z-index:300;background:#fff5df;color:#222;padding:4px;display:flex;gap:5px;align-items:center;font:12px Arial';
      const label=document.createElement('span');label.textContent='Replay (no live moves)';
      const select=document.createElement('select');select.setAttribute('aria-label','QA scenario');
      data.scenarios.forEach((s,i)=>{const o=document.createElement('option');o.value=i;o.textContent=s.name;select.append(o);});
      const counter=document.createElement('span');let frame=0,timer,transition,scene=0;
      const emit=value=>this.onmessage?.({data:JSON.stringify(value)});
      const show=entry=>{const state={...entry.state,code:entry.state.code+'-qa-'+scene};emit({type:'Joined',code:state.code,playerId:entry.viewerId,token:'qa-only'});emit(state);};
      select.onchange=()=>{clearInterval(timer);timer=null;clearTimeout(transition);scene++;const entry=data.scenarios[select.value];if(entry.before){show({...entry,state:entry.before});transition=setTimeout(()=>show(entry),1200);}else show(entry);counter.textContent='Checkpoint';};
      const next=document.createElement('button');next.textContent='Next frame';next.onclick=()=>{show(data.frames[Math.min(frame++,data.frames.length-1)]);counter.textContent=frame+'/'+data.frames.length;};
      const play=document.createElement('button');play.textContent='Play / pause';play.onclick=()=>{if(timer){clearInterval(timer);timer=null;}else timer=setInterval(()=>{next.onclick();if(frame>=data.frames.length){clearInterval(timer);timer=null;}},750);};
      bar.append(label,select,next,play,counter);document.body.append(bar);emit({type:'SessionEstablished'});show(data.scenarios[0]);
    });
  }
  send(){}
}
window.WebSocket=ReplaySocket;
