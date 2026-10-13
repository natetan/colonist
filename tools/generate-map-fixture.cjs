const fs=require('fs');
const path=require('path');
const { serializeLandMap }=require('../protocol-map.cjs');
const tiles=[];
const resources=['wood','brick','sheep','wheat','ore'];
for(let q=-2;q<=2;q++) for(let r=-2;r<=2;r++) if(Math.abs(q+r)<=2) {
  tiles.push({q,r,resource:q===0&&r===0?'desert':resources[tiles.length%resources.length],number:6});
}
// Diagnostic island, not a balanced playable board or full BuildGame fixture.
const destination=path.resolve(__dirname,'../.rea-tools/land-map-fixture.json');
fs.mkdirSync(path.dirname(destination),{recursive:true});
fs.writeFileSync(destination,JSON.stringify(serializeLandMap(tiles),null,2)+'\n');
console.log(`Saved synthetic land map: ${destination}`);
