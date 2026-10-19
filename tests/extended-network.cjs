const {spawnSync}=require('child_process'),path=require('path');
for(const [file,settings]of [
 ['extended-board.cjs',{}],
 ['base-game-network.cjs',{SETTLERS_TEST_PLAYERS:'5',SETTLERS_TEST_SEED:'274',SETTLERS_TEST_BOT_DELAY_MS:'0'}],
 ['base-game-network.cjs',{SETTLERS_TEST_PLAYERS:'6',SETTLERS_TEST_SEED:'91',SETTLERS_TEST_BOT_DELAY_MS:'5'}],
 ['broadcast-trading-network.cjs',{SETTLERS_TEST_TRADE_PLAYERS:'6'}]
]){
 const result=spawnSync(process.execPath,[path.join(__dirname,file)],{env:{...process.env,...settings},stdio:'inherit',timeout:180000});
 if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);
}
