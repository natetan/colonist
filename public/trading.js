// Shared local trade controls; all card transfers are validated by the server.
window.TradeControls=(()=>{
  const resources=['wood','brick','sheep','wheat','ore'];
  let draftKey,draft;
  const describe=cards=>Object.entries(cards).map(([r,n])=>`${n} ${r}`).join(' + ');
  function render(parent,state,viewerId,send){
    const g=state.game;if(!g||g.phase!=='build')return;
    const key=state.code+':'+viewerId;if(key!==draftKey){draftKey=key;draft={give:'wood',receive:'brick',player:'',offerGive:{},offerReceive:{}};}
    const section=document.createElement('section');section.className='trade-controls';
    const heading=document.createElement('h3');heading.textContent='Trading';section.append(heading);parent.append(section);
    const button=(label,fn,disabled=false)=>{const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=fn;section.append(b);return b;};
    const select=(label,choices,value,onChange)=>{
      const wrapper=document.createElement('label');wrapper.textContent=label+' ';
      const input=document.createElement('select');for(const [id,text]of choices){const option=document.createElement('option');option.value=id;option.textContent=text;input.append(option);}
      if(choices.some(([id])=>id===value))input.value=value;
      input.onchange=()=>onChange(input.value);wrapper.append(input);section.append(wrapper);return input;
    };
    if(g.currentPlayer===viewerId){
      const bank=document.createElement('p');bank.textContent='Bank · '+describe(g.bank);section.append(bank);
      let bankButton;
      const updateBank=()=>{bankButton.disabled=g.resources[give.value]<4||g.bank[receive.value]<1||give.value===receive.value;};
      const give=select('Give 4',resources.map(r=>[r,r]),draft.give,value=>{draft.give=value;updateBank();});
      const receive=select('Receive 1',resources.map(r=>[r,r]),draft.receive,value=>{draft.receive=value;updateBank();});
      bankButton=button('Trade with bank',()=>send('BankTrade',{give:give.value,receive:receive.value}));updateBank();
      const opponents=state.players.filter(p=>p.playing&&!p.bot&&p.id!==viewerId&&p.online);
      if(opponents.length){
        const player=select('Offer to',opponents.map(p=>[p.id,p.name]),draft.player,value=>{draft.player=value;});draft.player=player.value;
        const table=document.createElement('table');const header=document.createElement('tr');for(const text of ['Resource','You give','You receive']){const th=document.createElement('th');th.textContent=text;header.append(th);}table.append(header);
        const fields={give:{},receive:{}};
        for(const resource of resources){const row=document.createElement('tr'),name=document.createElement('th');name.textContent=resource;row.append(name);
          for(const side of ['give','receive']){const td=document.createElement('td'),input=document.createElement('input');input.type='number';input.min=0;input.max=side==='give'?g.resources[resource]:19;input.value=(side==='give'?draft.offerGive:draft.offerReceive)[resource]||0;input.setAttribute('aria-label',`${side==='give'?'Offer':'Request'} ${resource}`);input.oninput=()=>{(side==='give'?draft.offerGive:draft.offerReceive)[resource]=Number(input.value);};fields[side][resource]=input;td.append(input);row.append(td);}table.append(row);
        }
        section.append(table);
        const values=side=>Object.fromEntries(resources.map(r=>[r,Number(fields[side][r].value)]));
        button(g.tradeOffer?'Replace trade offer':'Send trade offer',()=>send('OfferTrade',{player:player.value,give:values('give'),receive:values('receive')}));
      }else{const p=document.createElement('p');p.textContent='Player trades require another online human. Bots do not negotiate trades.';section.append(p);}
    }
    const offer=g.tradeOffer;if(!offer)return;
    const name=id=>state.players.find(p=>p.id===id)?.name||'Player';
    const p=document.createElement('p');p.textContent=`${name(offer.from)} offers ${describe(offer.give)} to ${name(offer.to)} for ${describe(offer.receive)}.`;section.append(p);
    if(offer.from===viewerId)button('Cancel trade offer',()=>send('CancelTrade',{offerId:offer.id}));
    if(offer.to===viewerId){button('Accept trade',()=>send('AcceptTrade',{offerId:offer.id}),!g.canAcceptTrade);button('Decline trade',()=>send('DeclineTrade',{offerId:offer.id}));}
  }
  return {render};
})();
