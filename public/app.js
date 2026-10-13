const $ = id => document.getElementById(id);
const colors = { wood: '#367b55', sheep: '#8bae58', wheat: '#dbb252', brick: '#bb6d48', ore: '#829099', desert: '#cfbd8b' };
const params = new URLSearchParams(location.search);
$('code').value = params.get('room') || '';
let socket, retry, joined;
const savedKey = 'private-settlers-session';
function draw(tiles) {
  $('board').replaceChildren();
  for (const tile of tiles) {
    const x = 78 * Math.sqrt(3) * (tile.q + tile.r / 2), y = 117 * tile.r;
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', Array.from({ length: 6 }, (_, i) => { const angle = (60 * i - 30) * Math.PI / 180; return `${x + 74 * Math.cos(angle)},${y + 74 * Math.sin(angle)}`; }).join(' '));
    polygon.setAttribute('fill', colors[tile.resource]); polygon.setAttribute('stroke', '#163443'); polygon.setAttribute('stroke-width', '3'); $('board').append(polygon);
    for (const [text, offset, size] of [[tile.resource, -12, 14], [tile.number || 'Robber', 17, 23]]) {
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text'); label.setAttribute('x', x); label.setAttribute('y', y + offset); label.setAttribute('text-anchor', 'middle'); label.setAttribute('fill', '#fff'); label.setAttribute('font-size', size); label.textContent = text; $('board').append(label);
    }
  }
}
function connect() {
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/socket`);
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.type === 'SessionEstablished') {
      $('connection').textContent = 'Connected to your local server'; $('create').disabled = $('join').disabled = false;
      let saved; try { saved = JSON.parse(sessionStorage.getItem(savedKey)); } catch {}
      if (saved) socket.send(JSON.stringify({ type: 'Resume', ...saved }));
    }
    if (message.type === 'Joined') { joined = message; sessionStorage.setItem(savedKey, JSON.stringify({ code: message.code, token: message.token })); $('error').textContent = ''; }
    if (message.type === 'RoomState') {
      $('lobby').hidden = true; $('room').hidden = false; $('room-code').textContent = message.code;
      $('players').replaceChildren(...message.players.map(player => { const li = document.createElement('li'); li.textContent = `${player.name}${player.id === message.host ? ' · Host' : ''}${player.online ? '' : ' · Offline'}`; return li; }));
      draw(message.board); $('hint').textContent = 'Everyone in this room sees the same island.';
    }
    if (message.type === 'Error') {
      $('error').textContent = message.message;
      if (message.message.startsWith('Saved session')) { sessionStorage.removeItem(savedKey); joined = null; $('lobby').hidden = false; $('room').hidden = true; }
    }
  };
  socket.onclose = () => { $('connection').textContent = 'Disconnected. Reconnecting…'; $('create').disabled = $('join').disabled = true; clearTimeout(retry); retry = setTimeout(connect, 1500); };
  socket.onerror = () => { $('connection').textContent = 'Unable to reach the local server.'; };
}
for (const [id, type] of [['create', 'CreateRoom'], ['join', 'JoinRoom']]) $(id).onclick = () => { $('error').textContent = ''; socket.send(JSON.stringify({ type, name: $('name').value, code: $('code').value })); };
$('copy').onclick = async () => { try { await navigator.clipboard.writeText(`${location.origin}/?room=${joined.code}`); $('copy').textContent = 'Copied!'; } catch { $('error').textContent = `Room code: ${joined.code}`; } };
connect();
