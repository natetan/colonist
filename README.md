# Private Settlers

Private multiplayer board-game project for local testing, with eventual Azure hosting.

## Current status

Local multiplayer gameplay with initial placement, dice, resource production, building, robber handling, bank/player trading, and basic bots. The original UI prototype runs on port 3000; an experimental original Colonist board renderer now presents the same local rules on port 3002. Neither is a complete game yet.

## Run locally

Install Node.js (the prototype was tested with Node 16.14), then run:

```powershell
npm install
npm start
```

Open `http://localhost:3000`. Enter your name and create a room. Open a separate browser window, enter a different name, and join using the room code. Both windows show the same server-generated island and player list. Refreshing resumes your seat using a token kept in that tab's session storage. Use a fresh window rather than duplicating a tab, which can copy its session storage.

Run `npm test` for server integration checks. Stop the server with Ctrl+C. Set `$env:PORT = '3001'` before launching to change the port.

The server binds only to loopback for local testing. Rooms support six seats and are kept in memory; restarting the server loses rooms and boards. Fully disconnected rooms expire after ten minutes. No accounts, saved games, development cards, longest road, largest army, victory conditions, harbors, or balanced-number placement are implemented yet. Azure access is not configured.

The prototype uses an original browser UI and JSON WebSocket protocol. Its two initial handshake message names mirror observed client behavior, but this is not a Colonist-compatible replacement server. `npm start` does not serve downloaded bundles; the separate renderer lab serves locally extracted factories and assets.

## Research

### Local game with the original board renderer

The renderer lab uses our authoritative local server with the downloaded original map renderer and sprite sheets. It displays live roads, settlements, cities, and a locally positioned robber sprite. A tested geometry adapter translates every prototype corner/edge ID into the original map indexes. White markers support mouse and keyboard placement. The local controls cover setup, dice, building, end turn, discarding, stealing, and trading; these use our JSON commands, not the original game's socket protocol. Refresh resumes your seat.

Local adapters supply the canvas host, parsed sprite sheets, animation manager, and disabled session recorder/tooltips. Full original game startup, accounts, original HUD, mechanic dispatch, and complete BuildGame flow remain unimplemented. The viewport is reconstructed for each snapshot while retaining one Pixi canvas, so zoom/pan resets on moves. A local content policy blocks external connections; Pixi shader helpers require eval within this lab.

With the existing downloaded bundles and local REA parser installed, run:

```powershell
npm run prepare:renderer
npm run fetch:renderer-assets
npm run fixture:preview
npm run renderer:lab
```

Open `http://127.0.0.1:3002`, create a room, and choose **Start with bots**, or join friends in another fresh tab on that same port. Place both settlement/road pairs using white markers, then roll dice. When affordable, select a build button to reveal legal locations. The renderer server has its own in-memory rooms; room codes from port 3000 do not carry over. Stop with Ctrl+C; set `$env:RENDERER_LAB_PORT = '3003'` to change its port. Once setup is complete, only `npm run renderer:lab` is needed to launch.

**Run renderer probe** still displays a deliberately synthetic piece gallery including a city; it is not a legal starting position. Preparation extracts module factories without running the web entry point; generated code, source-range/hash manifests, fixtures, and downloaded assets stay ignored in `.rea-tools/`. The asset downloader uses exact public sheet paths referenced by this bundle snapshot. It needs internet access during setup; rendering uses local files.

`npm run test:renderer-state` verifies all geometry mappings, ownership, cities, robber position, and exclusion of private hands. `npm run test:renderer` verifies loopback serving, content policy, MIME/path restrictions, real multiplayer snapshots, bot setup, dice, and reconnect. Browser verification covered human placement, bot updates, roll/end-turn controls, refresh, and the synthetic city gallery. Seven/discard/steal rules are covered by `npm test`; their renderer controls have not all been exercised in the browser.

Colonist's publicly delivered homepage and five initial JavaScript bundles are saved in `research/`. These are minified webpack chunks; the initial files may load additional chunks at runtime. No original server source has been recovered.

Run `npm run inspect:client` to regenerate the bundle inventory. No dependencies are required.

Run `npm run inspect:module -- <module-id-or-text>` to locate relevant webpack modules without executing the bundles. See `research/architecture.md` for the startup and socket findings.

Run `npm run test:protocol` for isolated action sequencing, MessagePack byte fixtures, binary framing, and state-diff checks. `protocol.cjs` has no socket connection and is not integrated into gameplay. Its pinned MessagePack codec matches the local fixture; production compatibility remains unverified. See `research/game-action-protocol.md` for evidence and unresolved compatibility requirements.

## Initial findings

`npm run inspect:renderer` uses the parser installed with local REA to audit literal dependency candidates for the game controller and web map renderer, without executing bundles. It writes ignored `.rea-tools/renderer-dependencies.json`. Conditional imports, duplicate bundle variants, shadowed identifiers, and numeric-property factory lookalikes can overestimate dependencies; this is a navigation report, not proof that every listed module is required.

`npm run fixture:preview` generates `.rea-tools/board-preview-fixture.json` using the observed special board-preview configuration. `npm run test:preview` checks configuration construction and MessagePack round trips. The diagnostic CLI adds a synthetic settlement, city, and road; those sprites and the land board have been tested in the original renderer. This fixture supplies no full gameplay mechanics. The general BuildGame checker can report identity mismatches for this special preview's synthetic player record.

`npm run test:protocol-map` verifies the independently implemented axial geometry in `protocol-map.cjs`: shared corners/edges, edge endpoints, and 19-hex island counts. The renderer presentation adapter now uses this geometry to display local gameplay; it is not a complete original-client gameplay payload.

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

Click **End turn** to advance. Your cards remain private; displayed points currently count settlements and cities only. There is no winner detection yet. Development cards and complete scoring are the next rule milestones.

## Trading

After rolling and resolving the robber, the current player can trade four matching resources for one different resource from the bank. There are no harbor discounts yet. Select **Give 4** and **Receive 1**, then **Trade with bank**; the button is disabled without enough cards or available bank stock.

With another online human in the match, choose **Offer to**, fill **You give** and **You receive**, then **Send trade offer**. Only the current player proposes trades; the named recipient can accept or decline outside their own turn. An offer may include several resource types but cannot put the same resource on both sides. Both sides need positive whole-card amounts. Only one offer is active at a time; a new offer replaces it. The offer is visible to the room, while each full resource hand stays private.

Offers reserve no cards. Acceptance rechecks both hands and transfers all cards atomically, without touching the bank. An underfunded offer is rejected without changing either hand. The proposer can cancel; ending the turn expires the offer. Bots do not negotiate or make bank trades yet. Trades are supported in both local UIs. Refresh preserves an active offer while the server remains running.

`npm run test:trading` verifies conservation, atomic rejection, turn/phase restrictions, malformed counts, replacement, cancellation, decline, replay/expiry, and changed affordability. It also runs under `npm test`. `npm run test:trading-network` exercises acceptance between two actual WebSocket clients, private snapshots, bank transfers, duplicate rejection, and turn expiry. Browser testing verified offering, accepting, declining, cancelling, reconnect, and disabled bank controls; successful bank transfers are verified by the network test.
