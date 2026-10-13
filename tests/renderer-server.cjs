const assert=require('assert/strict'),http=require('http');
const {startRendererLab}=require('../tools/renderer-server.cjs');
function get(port,url){return new Promise((resolve,reject)=>http.get({hostname:'127.0.0.1',port,path:url},res=>{const data=[];res.on('data',chunk=>data.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(data).toString()}));}).on('error',reject));}
(async()=>{
 const server=await startRendererLab(0);
 try{
  assert.equal(server.address().address,'127.0.0.1');
  const port=server.address().port;
  const page=await get(port,'/');assert.equal(page.status,200);
  assert(page.headers['content-security-policy'].includes("connect-src 'self'"));
  assert(page.headers['content-security-policy'].includes("default-src 'none'"));
  assert.equal(page.headers['x-content-type-options'],'nosniff');
  assert.equal((await get(port,'/assets/../../package.json')).status,404);
  assert.equal((await get(port,'/assets/%2e%2e%2fpackage.json')).status,404);
  const script=await get(port,'/lab.js');assert.equal(script.headers['content-type'],'text/javascript');
  assert.equal((await get(port,'/research/colonist-home.html')).status,404);
  console.log('PASS: loopback renderer routes, CSP, MIME types, traversal rejection');
 }finally{await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
