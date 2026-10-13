const http = require('http');
const { WebSocketServer } = require('ws');
const { encode } = require('@msgpack/msgpack');
const { decodeActionPacket, GAME_STATE_MESSAGE_ID } = require('../protocol.cjs');

// Synthetic transport fixture, not a server capable of running the original UI.
function startLab(port = 0) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Local protocol lab: synthetic fixtures only.\n');
  });
  const sockets = new WebSocketServer({ server });
  sockets.on('connection', socket => {
    socket.send(JSON.stringify({ type: 'Connected', userSessionId: 'local-lab-session' }));
    socket.send(JSON.stringify({ type: 'SessionEstablished' }));
    let sequence = 0;
    const event = (type, payload) => socket.send(encode({ id: GAME_STATE_MESSAGE_ID, data: { sequence: ++sequence, type, payload } }));
    event(1, { serverId: 'local-lab', databaseGameId: 'fixture', gameSettingId: 'fixture', reconnectToken: 'local-only', shouldResetGameClient: false, isReconnectingSession: false });
    // Diagnostic state, deliberately not presented as a complete BuildGame schema.
    event(91, { diff: { currentState: { fixture: true } }, timeLeftInState: 60 });
    socket.on('message', (bytes, binary) => {
      try {
        if (!binary) throw new Error('Binary command required');
        const command = decodeActionPacket(bytes);
        if (command.recipient !== 'local-lab') throw new Error('Wrong recipient');
        const action = command.action;
        if (!action || !Number.isSafeInteger(action.action) || !Number.isSafeInteger(action.sequence)) throw new Error('Invalid command');
        event(91, { diff: { currentState: { lastFixtureAction: action.action } }, timeLeftInState: 60 });
      } catch {
        socket.close(1008, 'Invalid fixture command');
      }
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({
      port: server.address().port,
      close: () => new Promise(done => { for (const socket of sockets.clients) socket.terminate(); sockets.close(() => server.close(done)); }),
    }));
  });
}

if (require.main === module) startLab(Number(process.env.PROTOCOL_LAB_PORT || 3001)).then(lab => {
  console.log(`Synthetic protocol lab: ws://127.0.0.1:${lab.port}`);
  process.once('SIGINT', () => lab.close().then(() => process.exit(0)));
}).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { startLab };
