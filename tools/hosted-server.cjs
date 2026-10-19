const fs=require('fs'),path=require('path');
const {startRendererLab}=require('./renderer-server.cjs');
function readConfig(filename){
  if(!filename)throw new Error('Set SETTLERS_CONFIG to an absolute configuration filename');
  if(!path.isAbsolute(filename))throw new Error('SETTLERS_CONFIG must be absolute');
  const config=JSON.parse(fs.readFileSync(filename,'utf8'));
  const url=new URL(config.publicOrigin);
  if(url.protocol!=='https:'||url.origin!==config.publicOrigin)throw new Error('publicOrigin must be an exact HTTPS origin without a trailing slash');
  if(!path.isAbsolute(config.saveFile))throw new Error('saveFile must be absolute');
  if(!Number.isInteger(config.port)||config.port<1024||config.port>65535)throw new Error('port must be between 1024 and 65535');
  return config;
}
async function main(){
  const config=readConfig(process.env.SETTLERS_CONFIG);
  const server=await startRendererLab(config.port,{saveFile:config.saveFile,allowedOrigins:[config.publicOrigin],botDelayMs:1100});
  console.log('Private Settlers listening on loopback port '+server.address().port);
  let stopping=false;
  const stop=()=>{if(stopping)return;stopping=true;server.closeLab().then(()=>process.exit(0));};
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={readConfig};
