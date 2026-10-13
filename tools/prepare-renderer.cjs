const fs=require('fs'),path=require('path');
const {createHash}=require('crypto');
(async()=>{
  const {parse}=await import('../.rea-tools/node_modules/@babel/parser/lib/index.js');
  const root=path.resolve(__dirname,'../research'), factories=new Map();
  function walk(node,visit){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(n=>walk(n,visit));return;}visit(node);for(const [k,v] of Object.entries(node))if(!['loc','extra','comments','tokens'].includes(k))walk(v,visit);}
  const files=fs.readdirSync(root).filter(f=>f.endsWith('.js')).sort((a,b)=>Number(a.startsWith('web.'))-Number(b.startsWith('web.')));
  for(const file of files){
    const code=fs.readFileSync(path.join(root,file),'utf8'),ast=parse(code,{sourceType:'unambiguous'}),sha256=createHash('sha256').update(code).digest('hex');
    walk(ast,node=>{
      if(node.type!=='ObjectExpression'||!node.properties.length||!node.properties.every(p=>p.type==='ObjectProperty'&&p.key.type==='NumericLiteral'&&['ArrowFunctionExpression','FunctionExpression'].includes(p.value.type)))return;
      for(const p of node.properties)factories.set(p.key.value,{source:code.slice(p.value.start,p.value.end),file,start:p.value.start,end:p.value.end,sha256});
    });
  }
  const output=path.resolve(__dirname,'../.rea-tools/renderer');fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'factories.js'),'globalThis.labFactories={\n'+[...factories].map(([id,v])=>`${id}:${v.source}`).join(',\n')+'\n};\n');
  fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify([...factories].map(([id,{file,start,end,sha256}])=>({id,file,start,end,sha256,rangeUnit:'UTF-16 code units'})),null,2));
  console.log(`Prepared ${factories.size} local factory candidates; bundle startup omitted.`);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
