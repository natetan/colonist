const fs=require('fs'),path=require('path');
(async()=>{
const {parse}=await import('../.rea-tools/node_modules/@babel/parser/lib/index.js');
const root=path.resolve(__dirname,'../research');
const modules=new Map();
function walk(node,visit) {
  if(!node || typeof node!=='object') return;
  if(Array.isArray(node)) { for(const item of node) walk(item,visit); return; }
  if(typeof node.type==='string') visit(node);
  for(const [key,value] of Object.entries(node)) if(!['loc','start','end','extra','comments','tokens'].includes(key)) walk(value,visit);
}
for(const file of fs.readdirSync(root).filter(name=>name.endsWith('.js'))) {
  const source=fs.readFileSync(path.join(root,file),'utf8');
  const ast=parse(source,{sourceType:'unambiguous'});
  walk(ast,node=>{
    if(node.type!=='ObjectProperty' || node.key.type!=='NumericLiteral' || !['ArrowFunctionExpression','FunctionExpression'].includes(node.value.type)) return;
    const id=node.key.value, factory=node.value, loader=factory.params[2]?.name;
    if(!loader) return;
    const imports=new Set(),chunks=new Set();let dynamic=0;
    walk(factory.body,child=>{
      if(child.type!=='CallExpression') return;
      if(child.callee.type==='Identifier' && child.callee.name===loader) {
        const arg=child.arguments[0];
        if(arg?.type==='NumericLiteral') imports.add(arg.value);else dynamic++;
      }
      if(child.callee.type==='MemberExpression' && child.callee.object.name===loader && child.callee.property.name==='e') {
        const arg=child.arguments[0];if(arg?.type==='NumericLiteral') chunks.add(arg.value);else dynamic++;
      }
    });
    const previous=modules.get(id);
    modules.set(id,{id,files:[...(previous?.files||[]),file],imports:[...new Set([...(previous?.imports||[]),...imports])],lazyChunks:[...new Set([...(previous?.lazyChunks||[]),...chunks])],dynamicLoaderCalls:(previous?.dynamicLoaderCalls||0)+dynamic});
  });
}
const seeds=[68736,584];
const visited=new Set(),missing=new Set(),pending=[...seeds];
while(pending.length) {
  const id=pending.pop();if(visited.has(id)) continue;visited.add(id);
  const entry=modules.get(id);if(!entry){missing.add(id);continue;}pending.push(...entry.imports);
}
const selected=[...visited].filter(id=>modules.has(id)).map(id=>modules.get(id));
const report={seeds,inventoriedFactories:modules.size,literalDependencyFactories:selected.length,missingLiteralImports:[...missing].sort((a,b)=>a-b),lazyChunkRequests:[...new Set(selected.flatMap(item=>item.lazyChunks))].sort((a,b)=>a-b),dynamicLoaderCalls:selected.reduce((sum,item)=>sum+item.dynamicLoaderCalls,0),limitations:['Static literal imports include conditionally guarded code; reachability is not execution.','Bound imports, shadowed loader names, runtime globals, assets, and dynamic loads are not resolved.','No original bundle or factory was executed.'],modules:selected};
const output=path.resolve(__dirname,'../.rea-tools/renderer-dependencies.json');
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,modules:undefined,output},null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
