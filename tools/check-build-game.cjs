const fs = require('fs');
// Partial observed contract, not a complete Colonist schema.
const objects = ['gameState', 'gameSettings', 'gameDetails', 'gameState.currentState', 'gameState.diceState', 'gameState.mapState', 'gameState.bankState', 'gameState.playerStates', 'gameState.tradeState'];
function inspectBuildGame(payload) {
  const issues = [];
  const get = path => path.split('.').reduce((value, key) => value && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined, payload);
  for (const path of objects) {
    const value = get(path);
    if (!value || typeof value !== 'object' || Array.isArray(value)) issues.push(`${path}: expected object`);
  }
  for (const path of ['playerUserStates', 'playOrder']) if (!Array.isArray(get(path))) issues.push(`${path}: expected array`);
  for (const path of ['playerColor', 'gameSettings.modeSetting']) if (!Number.isInteger(get(path))) issues.push(`${path}: expected integer`);
  if (!Number.isFinite(get('timeLeftInState'))) issues.push('timeLeftInState: expected finite number');
  for (const path of ['gameDetails.isRanked', 'gameDetails.isDiscord']) if (typeof get(path) !== 'boolean') issues.push(`${path}: expected boolean`);
  const users = get('playerUserStates');
  const players = get('gameState.playerStates');
  if (Array.isArray(users)) {
    const colors = new Set();
    for (const user of users) {
      if (!user || !Number.isInteger(user.selectedColor)) { issues.push('playerUserStates: missing integer selectedColor'); continue; }
      if (colors.has(user.selectedColor)) issues.push(`playerUserStates: duplicate color ${user.selectedColor}`);
      colors.add(user.selectedColor);
    }
    if (players && typeof players === 'object') for (const [color, state] of Object.entries(players)) {
      if (state != null && !colors.has(Number(color))) issues.push(`playerStates.${color}: no matching user`);
    }
    if (Array.isArray(get('playOrder'))) for (const color of get('playOrder')) if (!colors.has(color)) issues.push(`playOrder: unmatched color ${color}`);
  }
  return { observedChecksPassed: issues.length === 0, renderCompatibility: 'unverified', issues };
}
if (require.main === module) {
  try {
    if (!process.argv[2]) throw new Error('Usage: npm run inspect:build-game -- <local-payload.json>');
    const result = inspectBuildGame(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
    console.log(JSON.stringify(result, null, 2));
    if (!result.observedChecksPassed) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { inspectBuildGame };
