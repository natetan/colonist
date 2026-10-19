const crypto=require('crypto'),{topology}=require('./game.cjs');
const resourceBag=Object.freeze(['wood','wood','wood','wood','sheep','sheep','sheep','sheep','wheat','wheat','wheat','wheat','brick','brick','brick','ore','ore','ore','desert']);
const numberBag=Object.freeze([2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12]);
function shuffle(items,random){const a=items.slice();for(let i=a.length-1;i>0;i--){const j=random(i+1);if(!Number.isInteger(j)||j<0||j>i)throw new Error('Invalid server board random draw.');[a[i],a[j]]=[a[j],a[i]];}return a;}
function adjacent(a,b){return Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r))===1;}
function generate(random=crypto.randomInt){
  const bag=shuffle(resourceBag,random),tiles=[];
  for(let r=-2;r<=2;r++)for(let q=Math.max(-2,-r-2);q<=Math.min(2,-r+2);q++)tiles.push({q,r,resource:bag.pop(),number:null});
  const candidates=shuffle(tiles.map((t,i)=>i).filter(i=>tiles[i].resource!=='desert'),random);
  function select(start,chosen){if(chosen.length===4)return chosen;for(let i=start;i<candidates.length;i++){const next=candidates[i];if(chosen.every(other=>!adjacent(tiles[next],tiles[other]))){const result=select(i+1,[...chosen,next]);if(result)return result;}}return null;}
  const reds=select(0,[]);if(!reds)throw new Error('Cannot place separated red numbers.');
  const redNumbers=shuffle([6,6,8,8],random);reds.forEach((id,i)=>tiles[id].number=redNumbers[i]);
  const rest=shuffle(numberBag.filter(n=>n!==6&&n!==8),random);for(const tile of tiles)if(tile.resource!=='desert'&&tile.number===null)tile.number=rest.pop();
  return tiles;
}
function coastline(tiles){
  const g=topology(tiles),edges=g.edges.filter(e=>g.vertices[e.a].tiles.filter(i=>g.vertices[e.b].tiles.includes(i)).length===1);
  if(edges.length!==30)throw new Error('Harbors require the standard 19-hex island.');
  const start=Math.min(...edges.flatMap(e=>[e.a,e.b])),ordered=[];let vertex=start,previous=-1;
  do{const edge=edges.find(e=>e.id!==previous&&(e.a===vertex||e.b===vertex));if(!edge||ordered.includes(edge.id))throw new Error('Invalid coastline.');ordered.push(edge.id);previous=edge.id;vertex=edge.a===vertex?edge.b:edge.a;}while(vertex!==start);
  if(ordered.length!==30)throw new Error('Incomplete coastline.');return ordered;
}
function harbors(tiles,random=crypto.randomInt){
  const coast=coastline(tiles),types=shuffle([null,null,null,null,'wood','brick','sheep','wheat','ore'],random),offset=random(30);
  if(!Number.isInteger(offset)||offset<0||offset>=30)throw new Error('Invalid server harbor random draw.');
  return [0,3,6,10,13,16,20,23,26].map((position,i)=>({edge:coast[(position+offset)%30],resource:types[i]}));
}
function classic(){let seed=104729;const random=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;};const tiles=generate(random);return {board:tiles,harbors:harbors(tiles,random)};}
module.exports={classic,generate,harbors,coastline,adjacent,resourceBag,numberBag};
