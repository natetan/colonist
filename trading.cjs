const resources = Object.freeze(['wood','brick','sheep','wheat','ore']);
const owns = (object,key) => Object.prototype.hasOwnProperty.call(object,key);
function cards(value,limit=19) {
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(r=>!resources.includes(r))) throw new Error('Choose valid trade resources.');
  const result={};
  for(const [r,n] of Object.entries(value)){
    if(!Number.isInteger(n)||n<0||n>limit) throw new Error('Trade amounts must be whole numbers from 0 to '+limit+'.');
    if(n>0)result[r]=n;
  }
  if(!Object.keys(result).length)throw new Error('Both sides of a trade need at least one card.');
  return result;
}
const hasCards = (hand,amounts) => Object.entries(amounts).every(([r,n])=>hand[r]>=n);
const commands = ['BankTrade','OfferTrade','AcceptTrade','ConfirmTrade','DeclineTrade','CancelTrade'];
function rates(g,id){
  const result=Object.fromEntries(resources.map(r=>[r,4]));
  for(const harbor of g.harbors||[]){const edge=g.edges[harbor.edge];if(!edge||![edge.a,edge.b].some(v=>g.vertices[v].owner===id))continue;
    for(const r of resources)if(harbor.resource===null||harbor.resource===r)result[r]=Math.min(result[r],harbor.resource===null?3:2);
  }
  return result;
}
function recipients(offer){return offer.recipients||[offer.to];}
function canRespond(offer,id){return !!offer&&recipients(offer).includes(id)&&offer.responses?.[id]!=='declined';}
function confirmable(g,id){const offer=g.tradeOffer;return !offer||offer.from!==id||!hasCards(g.resources[id],offer.give)?[]:recipients(offer).filter(p=>offer.responses?.[p]==='accepted'&&hasCards(g.resources[p],offer.receive));}
function act(g,id,message,eligibleRecipients=g.players) {
  if(!commands.includes(message.type))return false;
  if(g.phase!=='build')throw new Error('Trade only after rolling and resolving the robber.');
  const current=g.players[g.turn];
  if(['AcceptTrade','DeclineTrade'].includes(message.type)){
    const offer=g.tradeOffer;
    if(!offer||offer.id!==message.offerId||offer.from!==current||!canRespond(offer,id))throw new Error('That trade offer is no longer available to you.');
    if(message.type==='DeclineTrade'){offer.responses||={};offer.responses[id]='declined';if(offer.to!==null){g.tradeDecline={...offer,declinedBy:id};g.tradeOffer=null;}return true;}
    if(offer.responses?.[id]==='accepted')throw new Error('You already accepted; wait for the trader to confirm.');
    if(!hasCards(g.resources[offer.from],offer.give)||!hasCards(g.resources[id],offer.receive))throw new Error('This trade cannot be completed. Cancel or change the offer.');
    offer.responses||=Object.fromEntries(recipients(offer).map(p=>[p,'pending']));offer.responses[id]='accepted';return true;
  }
  if(current!==id)throw new Error('It is another player’s turn.');
  if(message.type==='ConfirmTrade'){
    const offer=g.tradeOffer,partner=message.player;
    if(!offer||offer.id!==message.offerId||offer.from!==id||!recipients(offer).includes(partner)||offer.responses?.[partner]!=='accepted')throw new Error('Choose a player who accepted the current offer.');
    // No cards are reserved. Validate both hands again before either is changed.
    if(!confirmable(g,id).includes(partner))throw new Error('This trade cannot be completed. Cancel or change the offer.');
    for(const [r,n]of Object.entries(offer.give)){g.resources[id][r]-=n;g.resources[partner][r]+=n;}
    for(const [r,n]of Object.entries(offer.receive)){g.resources[partner][r]-=n;g.resources[id][r]+=n;}
    g.tradeOffer=null;return true;
  }
  if(message.type==='BankTrade'){
    const {give,receive}=message;
    if(!resources.includes(give)||!resources.includes(receive)||give===receive)throw new Error('Choose two different resources for a bank trade.');
    const cost=rates(g,id)[give];if(g.resources[id][give]<cost)throw new Error(cost===4?'A bank trade costs four matching cards.':`A harbor trade costs ${cost} matching cards.`);
    if(g.bank[receive]<1)throw new Error('The bank has none of that resource.');
    g.resources[id][give]-=cost;g.bank[give]+=cost;g.bank[receive]--;g.resources[id][receive]++;return true;
  }
  if(message.type==='CancelTrade'){
    if(!g.tradeOffer||g.tradeOffer.from!==id||g.tradeOffer.id!==message.offerId)throw new Error('That trade offer is no longer available to cancel.');
    g.tradeOffer=null;return true;
  }
  const broadcast=message.player==='all',targets=broadcast?[...new Set(eligibleRecipients)].filter(p=>g.players.includes(p)&&p!==id):[message.player];
  if(!targets.length||targets.some(p=>!g.players.includes(p)||p===id))throw new Error('Choose another player in this match.');
  const give=cards(message.give,g.resourceSupply||19),receive=cards(message.receive,g.resourceSupply||19);
  if(Object.keys(give).some(r=>owns(receive,r)))throw new Error('A resource cannot appear on both sides of a trade.');
  if(!hasCards(g.resources[id],give))throw new Error('You do not have the cards you offered.');
  g.tradeDecline=null;
  g.tradeSequence=(g.tradeSequence||0)+1;
  g.tradeOffer={id:g.tradeSequence,from:id,to:broadcast?null:message.player,recipients:targets,responses:Object.fromEntries(targets.map(p=>[p,'pending'])),give,receive};return true;
}
function botResponse(g,id){
 const offer=g.tradeOffer,hand=g.resources[id];
 if(!offer||!canRespond(offer,id)||offer.responses?.[id]==='accepted')return null;
 if(!hasCards(hand,offer.receive))return 'DeclineTrade';
 const after={...hand};for(const [r,n]of Object.entries(offer.receive))after[r]-=n;for(const [r,n]of Object.entries(offer.give))after[r]+=n;
 const goals=[{wood:1,brick:1},{wood:1,brick:1,sheep:1,wheat:1},{wheat:2,ore:3},{sheep:1,wheat:1,ore:1}];
 const deficit=h=>Math.min(...goals.map(goal=>Object.entries(goal).reduce((n,[r,k])=>n+Math.max(0,k-h[r]),0)));
 const count=h=>Object.values(h).reduce((a,b)=>a+b,0),scarcity=Object.entries(offer.give).reduce((n,[r,k])=>n+k/(hand[r]+1),0)-Object.entries(offer.receive).reduce((n,[r,k])=>n+k/(hand[r]+1),0);
 return count(after)>=count(hand)&&deficit(after)<=deficit(hand)&&(deficit(after)<deficit(hand)||scarcity>=0)?'AcceptTrade':'DeclineTrade';
}
module.exports={resources,commands,act,hasCards,rates,recipients,canRespond,confirmable,botResponse};
