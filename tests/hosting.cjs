const assert=require('assert/strict'),http=require('http'),fs=require('fs'),os=require('os'),path=require('path');
const {WebSocket}=require('ws');
const {startRendererLab}=require('../tools/renderer-server.cjs');
const {readConfig}=require('../tools/hosted-server.cjs');
const {build}=require('../tools/package-windows.cjs');
function handshake(port,origin){return new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/socket`,{origin});ws.on('open',()=>{ws.close();resolve(101);});ws.on('unexpected-response',(_,res)=>{res.resume();resolve(res.statusCode);});ws.on('error',reject);});}
(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'settlers-host-'));
 const file=path.join(temp,'host.json');
 try{
  const config={publicOrigin:'https://game.example.com',port:3002,saveFile:path.join(temp,'games.json')};
  fs.writeFileSync(file,JSON.stringify(config));assert.deepEqual(readConfig(file),config);
  for(const publicOrigin of ['https://game.example.com/','http://game.example.com','https://game.example.com/path']){
   fs.writeFileSync(file,JSON.stringify({...config,publicOrigin}));assert.throws(()=>readConfig(file));
  }
  const server=await startRendererLab(0,{allowedOrigins:[config.publicOrigin]});
  try{
   const port=server.address().port;
   assert.equal(await handshake(port,config.publicOrigin),101);
   assert.equal(await handshake(port,'https://game.example.com.evil.example'),403);
   assert.equal(await handshake(port,'https://other.example'),403);
   assert.equal(await handshake(port,undefined),403);
   const get=url=>new Promise((resolve,reject)=>http.get(`http://127.0.0.1:${port}${url}`,res=>{let body='';res.on('data',b=>body+=b);res.on('end',()=>resolve({status:res.statusCode,body}));}).on('error',reject));
   const health=await get('/healthz');assert.equal(health.status,200);assert.deepEqual(JSON.parse(health.body),{ok:true});
   assert.equal((await get('/assets/practice.js')).status,404);
  }finally{await server.closeLab();}
  const output=path.resolve('dist','hosting-test-'+Date.now());
  const result=build(output);assert(result.files>50);
  const manifest=JSON.parse(fs.readFileSync(path.join(output,'manifest.sha256.json')));
  assert(Object.keys(manifest).every(f=>!f.startsWith('data/')&&!f.startsWith('research/')&&!f.includes('practice')));
  for(const name of ['natac-logo.svg','natac-icon.png','favicon.ico','apple-touch-icon.png'])assert(manifest['public/branding/'+name],'Branding must ship with the release');
  assert(manifest['tools/hosted-server.cjs']);assert(manifest['.rea-tools/renderer/factories.js']);
  console.log('PASS: exact HTTPS origins, rejected foreign/missing origins, health, config validation, private deployment allowlist');
  console.log('Private test package: '+output);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
