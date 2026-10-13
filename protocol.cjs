// Independently implemented from static observations documented in research/.
// This module has no network access and is not connected to the game server.
const GAME_ACTION_SUBTYPE = 1;
const GAME_STATE_MESSAGE_ID = 130;
const ACTION = Object.freeze({
  roll: 2, endTurn: 6, requestRoad: 10, confirmRoad: 11,
  requestSettlement: 14, confirmSettlement: 15,
  requestCity: 17, confirmCity: 18,
});

function createActionSequence() {
  let sequence = 1;
  return (name, locationIndex) => {
    if (!Object.hasOwnProperty.call(ACTION, name)) throw new Error('Unknown action');
    const placement = name.startsWith('confirm');
    if (placement && (!Number.isSafeInteger(locationIndex) || locationIndex < 0)) {
      throw new Error('Placement requires a nonnegative map index');
    }
    if (!placement && locationIndex !== undefined) throw new Error('Unexpected payload');
    if (sequence === Number.MAX_SAFE_INTEGER) throw new Error('Sequence exhausted');
    return { action: ACTION[name], payload: placement ? locationIndex : true, sequence: ++sequence };
  };
}

// Accept already encoded payload bytes; codec compatibility is a separate check.
function encodeDirectEnvelope(recipient, encodedPayload) {
  if (typeof recipient !== 'string' || !recipient) throw new Error('Recipient required');
  const address = Buffer.from(recipient, 'utf8');
  if (address.length > 255) throw new Error('Recipient exceeds one-byte length');
  if (!(encodedPayload instanceof Uint8Array)) throw new Error('Encoded payload bytes required');
  return Buffer.concat([Buffer.from([3, GAME_ACTION_SUBTYPE, address.length]), address, Buffer.from(encodedPayload)]);
}

function decodeDirectEnvelope(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new Error('Envelope bytes required');
  const packet = Buffer.from(bytes);
  if (packet.length < 3 || packet[0] !== 3 || packet[1] !== GAME_ACTION_SUBTYPE) throw new Error('Invalid direct game-action header');
  const end = 3 + packet[2];
  if (packet[2] === 0 || packet.length < end) throw new Error('Truncated or empty recipient');
  const address = packet.subarray(3, end);
  const recipient = address.toString('utf8');
  if (!Buffer.from(recipient, 'utf8').equals(address)) throw new Error('Invalid recipient UTF-8');
  return { recipient, encodedPayload: Buffer.from(packet.subarray(end)) };
}

module.exports = { ACTION, GAME_ACTION_SUBTYPE, GAME_STATE_MESSAGE_ID, createActionSequence, encodeDirectEnvelope, decodeDirectEnvelope };
