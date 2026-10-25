const {spawnSync}=require('child_process'),path=require('path');
for(const [file,env]of [['jumbo-board.cjs',{}],['jumbo-network.cjs',{}],...['7','8'].map(count=>['base-game-network.cjs',{SETTLERS_TEST_PLAYERS:count,SETTLERS_TEST_MATCH_PRESET:'expanded'}])]){
 const result=spawnSync(process.execPath,[path.join(__dirname,file)],{env:{...process.env,...env},stdio:'inherit',timeout:180000});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);
}
