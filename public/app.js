const $ = id => document.getElementById(id);
const colors = { wood: '#367b55', sheep: '#8bae58', wheat: '#dbb252', brick: '#bb6d48', ore: '#829099', desert: '#cfbd8b' };
const params = new URLSearchParams(location.search);
$('code').value = params.get('room') || '';
let socket, retry, joined, roomState;
const savedKey = 'private-settlers-session';
function draw(tiles, game) {
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
  if (!game) return;
  const canAct = socket.readyState === WebSocket.OPEN && game.currentPlayer === joined.playerId;
  function shape(tag, attrs, command, id) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    if (command) {
      element.setAttribute('tabindex', '0'); element.setAttribute('role', 'button'); element.setAttribute('aria-label', `${command === 'PlaceRoad' ? 'Place road on edge' : 'Place settlement on corner'} ${id}`);
      const action = () => { $('error').textContent = ''; socket.send(JSON.stringify({ type: command, id })); };
      element.addEventListener('click', action); element.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); } });
    }
    $('board').append(element);
  }
  for (const edge of game.edges) {
    const a = game.vertices[edge.a], b = game.vertices[edge.b];
    const legal = canAct && game.legalEdges.includes(edge.id);
    if (edge.owner || legal) shape('line', { x1:a.x, y1:a.y, x2:b.x, y2:b.y, stroke:edge.owner ? game.colors[edge.owner] : '#fff', 'stroke-width':edge.owner ? 9 : 8, 'stroke-linecap':'round', class:'piece' }, null, edge.id);
    if (legal) shape('circle', { cx:(a.x+b.x)/2, cy:(a.y+b.y)/2, r:10, fill:'#fff', class:'placement-target' }, 'PlaceRoad', edge.id);
  }
  for (const vertex of game.vertices) {
    const legal = canAct && game.legalVertices.includes(vertex.id);
    if (vertex.owner || legal) shape('circle', { cx:vertex.x, cy:vertex.y, r:vertex.owner ? 11 : 8, fill:vertex.owner ? game.colors[vertex.owner] : '#fff', stroke:'#102a38', 'stroke-width':3, class:legal ? 'placement-target' : 'piece' }, legal ? 'PlaceSettlement' : null, vertex.id);
  }
}
function connect() {
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/socket`);
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.type === 'SessionEstablished') {
      $('connection').textContent = 'Connected to your local server'; $('create').disabled = $('join').disabled = false;
      $('solo').disabled = false;
      $('bots').disabled = false;
      let saved; try { saved = JSON.parse(sessionStorage.getItem(savedKey)); } catch {}
      if (saved) socket.send(JSON.stringify({ type: 'Resume', ...saved }));
    }
    if (message.type === 'Joined') { joined = message; sessionStorage.setItem(savedKey, JSON.stringify({ code: message.code, token: message.token })); $('error').textContent = ''; }
    if (message.type === 'RoomState') {
      roomState = message;
      $('lobby').hidden = true; $('room').hidden = false; $('room-code').textContent = message.code;
      $('players').replaceChildren(...message.players.map(player => { const li = document.createElement('li'); li.textContent = `${player.name}${player.bot ? ' · Computer' : ''}${player.id === message.host ? ' · Host' : ''}${player.online ? '' : ' · Offline'}`; return li; }));
      const host = message.host === joined.playerId;
      $('start').hidden = !!message.game || !host; $('solo').hidden = !!message.game || !host || message.players.filter(p => p.online).length !== 1;
      $('start').disabled = message.players.filter(p => p.online).length < 2;
      $('bots').hidden = !!message.game || !host;
      $('bots').disabled = message.players.filter(p => p.online && !p.bot).length > 4;
      $('resources').textContent = message.game && message.game.resources ? 'Your resources: ' + Object.entries(message.game.resources).map(([name,count]) => `${name} ${count}`).join(' · ') : '';
      draw(message.board, message.game);
      const g = message.game, current = g && message.players.find(p => p.id === g.currentPlayer);
      $('hint').textContent = !g ? (host ? 'Start with bots to fill four seats, or Start game with your online friends.' : 'Waiting for the host to start.') : g.phase === 'complete' ? 'Initial placement complete! Dice and regular turns are the next milestone.' : `${current.name}${current.id === joined.playerId ? ' (you)' : ''}: place a ${g.phase}${current.online ? '' : ' · waiting for reconnect'}. ${current.bot ? 'Computer is placing automatically.' : 'Click a white ' + (g.phase === 'road' ? 'edge' : 'corner') + '.'}`;
    }
    if (message.type === 'Error') {
      $('error').textContent = message.message;
      if (message.message.startsWith('Saved session')) { sessionStorage.removeItem(savedKey); joined = null; $('lobby').hidden = false; $('room').hidden = true; }
    }
  };
  socket.onclose = () => { $('connection').textContent = 'Disconnected. Reconnecting…'; $('create').disabled = $('join').disabled = $('start').disabled = $('solo').disabled = $('bots').disabled = true; clearTimeout(retry); retry = setTimeout(connect, 1500); };
  socket.onerror = () => { $('connection').textContent = 'Unable to reach the local server.'; };
}
for (const [id, type] of [['create', 'CreateRoom'], ['join', 'JoinRoom']]) $(id).onclick = () => { $('error').textContent = ''; socket.send(JSON.stringify({ type, name: $('name').value, code: $('code').value })); };
$('copy').onclick = async () => { try { await navigator.clipboard.writeText(`${location.origin}/?room=${joined.code}`); $('copy').textContent = 'Copied!'; } catch { $('error').textContent = `Room code: ${joined.code}`; } };
for (const id of ['start','solo','bots']) $(id).onclick = () => { $('error').textContent = ''; socket.send(JSON.stringify({ type:'StartGame', solo:id === 'solo', bots:id === 'bots' })); };
connect();
