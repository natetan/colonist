const assert = require('assert/strict');
const { inspectBuildGame } = require('../tools/check-build-game.cjs');
assert.equal(inspectBuildGame({}).observedChecksPassed, false);
const fixture = {
  gameState: Object.fromEntries(['currentState', 'diceState', 'mapState', 'bankState', 'playerStates', 'tradeState'].map(key => [key, {}])),
  gameSettings: { modeSetting: 1 }, gameDetails: { isRanked: false, isDiscord: false, matchmakingMatchType: 0 },
  playerUserStates: [{ selectedColor: 1 }], playOrder: [1], playerColor: 1, timeLeftInState: 60,
};
fixture.gameState.playerStates[1] = {};
assert.deepEqual(inspectBuildGame(fixture), { observedChecksPassed: true, renderCompatibility: 'unverified', issues: [] });
delete fixture.gameDetails.matchmakingMatchType;
assert.equal(inspectBuildGame(fixture).observedChecksPassed, true);
fixture.gameState.playerStates[2] = {};
assert(inspectBuildGame(fixture).issues.includes('playerStates.2: no matching user'));
fixture.playerUserStates.push({ selectedColor: 1 });
assert(inspectBuildGame(fixture).issues.includes('playerUserStates: duplicate color 1'));
fixture.playOrder.push(3);
assert(inspectBuildGame(fixture).issues.includes('playOrder: unmatched color 3'));
console.log('PASS: partial BuildGame contract and identity consistency');
