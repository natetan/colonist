const assert=require('assert/strict');
const rules=require('../game.cjs'),turns=require('../turns.cjs'),trading=require('../trading.cjs');
const tiles=[{q:0,r:0,resource:'desert',number:0}];
function fixture(){const g=rules.start(tiles,['A','B','C']);turns.begin(g,tiles);g.phase='build';g.resources.A={wood:6,brick:0,sheep:2,wheat:1,ore:0};g.resources.B={wood:0,brick:5,sheep:0,wheat:3,ore:1};g.resources.C={wood:0,brick:0,sheep:0,wheat:0,ore:0};for(const r of trading.resources)g.bank[r]=19-g.players.reduce((n,p)=>n+g.resources[p][r],0);return g;}
const act=(g,id,message)=>turns.act(g,tiles,id,message);
const totals=g=>trading.resources.map(r=>g.bank[r]+g.players.reduce((n,p)=>n+g.resources[p][r],0));
function reject(g,id,message,pattern){const before=JSON.stringify(g);assert.throws(()=>act(g,id,message),pattern);assert.equal(JSON.stringify(g),before);}
let g=fixture();const conservation=totals(g);
act(g,'A',{type:'BankTrade',give:'wood',receive:'ore'});assert.equal(g.resources.A.wood,2);assert.equal(g.resources.A.ore,1);assert.deepEqual(totals(g),conservation);
reject(g,'A',{type:'BankTrade',give:'wood',receive:'brick'},/four matching/);
reject(g,'B',{type:'BankTrade',give:'brick',receive:'wood'},/another player/);
for(const give of ['ore','__proto__','bogus',null])reject(g,'A',{type:'BankTrade',give,receive:give},/different resources/);
g.bank.brick=0;g.resources.A.wood=4;reject(g,'A',{type:'BankTrade',give:'wood',receive:'brick'},/bank has none/);
g=fixture();act(g,'A',{type:'OfferTrade',player:'B',give:{wood:2,sheep:1},receive:{brick:2,wheat:1}});const offer=g.tradeOffer,bank={...g.bank},beforeTotals=totals(g);
assert.deepEqual(g.resources.A,fixture().resources.A); // An offer reserves/transfers nothing.
reject(g,'C',{type:'AcceptTrade',offerId:offer.id},/no longer available/);
reject(g,'A',{type:'AcceptTrade',offerId:offer.id},/no longer available/);
act(g,'B',{type:'AcceptTrade',offerId:offer.id});assert.equal(g.resources.A.wood,6);assert.equal(g.tradeOffer.responses.B,'accepted');reject(g,'B',{type:'ConfirmTrade',offerId:offer.id,player:'B'},/another player/);act(g,'A',{type:'ConfirmTrade',offerId:offer.id,player:'B'});assert.equal(g.resources.A.wood,4);assert.equal(g.resources.A.brick,2);assert.equal(g.resources.B.wood,2);assert.equal(g.resources.B.wheat,2);assert.equal(g.tradeOffer,null);assert.deepEqual(g.bank,bank);assert.deepEqual(totals(g),beforeTotals);
reject(g,'B',{type:'AcceptTrade',offerId:offer.id},/no longer available/);
for(const give of [{},[],{wood:0},{wood:-1},{wood:1.5},{wood:20},{wood:'1'},JSON.parse('{"__proto__":1}'),{bogus:1}])reject(g,'A',{type:'OfferTrade',player:'B',give,receive:{brick:1}});
reject(g,'A',{type:'OfferTrade',player:'A',give:{wood:1},receive:{brick:1}},/another player/);
reject(g,'A',{type:'OfferTrade',player:'outsider',give:{wood:1},receive:{brick:1}},/another player/);
reject(g,'outsider',{type:'BankTrade',give:'wood',receive:'brick'},/not playing/);
reject(g,'A',{type:'OfferTrade',player:'B',give:{wood:1},receive:{wood:2}},/both sides/);
reject(g,'A',{type:'OfferTrade',player:'B',give:{wood:19},receive:{brick:1}},/do not have/);
// Changing or spending offered cards never permits an underfunded transfer.
g=fixture();act(g,'A',{type:'OfferTrade',player:'B',give:{wood:6},receive:{brick:1}});const first=g.tradeOffer.id;
act(g,'A',{type:'BankTrade',give:'wood',receive:'ore'});reject(g,'B',{type:'AcceptTrade',offerId:first},/cannot be completed/);
act(g,'A',{type:'OfferTrade',player:'B',give:{wood:1},receive:{brick:1}});assert(g.tradeOffer.id>first);reject(g,'B',{type:'AcceptTrade',offerId:first},/no longer/);
const second=g.tradeOffer.id;reject(g,'B',{type:'CancelTrade',offerId:second},/another player/);act(g,'A',{type:'CancelTrade',offerId:second});assert.equal(g.tradeOffer,null);
act(g,'A',{type:'OfferTrade',player:'C',give:{wood:1},receive:{brick:1}});reject(g,'C',{type:'AcceptTrade',offerId:g.tradeOffer.id},/cannot be completed/);act(g,'C',{type:'DeclineTrade',offerId:g.tradeOffer.id});assert.equal(g.tradeOffer,null);assert.equal(g.tradeDecline.declinedBy,'C');assert.deepEqual(g.tradeDecline.give,{wood:1});
act(g,'A',{type:'OfferTrade',player:'B',give:{wood:1},receive:{brick:1}});assert.equal(g.tradeDecline,null);const expired=g.tradeOffer.id;act(g,'A',{type:'EndTurn'});assert.equal(g.tradeDecline,null);assert.equal(g.tradeOffer,null);reject(g,'B',{type:'AcceptTrade',offerId:expired},/Trade only/);
for(const phase of ['roll','discard','robber','steal','settlement','road']){g=fixture();g.phase=phase;reject(g,'A',{type:'BankTrade',give:'wood',receive:'brick'},/Trade only/);reject(g,'A',{type:'OfferTrade',player:'B',give:{wood:1},receive:{brick:1}},/Trade only/);}
console.log('PASS: bank/player trade conservation, atomic rejection, turn/phase ownership, malformed amounts, stale/replayed offers, replacement/cancel/decline/expiry, acceptance affordability');

