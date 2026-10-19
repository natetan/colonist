const crypto=require('crypto'),{topology}=require('./game.cjs');
const resourceBag=Object.freeze(['wood','wood','wood','wood','sheep','sheep','sheep','sheep','wheat','wheat','wheat','wheat','brick','brick','brick','ore','ore','ore','desert']);
const numberBag=Object.freeze([2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12]);
function shuffle(items,random){const a=items.slice();for(let i=a.length-1;i>0;i--){const j=random(i+1);if(!Number.isInteger(j)||j<0||j>i)throw new Error('Invalid server board random draw.');[a[i],a[j]]=[a[j],a[i]];}return a;}
function adjacent(a,b){return Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r))===1;}
const extendedResources=Object.freeze([...resourceBag,'wood','wood','sheep','sheep','wheat','wheat','brick','brick','ore','ore','desert']);
const extendedNumbers=Object.freeze([...numberBag,2,3,4,5,6,8,9,10,11,12]);
function layout(extended=false){const tiles=[],radius=extended?3:2,upper=2;for(let r=-radius;r<=radius;r++)for(let q=Math.max(-radius,-r-radius);q<=Math.min(upper,-r+upper);q++)tiles.push({q,r});return tiles;}
function generate(random=crypto.randomInt,extended=false){
  const bag=shuffle(extended?extendedResources:resourceBag,random),tiles=layout(extended).map(t=>({...t,resource:bag.pop(),number:null}));
  const candidates=shuffle(tiles.map((t,i)=>i).filter(i=>tiles[i].resource!=='desert'),random);
  function select(start,chosen){if(chosen.length===(extended?6:4))return chosen;for(let i=start;i<candidates.length;i++){const next=candidates[i];if(chosen.every(other=>!adjacent(tiles[next],tiles[other]))){const result=select(i+1,[...chosen,next]);if(result)return result;}}return null;}
  const reds=select(0,[]);if(!reds)throw new Error('Cannot place separated red numbers.');
  const redNumbers=shuffle(extended?[6,6,6,8,8,8]:[6,6,8,8],random);reds.forEach((id,i)=>tiles[id].number=redNumbers[i]);
  const rest=shuffle((extended?extendedNumbers:numberBag).filter(n=>n!==6&&n!==8),random);for(const tile of tiles)if(tile.resource!=='desert'&&tile.number===null)tile.number=rest.pop();
  return tiles;
}
function coastline(tiles){
  const g=topology(tiles),edges=g.edges.filter(e=>g.vertices[e.a].tiles.filter(i=>g.vertices[e.b].tiles.includes(i)).length===1);
  if(![19,30].includes(tiles.length))throw new Error('Unsupported island size.');
  const start=Math.min(...edges.flatMap(e=>[e.a,e.b])),ordered=[];let vertex=start,previous=-1;
  do{const edge=edges.find(e=>e.id!==previous&&(e.a===vertex||e.b===vertex));if(!edge||ordered.includes(edge.id))throw new Error('Invalid coastline.');ordered.push(edge.id);previous=edge.id;vertex=edge.a===vertex?edge.b:edge.a;}while(vertex!==start);
  if(ordered.length!==edges.length)throw new Error('Incomplete coastline.');return ordered;
}
function harbors(tiles,random=crypto.randomInt){
  const coast=coastline(tiles),extended=tiles.length===30,types=shuffle([null,null,null,null,'wood','brick','sheep','wheat','ore',...(extended?[null,'sheep']:[])],random),offset=random(coast.length);
  if(!Number.isInteger(offset)||offset<0||offset>=coast.length)throw new Error('Invalid server harbor random draw.');
  const positions=extended?Array.from({length:11},(_,i)=>Math.floor(i*coast.length/11)):[0,3,6,10,13,16,20,23,26];
  return positions.map((position,i)=>({edge:coast[(position+offset)%coast.length],resource:types[i]}));
}
function classic(extended=false){let seed=104729;const random=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;};const tiles=generate(random,extended);return {board:tiles,harbors:harbors(tiles,random)};}
module.exports={layout,extendedResources,extendedNumbers,classic,generate,harbors,coastline,adjacent,resourceBag,numberBag};
