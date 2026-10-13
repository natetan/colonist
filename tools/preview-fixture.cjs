const { serializeLandMap } = require('../protocol-map.cjs');
function previewSettings() {
  return {id:'local-preview',channelId:'local',privateGame:true,minimumKarma:0,eloType:0,modeSetting:0,mapSetting:0,victoryPointsToWin:10,karmaActive:true,cardDiscardLimit:7,maxPlayers:4,gameSpeed:1,botSpeed:1,hideBankCards:false,friendlyRobber:false,diceSetting:0,scenarioSetting:0,extensionSetting:0,gameType:8,playOrderSelectionActive:false};
}
// Independent diagnostic configuration based on the board-preview path.
// This does not supply the mechanics required by the full gameplay UI.
function createPreviewFixture(tiles, settings) {
  if (!settings || typeof settings !== 'object') throw new Error('Resolved settings required');
  return {
    playerColor: 5, playOrder: [5], playerUserStates: [],
    gameDetails: { isRanked:false, isDiscord:false },
    gameSettings: {...settings,gameType:8,eloType:0,extensionSetting:2,scenarioSetting:0,karmaActive:true},
    timeLeftInState:0, isReplay:true,
    gameState: {
      diceState:{diceThrown:false,dice1:1,dice2:1},
      bankState:{hideBankCards:settings.hideBankCards,resourceCards:{}},
      mapState:serializeLandMap(tiles),
      tradeState:{activeOffers:{},closedOffers:{},embargoState:{}},
      playerStates:{0:{color:5,isConnected:true,victoryPointsState:{0:1},bankTradeRatiosState:{0:1},resourceCards:{cards:[]},cardDiscardLimit:5,isTakingAction:false}},
      currentState:{completedTurns:0,turnState:0,actionState:0,currentTurnPlayerColor:0,startTime:0,allocatedTime:0},
      gameLogState:{},gameChatState:{},
    },
  };
}
if(require.main===module) {
  const fs=require('fs'),path=require('path');
  const tiles=[];
  const resources=['wood','brick','sheep','wheat','ore'],numbers=[2,3,4,5,6,8,9,10,11,12];
  for(let q=-2;q<=2;q++) for(let r=-2;r<=2;r++) if(Math.abs(q+r)<=2) tiles.push({q,r,resource:q===0&&r===0?'desert':resources[tiles.length%resources.length],number:numbers[tiles.length%numbers.length]});
  const output=path.resolve(__dirname,'../.rea-tools/board-preview-fixture.json');
  fs.mkdirSync(path.dirname(output),{recursive:true});
  const fixture=createPreviewFixture(tiles,previewSettings());
  // Deliberately synthetic piece gallery, not a legal starting position.
  Object.assign(fixture.gameState.mapState.tileCornerStates[0],{owner:1,buildingType:1});
  Object.assign(fixture.gameState.mapState.tileCornerStates[3],{owner:2,buildingType:2});
  Object.assign(fixture.gameState.mapState.tileEdgeStates[0],{owner:1,type:1});
  fs.writeFileSync(output,JSON.stringify(fixture,null,2)+'\n');
  console.log(`Saved diagnostic preview: ${output}`);
}
module.exports={createPreviewFixture,previewSettings};
