// Build a private deployment directory. Downloaded runtime assets remain ignored.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
function build(output){
  output=path.resolve(output);
  const dist=path.join(root,'dist')+path.sep;
  if(!output.startsWith(dist)||fs.existsSync(output))throw new Error('Choose a new directory inside dist');
  const files=['package.json','package-lock.json',
    ...fs.readdirSync(root).filter(f=>f.endsWith('.cjs')),
    ...['renderer-server.cjs','renderer-state.cjs','preview-fixture.cjs','hosted-server.cjs','renderer-lab.html','renderer-lab.js','renderer-menu.js','renderer-lab.css'].map(f=>'tools/'+f),
    ...['scoring.js','development.js','development-cards.json','trading.js','trading.css','audio/dice-roll-sound.mp3','branding/natac-logo.svg','branding/natac-icon.png','branding/favicon.ico','branding/apple-touch-icon.png'].map(f=>'public/'+f),
    '.rea-tools/renderer/factories.js'];
  const assetRoot=path.join(root,'.rea-tools/renderer/assets');
  files.push(...fs.readdirSync(assetRoot).filter(f=>/^[a-zA-Z0-9_-]+\.[a-f0-9]{16,}\.(json|png|webp|svg|woff|woff2)$/.test(f)).map(f=>'.rea-tools/renderer/assets/'+f));
  for(const name of files)if(!fs.statSync(path.join(root,name)).isFile())throw new Error('Missing '+name);
  fs.mkdirSync(output,{recursive:true});
  const manifest={};
  for(const name of files){const bytes=fs.readFileSync(path.join(root,name)),target=path.join(output,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);manifest[name]=crypto.createHash('sha256').update(bytes).digest('hex');}
  fs.writeFileSync(path.join(output,'manifest.sha256.json'),JSON.stringify(manifest,null,2)+'\n');
  return {output,files:files.length};
}
if(require.main===module)console.log(build(process.argv[2]||path.join(root,'dist','windows-'+Date.now())));
module.exports={build};
