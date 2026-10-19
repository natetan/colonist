(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SeatSessions=factory();})(typeof window==='undefined'?globalThis:window,function(){
  const tabKey='private-settlers-renderer-session',roomsKey='natac-saved-seats';
  const valid=s=>s&&typeof s.code==='string'&&/^[A-F0-9]{6}$/.test(s.code)&&typeof s.token==='string'&&/^[a-f0-9]{48}$/.test(s.token);
  function create(persistent,tab){
    let memory={},active=null;
    const read=(storage,key)=>{try{return JSON.parse(storage?.getItem(key));}catch{return null;}};
    const write=(storage,key,value)=>{try{if(value===null)storage?.removeItem(key);else storage?.setItem(key,JSON.stringify(value));}catch{/* Storage can be blocked; this tab can still reconnect. */}};
    function rooms(){const saved=read(persistent,roomsKey);return {...(saved&&typeof saved==='object'?Object.fromEntries(Object.entries(saved).filter(([code,s])=>valid(s)&&s.code===code)):{}),...memory};}
    function remember(s){if(!valid(s))return;active={code:s.code,token:s.token};const all=rooms();delete all[s.code];all[s.code]=active;memory=Object.fromEntries(Object.entries(all).slice(-20));write(persistent,roomsKey,memory);write(tab,tabKey,active);}
    function find(code){code=String(code||'').trim().toUpperCase();const current=active||read(tab,tabKey);if(valid(current)&&current.code===code)return {code:current.code,token:current.token};const saved=rooms()[code];return valid(saved)?{code:saved.code,token:saved.token}:null;}
    function automatic(inviteCode){if(inviteCode)return find(inviteCode);const current=active||read(tab,tabKey);if(!valid(current))return null;remember(current);return find(current.code);}
    function forget(code){const all=rooms();delete all[code];memory=all;write(persistent,roomsKey,all);const current=active||read(tab,tabKey);if(current?.code===code){active=null;write(tab,tabKey,null);}}
    return {remember,find,automatic,forget};
  }
  return {create,valid};
});
