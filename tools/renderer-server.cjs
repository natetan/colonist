const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../.rea-tools/renderer');
const routes={
  '/':path.join(__dirname,'renderer-lab.html'),
  '/lab.js':path.join(__dirname,'renderer-lab.js'),
  '/factories.js':path.join(root,'factories.js'),
  '/fixture.json':path.resolve(__dirname,'../.rea-tools/board-preview-fixture.json'),
};
function startRendererLab(port=3002){
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  let file=routes[pathname];
  if(/^\/assets\/[a-zA-Z0-9_.-]+$/.test(pathname))file=path.join(root,pathname.slice(1));
  // No remote connections, images, frames, or scripts are permitted.
  // Pixi 7 generates shader helpers; eval is allowed only in this local lab.
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'self'; img-src 'self' data: blob:; style-src 'unsafe-inline'; worker-src 'none'; frame-src 'none'");
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!file||!fs.existsSync(file)){res.writeHead(404);return res.end('Local resource unavailable');}
  const mime={'.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.html':'text/html'};
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve(server));});
}
if(require.main===module)startRendererLab().then(()=>console.log('Isolated renderer lab: http://127.0.0.1:3002')).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={startRendererLab};
