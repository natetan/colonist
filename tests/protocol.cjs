const assert = require('assert/strict');
const { createActionSequence, encodeDirectEnvelope, decodeDirectEnvelope, GAME_STATE_MESSAGE_ID } = require('../protocol.cjs');

const send = createActionSequence();
assert.deepEqual(send('roll'), { action: 2, payload: true, sequence: 2 });
assert.deepEqual(send('requestSettlement'), { action: 14, payload: true, sequence: 3 });
assert.throws(() => send('confirmSettlement', -1));
assert.deepEqual(send('confirmSettlement', 23), { action: 15, payload: 23, sequence: 4 });
assert.deepEqual(send('confirmRoad', 0), { action: 11, payload: 0, sequence: 5 });
assert.throws(() => send('roll', 1));
assert.throws(() => send('constructor'));
assert.equal(createActionSequence()('endTurn').sequence, 2);
assert.equal(GAME_STATE_MESSAGE_ID, 130);

// Independent MessagePack fixture: {action:2,payload:true,sequence:2}.
// No production capture or codec implementation is implied by this fixture.
const payload = Buffer.from('83a6616374696f6e02a77061796c6f6164c3a873657175656e636502', 'hex');
const packet = encodeDirectEnvelope('game-1', payload);
assert.equal(packet.toString('hex'), '03010667616d652d31' + payload.toString('hex'));
assert.deepEqual(decodeDirectEnvelope(packet), { recipient: 'game-1', encodedPayload: payload });
assert.equal(encodeDirectEnvelope('é', payload)[2], 2);
assert.equal(decodeDirectEnvelope(encodeDirectEnvelope('é', payload)).recipient, 'é');
assert.throws(() => encodeDirectEnvelope('é'.repeat(128), payload));
assert.throws(() => decodeDirectEnvelope(Buffer.from([3, 1, 4, 65])));
assert.throws(() => decodeDirectEnvelope(Buffer.from([3, 1, 1, 255])));
assert.throws(() => decodeDirectEnvelope(Buffer.from([2, 1, 1, 65])));
console.log('Protocol action and byte-fixture checks passed.');
