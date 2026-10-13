const https=require('https'),fs=require('fs'),path=require('path');
const sheets=['game_spritesheet_0.47fb957cffb1b48762c0.json','game_spritesheet_1.2d5edbf64b4b0e0a8b4b.json','game_spritesheet_2.3a1a30742e6f65df9781.json','game_spritesheet_3.5088f30d6ffa2dc194b4.json','game_spritesheet_4.f589fb2f92cb5c72e3f9.json'];
const root=path.resolve(__dirname,'../.rea-tools/renderer/assets');
function download(name){
  if(!/^[a-zA-Z0-9_.-]+$/.test(name))throw new Error('Invalid referenced asset name');
  return new Promise((resolve,reject)=>{
    const request=https.get('https://cdn.colonist.io/dist/assets/'+name,response=>{
      if(response.statusCode!==200){response.resume();return reject(new Error(`Asset HTTP ${response.statusCode}: ${name}`));}
      const chunks=[];let bytes=0;
      response.on('data',chunk=>{bytes+=chunk.length;if(bytes>32*1024*1024)response.destroy(new Error('Asset size limit exceeded'));else chunks.push(chunk);});
      response.on('error',reject);response.on('end',()=>resolve(Buffer.concat(chunks)));
    });request.setTimeout(20000,()=>request.destroy(new Error('Asset download timed out')));request.on('error',reject);
  });
}
(async()=>{
  fs.mkdirSync(root,{recursive:true});
  for(const name of sheets){
    const json=await download(name),sheet=JSON.parse(json.toString('utf8'));
    if(typeof sheet.meta?.image!=='string')throw new Error('Sheet image missing');
    const image=await download(sheet.meta.image);
    fs.writeFileSync(path.join(root,name),json);fs.writeFileSync(path.join(root,sheet.meta.image),image);
    console.log(`Saved ${name} and its image locally`);
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
