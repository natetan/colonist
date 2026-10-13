# Private Settlers

Private multiplayer board-game project for local testing, with eventual Azure hosting.

## Current status

Local multiplayer gameplay prototype with initial placement, dice, resource production, building, robber handling, and basic bots. This does not run the downloaded Colonist client. It is not a complete game yet.

## Run locally

Install Node.js (the prototype was tested with Node 16.14), then run:

```powershell
npm install
npm start
```

Open `http://localhost:3000`. Enter your name and create a room. Open a separate browser window, enter a different name, and join using the room code. Both windows show the same server-generated island and player list. Refreshing resumes your seat using a token kept in that tab's session storage. Use a fresh window rather than duplicating a tab, which can copy its session storage.

Run `npm test` for server integration checks. Stop the server with Ctrl+C. Set `$env:PORT = '3001'` before launching to change the port.

The server binds only to loopback for local testing. Rooms support six seats and are kept in memory; restarting the server loses rooms and boards. Fully disconnected rooms expire after ten minutes. No accounts, saved games, trading, development cards, longest road, largest army, victory conditions, harbors, or balanced-number placement are implemented yet. Azure access is not configured.

The prototype uses an original browser UI and JSON WebSocket protocol. Its two initial handshake message names mirror observed client behavior, but this is not a Colonist-compatible replacement server. The downloaded bundles are used for research only and are never served by this app.

## Research

Colonist's publicly delivered homepage and five initial JavaScript bundles are saved in `research/`. These are minified webpack chunks; the initial files may load additional chunks at runtime. No original server source has been recovered.

Run `npm run inspect:client` to regenerate the bundle inventory. No dependencies are required.

Run `npm run inspect:module -- <module-id-or-text>` to locate relevant webpack modules without executing the bundles. See `research/architecture.md` for the startup and socket findings.

Run `npm run test:protocol` for isolated action sequencing, MessagePack byte fixtures, binary framing, and state-diff checks. `protocol.cjs` has no socket connection and is not integrated into gameplay. Its pinned MessagePack codec matches the local fixture; production compatibility remains unverified. See `research/game-action-protocol.md` for evidence and unresolved compatibility requirements.

## Initial findings

`npm run inspect:renderer` uses the parser installed with local REA to audit literal dependency candidates for the game controller and web map renderer, without executing bundles. It writes ignored `.rea-tools/renderer-dependencies.json`. Conditional imports, duplicate bundle variants, shadowed identifiers, and numeric-property factory lookalikes can overestimate dependencies; this is a navigation report, not proof that every listed module is required.

`npm run fixture:preview` generates `.rea-tools/board-preview-fixture.json` using the observed special board-preview configuration. `npm run test:preview` checks configuration construction and MessagePack round trips. This fixture uses synthetic land and local identifiers, has no full gameplay mechanics, and has not been tested in the original renderer. The general BuildGame checker can report identity mismatches for this special preview's synthetic player record.

`npm run test:protocol-map` verifies the independently implemented axial geometry in `protocol-map.cjs`: shared corners/edges, edge endpoints, and 19-hex island counts. This supplies experimental geometry only; it is not integrated into gameplay or a complete original-client map payload.

`npm run fixture:map` writes an original synthetic land-map fixture to ignored `.rea-tools/land-map-fixture.json`. The serializer emits observed map collection and entry fields and is tested through MessagePack. The fixture has no harbors or sea, uses diagnostic resource/number assignments, and cannot launch the original UI by itself.

`npm run inspect:build-game -- <local-payload.json>` checks a partial observed BuildGame contract and reports missing fields or inconsistent player colors. `npm run test:build-game` verifies that checker. Passing these checks does not establish render compatibility; nested mechanic and map schemas remain under investigation. Keep captured or downloaded third-party payloads local and ignored.

`npm run protocol:lab` starts a separate synthetic WebSocket fixture on `127.0.0.1:3001`; stop it with Ctrl+C. Set `PROTOCOL_LAB_PORT` to change its port. Run `npm run test:protocol-lab` to verify a local JSON handshake followed by binary events, an action, and a diff response. This diagnostic harness does not serve the original UI, validate gameplay, or provide a complete initial board. Continue using `npm start` for the playable prototype.

The shared bundle contains game-state models, move validators, development-card restrictions, and handlers for applying state diffs. The shared web bundle initializes a game socket. These findings support further client analysis but do not establish that the complete game engine or server is present.

## Implementation milestones

1. Map the client entry point, lazy-loaded game modules, socket transport, and state/action schemas.
2. Determine whether adapting the existing client to a replacement local server is practical. Record missing server behavior explicitly.
3. Deliver a local room lobby and rendered board, then placement, turns, production, building, robber, trading, development cards, and scoring.
4. Add hidden-information filtering, persistence, reconnects, and complete-game checks.
5. Package a one-command Docker launch for local use and Azure.

Target the standard four-player game first. Five/six-player and larger matches remain to be scoped; the expected user group is up to ten people, usually four or five.

## Initial placement

The host sees Start game, enabled with at least two online players. Offline seats are excluded from the placement order. When alone, use Solo placement test to place both settlement/road pairs yourself (no bots). Players take turns placing a settlement on a white corner, then a road on an adjacent white edge. The second round runs in reverse order and grants starting resources from the second settlement. Other players cannot place during your turn; reconnect restores match state. New players cannot join after start. Regular turns begin automatically after placement. Refresh both tabs after updating the app; restarting the server requires creating a new room.

## Playing alone with bots

Create a room and click **Start with bots** on the host's tab. The server fills the active match to four players: one human gets three bots, two humans get two, and three humans get one. Offline lobby seats do not count. This option supports at most four online humans; use Start game for larger human groups.

Place your settlement and adjacent road. Computer players automatically take their placement turns using the same server validation as humans, then return control for your second settlement/road pair. Bots favor corners with higher expected resource production and pick a legal adjacent road. They do not control your seat or replace disconnected humans. Their hands remain private.

Bots also roll, discard when required, move the robber, steal, build affordable pieces, and end their regular turns automatically. They prefer cities, then settlements, then roads; this is basic legal behavior rather than strong strategy. Solo placement test remains available as a manual debugging shortcut and now continues into one-player regular turns.

## Regular turns

After setup, click **Roll dice**. The server rolls two dice and distributes resources from matching tiles, except the tile occupied by the robber. Cities produce two resources; settlements produce one. The bank starts with 19 of each resource, and building returns spent cards to it.

Choose a build button and click a white location marker. Buttons are disabled when you cannot afford the piece or have no legal location. Roads must connect to your network without passing through an opponent's settlement. Settlements obey the distance rule and must touch your road. Cities upgrade your own settlements. Piece limits are 15 roads, 5 settlements, and 4 cities. Colored squares are placeholder cities; the black circle is the robber.

On a seven, players with more than seven cards must choose and discard half, rounded down. When all discards are complete, the current player moves the robber to a different tile and chooses an eligible adjacent opponent to steal a random resource from. Bot discards and robber actions happen automatically; required human discards pause the game until submitted.

Click **End turn** to advance. Your cards remain private; displayed points currently count settlements and cities only. There is no winner detection yet. Trading and development cards are the next rule milestones.
