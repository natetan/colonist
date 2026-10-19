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
      input.onchange=()=>onChange(input.value);wrapper.append(input);section.append(wrapper);
      if(label==='Give'||label==='Receive 1'){wrapper.className='bank-resource-picker';const row=document.createElement('div');row.className='trade-card-choices';const buttons=[];for(const [id]of choices){const choice=document.createElement('button');choice.type='button';choice.title=id;choice.setAttribute('aria-label',`${label} ${id}`);const art=document.createElement('span');art.className='sprite-'+({wood:'card_lumber',brick:'card_brick',sheep:'card_wool',wheat:'card_grain',ore:'card_ore'}[id]);choice.append(art);const name=document.createElement('span');name.textContent=id;choice.append(name);choice.onclick=()=>{input.value=id;input.onchange();for(const [key,b]of buttons)b.setAttribute('aria-pressed',String(key===id));};choice.setAttribute('aria-pressed',String(input.value===id));buttons.push([id,choice]);row.append(choice);}section.append(row);}
      return input;
    };
    if(g.currentPlayer===viewerId){
      const bank=document.createElement('p');bank.textContent='Bank · '+describe(g.bank);section.append(bank);
      let bankButton;
      const bankHelp=document.createElement('p');bankHelp.setAttribute('role','status');
      const updateBank=()=>{const cost=g.bankRates?.[give.value]||4;bankButton.textContent=`Trade ${cost} ${give.value} for 1 ${receive.value}`;const reason=give.value===receive.value?'Choose two different resources.':g.resources[give.value]<cost?`You need ${cost} ${give.value}; you have ${g.resources[give.value]}.`:g.bank[receive.value]<1?`The bank has no ${receive.value}.`:cost<4?'Your harbor discount is included.':'Ready to exchange with the bank.';bankHelp.textContent=reason;bankButton.disabled=g.resources[give.value]<cost||g.bank[receive.value]<1||give.value===receive.value;};
      const give=select('Give',resources.map(r=>[r,`${r} (${g.bankRates?.[r]||4}:1)`]),draft.give,value=>{draft.give=value;updateBank();});
      const receive=select('Receive 1',resources.map(r=>[r,r]),draft.receive,value=>{draft.receive=value;updateBank();});
      bankButton=button('Trade with bank',()=>send('BankTrade',{give:give.value,receive:receive.value}));section.append(bankHelp);updateBank();
      const opponents=state.players.filter(p=>p.playing&&p.id!==viewerId&&p.online);
      if(opponents.length){
        const player=select('Offer to',[['all','All players'],...opponents.map(p=>[p.id,p.name])],draft.player,value=>{draft.player=value;});draft.player=player.value;
        const table=document.createElement('table');const header=document.createElement('tr');for(const text of ['Resource','You give','You receive']){const th=document.createElement('th');th.textContent=text;header.append(th);}table.append(header);
        const fields={give:{},receive:{}};let offerButton;
        const offerHelp=document.createElement('p');offerHelp.setAttribute('role','status');
        const updateOffer=()=>{let reason='';let given=0,requested=0;for(const r of resources){const a=Number(fields.give[r].value),b=Number(fields.receive[r].value);given+=a;requested+=b;if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||b>19)reason='Use whole, nonnegative card counts.';else if(a>g.resources[r])reason=`You only have ${g.resources[r]} ${r}.`;else if(a&&b)reason='Offer and request different resources.';}if(!reason&&(!given||!requested))reason='Offer at least one card and request at least one card.';offerHelp.textContent=reason||'Ready to send. Cards transfer only when accepted.';offerButton.disabled=!!reason;};
        for(const resource of resources){const row=document.createElement('tr'),name=document.createElement('th');name.textContent=resource;row.append(name);
          for(const side of ['give','receive']){const td=document.createElement('td'),input=document.createElement('input');input.type='number';input.min=0;input.max=side==='give'?g.resources[resource]:19;input.value=(side==='give'?draft.offerGive:draft.offerReceive)[resource]||0;input.setAttribute('aria-label',`${side==='give'?'Offer':'Request'} ${resource}`);input.oninput=()=>{(side==='give'?draft.offerGive:draft.offerReceive)[resource]=Number(input.value);updateOffer();};fields[side][resource]=input;td.append(input);row.append(td);}table.append(row);
        }
        section.append(table);
        const values=side=>Object.fromEntries(resources.map(r=>[r,Number(fields[side][r].value)]));
        offerButton=button(g.tradeOffer?'Replace trade offer':'Send trade offer',()=>send('OfferTrade',{player:player.value,give:values('give'),receive:values('receive')}));section.append(offerHelp);updateOffer();
      }else{const p=document.createElement('p');p.textContent='Player trades require another player or bot.';section.append(p);}
    }
    const offer=g.tradeOffer;if(!offer)return;
    const name=id=>state.players.find(p=>p.id===id)?.name||'Player';
    const p=document.createElement('p');p.textContent=`${name(offer.from)} offers ${describe(offer.give)} to ${(offer.to===null?'all players':name(offer.to))} for ${describe(offer.receive)}.`;section.append(p);
    for(const id of offer.recipients||[offer.to]){const response=document.createElement('p');response.textContent=name(id)+': '+(offer.responses?.[id]==='declined'?'Declined ✕':offer.responses?.[id]==='accepted'?'Accepted ✓':'Awaiting response');section.append(response);}
    if(offer.from===viewerId){button('Cancel trade offer',()=>send('CancelTrade',{offerId:offer.id}));for(const id of offer.recipients||[offer.to])if(offer.responses?.[id]==='accepted')button('Confirm trade with '+name(id),()=>send('ConfirmTrade',{offerId:offer.id,player:id}),!(g.confirmableTradePlayers||[]).includes(id));}
    if((offer.recipients||[offer.to]).includes(viewerId)&&offer.responses?.[viewerId]!=='declined'){button('Accept trade',()=>send('AcceptTrade',{offerId:offer.id}),!g.canAcceptTrade);button('Decline trade',()=>send('DeclineTrade',{offerId:offer.id}));if(!g.canAcceptTrade){const help=document.createElement('p');help.textContent=offer.responses?.[viewerId]==='accepted'?'Accepted; waiting for the trader to choose.':'You do not have all the requested cards.';section.append(help);}}
  }
  return {render};
})();