{const g=fixture();turns.act(g,tiles,'A',{type:'OfferTrade',player:'all',give:{wood:1},receive:{brick:1}},undefined,undefined,['A','B']);assert.deepEqual(g.tradeOffer.recipients,['B']);reject(g,'C',{type:'DeclineTrade',offerId:g.tradeOffer.id},/no longer/);}
g=fixture();g.resources.C.brick=2;g.bank.brick-=2;
act(g,'A',{type:'OfferTrade',player:'all',give:{wood:1},receive:{brick:1}});let pending=g.tradeOffer.id;
reject(g,'A',{type:'ConfirmTrade',offerId:pending,player:'C'},/accepted/);
const consentHands=JSON.stringify(g.resources);act(g,'B',{type:'AcceptTrade',offerId:pending});act(g,'C',{type:'AcceptTrade',offerId:pending});assert.equal(JSON.stringify(g.resources),consentHands);assert.deepEqual(trading.confirmable(g,'A'),['B','C']);assert.deepEqual(trading.confirmable(g,'B'),[]);
reject(g,'B',{type:'AcceptTrade',offerId:pending},/already accepted/);
const unchosen={...g.resources.B};act(g,'A',{type:'ConfirmTrade',offerId:pending,player:'C'});assert.deepEqual(g.resources.B,unchosen);assert.equal(g.resources.C.wood,1);assert.equal(g.resources.A.brick,1);
reject(g,'A',{type:'ConfirmTrade',offerId:pending,player:'B'},/accepted/);
g=fixture();act(g,'A',{type:'OfferTrade',player:'B',give:{wood:6},receive:{brick:1}});pending=g.tradeOffer.id;act(g,'B',{type:'AcceptTrade',offerId:pending});act(g,'A',{type:'BankTrade',give:'wood',receive:'ore'});reject(g,'A',{type:'ConfirmTrade',offerId:pending,player:'B'},/cannot be completed/);
g=fixture();act(g,'A',{type:'OfferTrade',player:'all',give:{wood:1},receive:{brick:1}});pending=g.tradeOffer.id;act(g,'B',{type:'AcceptTrade',offerId:pending});act(g,'B',{type:'DeclineTrade',offerId:pending});assert.equal(g.tradeOffer.responses.B,'declined');assert.deepEqual(trading.confirmable(g,'A'),[]);reject(g,'A',{type:'ConfirmTrade',offerId:pending,player:'B'},/accepted/);
g=fixture();act(g,'A',{type:'OfferTrade',player:'all',give:{wood:1},receive:{brick:1}});assert.equal(trading.botResponse(g,'B'),'AcceptTrade');assert.equal(trading.botResponse(g,'C'),'DeclineTrade');
const decision=trading.botResponse(g,'B');g.resources.C.wood=15;assert.equal(trading.botResponse(g,'B'),decision,'Bot policy does not inspect another player hand');
g.tradeOffer.receive.brick=2;assert.equal(trading.botResponse(g,'B'),'DeclineTrade','Bot rejects losing cards on a bad offer');
console.log('PASS: multiple consents without transfer, trader-selected partner, unchosen hands, final affordability/replay checks, and own-hand bot decisions');
