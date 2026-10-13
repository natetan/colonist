const fs=require('fs'),path=require('path');
const {createApp}=require('../server.cjs');
const {presentBoard}=require('./renderer-state.cjs');
const root=path.resolve(__dirname,'../.rea-tools/renderer');
const routes={
  '/':path.join(__dirname,'renderer-lab.html'),
  '/lab.js':path.join(__dirname,'renderer-lab.js'),
  '/scoring.js':path.resolve(__dirname,'../public/scoring.js'),
  '/development.js':path.resolve(__dirname,'../public/development.js'),
  '/trading.js':path.resolve(__dirname,'../public/trading.js'),
  '/trading.css':path.resolve(__dirname,'../public/trading.css'),
  '/factories.js':path.join(root,'factories.js'),
  '/fixture.json':path.resolve(__dirname,'../.rea-tools/board-preview-fixture.json'),
};
async function startRendererLab(port=3002,options={}){
const app=createApp({saveFile:options.saveFile,random:options.random,developmentRandom:options.developmentRandom,boardFactory:options.boardFactory,boardPresentation:presentBoard,httpHandler:(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  let file=routes[pathname];
  if(/^\/assets\/[a-zA-Z0-9_.-]+$/.test(pathname))file=path.join(root,pathname.slice(1));
  // No remote connections, images, frames, or scripts are permitted.
  // Pixi 7 generates shader helpers; eval is allowed only in this local lab.
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; worker-src 'none'; frame-src 'none'");
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!file||!fs.existsSync(file)){res.writeHead(404);return res.end('Local resource unavailable');}
  const mime={'.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.html':'text/html'};
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}});
const server=app.server;
server.closeLab=app.close;
return new Promise((resolve,reject)=>{server.once('error',error=>app.close().then(()=>reject(error),reject));server.listen(port,'127.0.0.1',()=>resolve(server));});
}
if(require.main===module){
  const saveFile=process.env.SETTLERS_SAVE_FILE==='off'?undefined:process.env.SETTLERS_SAVE_FILE||path.resolve(__dirname,'../data/renderer.json');
  startRendererLab(Number(process.env.RENDERER_LAB_PORT||3002),{saveFile}).then(server=>{
    console.log(`Local rendered game: http://127.0.0.1:${server.address().port}`);
    let stopping=false;const stop=()=>{if(stopping)return;stopping=true;server.closeLab().then(()=>process.exit(0));};process.on('SIGINT',stop);process.on('SIGTERM',stop);
  }).catch(error=>{console.error(error.message);process.exitCode=1;});
}
module.exports={startRendererLab};
