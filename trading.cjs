const resources = Object.freeze(['wood','brick','sheep','wheat','ore']);
const owns = (object,key) => Object.prototype.hasOwnProperty.call(object,key);
function cards(value) {
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(r=>!resources.includes(r))) throw new Error('Choose valid trade resources.');
  const result={};
  for(const [r,n] of Object.entries(value)){
    if(!Number.isInteger(n)||n<0||n>19) throw new Error('Trade amounts must be whole numbers from 0 to 19.');
    if(n>0)result[r]=n;
  }
  if(!Object.keys(result).length)throw new Error('Both sides of a trade need at least one card.');
  return result;
}
const hasCards = (hand,amounts) => Object.entries(amounts).every(([r,n])=>hand[r]>=n);
const commands = ['BankTrade','OfferTrade','AcceptTrade','DeclineTrade','CancelTrade'];
function rates(g,id){
  const result=Object.fromEntries(resources.map(r=>[r,4]));
  for(const harbor of g.harbors||[]){const edge=g.edges[harbor.edge];if(!edge||![edge.a,edge.b].some(v=>g.vertices[v].owner===id))continue;
    for(const r of resources)if(harbor.resource===null||harbor.resource===r)result[r]=Math.min(result[r],harbor.resource===null?3:2);
  }
  return result;
}
function recipients(offer){return offer.recipients||[offer.to];}
function canRespond(offer,id){return !!offer&&recipients(offer).includes(id)&&offer.responses?.[id]!=='declined';}
function act(g,id,message,eligibleRecipients=g.players) {
  if(!commands.includes(message.type))return false;
  if(g.phase!=='build')throw new Error('Trade only after rolling and resolving the robber.');
  const current=g.players[g.turn];
  if(['AcceptTrade','DeclineTrade'].includes(message.type)){
    const offer=g.tradeOffer;
    if(!offer||offer.id!==message.offerId||offer.from!==current||!canRespond(offer,id))throw new Error('That trade offer is no longer available to you.');
    if(message.type==='DeclineTrade'){if(offer.to===null){offer.responses[id]='declined';}else{g.tradeDecline={...offer,declinedBy:id};g.tradeOffer=null;}return true;}
    // Recheck both hands at acceptance; the offer reserves no cards.
    if(!hasCards(g.resources[offer.from],offer.give)||!hasCards(g.resources[id],offer.receive))throw new Error('This trade cannot be completed. Cancel or change the offer.');
    for(const [r,n]of Object.entries(offer.give)){g.resources[offer.from][r]-=n;g.resources[id][r]+=n;}
    for(const [r,n]of Object.entries(offer.receive)){g.resources[id][r]-=n;g.resources[offer.from][r]+=n;}
    g.tradeOffer=null;return true;
  }
  if(current!==id)throw new Error('It is another player’s turn.');
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
  const give=cards(message.give),receive=cards(message.receive);
  if(Object.keys(give).some(r=>owns(receive,r)))throw new Error('A resource cannot appear on both sides of a trade.');
  if(!hasCards(g.resources[id],give))throw new Error('You do not have the cards you offered.');
  g.tradeDecline=null;
  g.tradeSequence=(g.tradeSequence||0)+1;
  g.tradeOffer={id:g.tradeSequence,from:id,to:broadcast?null:message.player,recipients:targets,responses:Object.fromEntries(targets.map(p=>[p,'pending'])),give,receive};return true;
}
module.exports={resources,commands,act,hasCards,rates,recipients,canRespond};
