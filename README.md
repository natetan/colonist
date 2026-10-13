# Private Settlers

Private multiplayer board-game project for local testing, with eventual Azure hosting.

## Current status

Local multiplayer gameplay with initial placement, dice, resource production, building, robber handling, bank/player trading, development cards, scoring, winner detection, and basic bots. The original UI prototype runs on port 3000; an experimental original Colonist board renderer now presents the same local rules on port 3002. Matches can now finish at ten points; harbor trading, saved games, and the full UI remain unfinished.

## Run locally

Install Node.js (the prototype was tested with Node 16.14), then run:

```powershell
npm install
npm start
```

Open `http://localhost:3000`. Enter your name and create a room. Open a separate browser window, enter a different name, and join using the room code. Both windows show the same server-generated island and player list. Refreshing resumes your seat using a token kept in that tab's session storage. Use a fresh window rather than duplicating a tab, which can copy its session storage.

Run `npm test` for server integration checks. Stop the server with Ctrl+C. Set `$env:PORT = '3001'` before launching to change the port.

The server binds only to loopback for local testing. Rooms support six seats and are kept in memory; restarting the server loses rooms and boards. Fully disconnected rooms expire after ten minutes. No accounts, saved games, harbors, or balanced-number placement are implemented yet. Azure access is not configured.

The prototype uses an original browser UI and JSON WebSocket protocol. Its two initial handshake message names mirror observed client behavior, but this is not a Colonist-compatible replacement server. `npm start` does not serve downloaded bundles; the separate renderer lab serves locally extracted factories and assets.

## Research

### Local game with the original board renderer

The renderer lab uses our authoritative local server with the downloaded original map renderer and sprite sheets. It displays live roads, settlements, cities, and a locally positioned robber sprite. A tested geometry adapter translates every prototype corner/edge ID into the original map indexes. White markers support mouse and keyboard placement. The local controls cover setup, dice, building, end turn, discarding, stealing, trading, and development cards; these use our JSON commands, not the original game's socket protocol. Refresh resumes your seat.

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

Bots also buy/play development cards, roll, discard when required, move the robber, steal, build affordable pieces, and end their regular turns automatically. They prefer cities, then settlements, then roads; this is basic legal behavior rather than strong strategy. Solo placement test remains available as a manual debugging shortcut and now continues into one-player regular turns.

## Regular turns

After setup, click **Roll dice**. The server rolls two dice and distributes resources from matching tiles, except the tile occupied by the robber. Cities produce two resources; settlements produce one. The bank starts with 19 of each resource, and building returns spent cards to it.

Choose a build button and click a white location marker. Buttons are disabled when you cannot afford the piece or have no legal location. Roads must connect to your network without passing through an opponent's settlement. Settlements obey the distance rule and must touch your road. Cities upgrade your own settlements. Piece limits are 15 roads, 5 settlements, and 4 cities. Colored squares are placeholder cities; the black circle is the robber.

On a seven, players with more than seven cards must choose and discard half, rounded down. When all discards are complete, the current player moves the robber to a different tile and chooses an eligible adjacent opponent to steal a random resource from. Bot discards and robber actions happen automatically; required human discards pause the game until submitted.

Click **End turn** to advance. Public points count buildings and awards; your own total also includes private victory-point cards. Reaching ten points on your turn ends the match automatically.

## Trading

After rolling and resolving the robber, the current player can trade four matching resources for one different resource from the bank. There are no harbor discounts yet. Select **Give 4** and **Receive 1**, then **Trade with bank**; the button is disabled without enough cards or available bank stock.

With another online human in the match, choose **Offer to**, fill **You give** and **You receive**, then **Send trade offer**. Only the current player proposes trades; the named recipient can accept or decline outside their own turn. An offer may include several resource types but cannot put the same resource on both sides. Both sides need positive whole-card amounts. Only one offer is active at a time; a new offer replaces it. The offer is visible to the room, while each full resource hand stays private.

Offers reserve no cards. Acceptance rechecks both hands and transfers all cards atomically, without touching the bank. An underfunded offer is rejected without changing either hand. The proposer can cancel; ending the turn expires the offer. Bots do not negotiate or make bank trades yet. Trades are supported in both local UIs. Refresh preserves an active offer while the server remains running.

`npm run test:trading` verifies conservation, atomic rejection, turn/phase restrictions, malformed counts, replacement, cancellation, decline, replay/expiry, and changed affordability. It also runs under `npm test`. `npm run test:trading-network` exercises acceptance between two actual WebSocket clients, private snapshots, bank transfers, duplicate rejection, and turn expiry. Browser testing verified offering, accepting, declining, cancelling, reconnect, and disabled bank controls; successful bank transfers are verified by the network test.

## Development cards

Both local UIs now show your private development-card hand and a purchase button costing one sheep, one wheat, and one ore. The server draws uniformly from a finite 25-card deck: 14 knights, 5 victory points, and 2 each of Road Building, Year of Plenty, and Monopoly. Other players see only your card count, played cards, and played-knight count.

Following the [official CATAN FAQ](https://www.catan.com/faq/basegame), you may play one non-victory-point card per turn, before rolling or after resolving the dice, and cannot play a card bought on that turn. Buying multiple cards is allowed. New cards show disabled play buttons until your next turn.

- **Knight:** move the robber and steal when eligible. No discards are triggered. Playing before rolling returns you to the roll phase after resolving the robber.
- **Road Building:** click white edge markers to place up to two connected roads without paying resources. The normal network and 15-road limit still apply. Placement finishes early if no further road is possible; playing requires at least one legal location.
- **Year of Plenty:** choose two available bank resources, including two of the same type. If only one card remains in the entire bank, choose that one. An empty bank prevents play; unavailable choices leave the card untouched.
- **Monopoly:** choose a resource and collect all of that type from other players. The bank is unaffected.
- **Victory point:** remains private in your hand. It contributes to your private total immediately, including on the turn you buy it. The winner reveals their victory-point count when the match ends; other hands stay private.

Bots can buy and play cards using their own hand and public board/bank information. They remain basic opponents. Knight and Road Building suspend trading while their required moves are pending.

Restart the running server and refresh both tabs after this update, then create a new room. For the original board view use `npm run renderer:lab`; for the prototype use `npm start`. Restarting loses existing rooms because persistence is not implemented yet.

`npm run test:development` checks deck counts, costs, private views, atomic rejection, turn restrictions, pre/post-roll knights, free-road connections and limits, bank shortages, Monopoly conservation, and bots. It also runs under `npm test`. `npm run test:development-network` uses real WebSocket clients to verify purchase costs, private snapshots, card ownership and age, public knight play, return to the roll phase, and replay rejection. Renderer integration and geometry checks pass; the new card controls have not yet been exercised in a browser.

## Scoring and completed matches

The server awards **Longest Road** for a continuous route of at least five roads, and **Largest Army** after at least three played knights. Each award is worth two points. Longest road counts the best route through branches and loops without reusing a road; an opponent's settlement or city interrupts the route. Your own buildings do not interrupt it.

The current award holder keeps a tie. A longer road or larger army transfers the award. If a road is split and its former holder no longer shares the greatest qualifying length, a sole leader receives it; tied leaders leave it unclaimed. Road lengths and award holders are shown in both local UIs.

Settlements count one point and cities two. The **Your score** panel includes your hidden victory-point cards; the player list shows public scores. Following the [official CATAN rules](https://www.catan.com/faq/basegame), victory is checked on the current player's turn. A player reaching ten points outside their turn must wait until their turn begins. Newly bought victory-point cards can complete a win immediately. A winning knight can end the game before its robber effect is resolved.

The winner panel displays their total and revealed victory-point-card count. Further gameplay commands are rejected, bots stop, and reconnect restores the finished board while the server stays running. Other players' private hands remain private. To play again, open a fresh tab and create a new room. There is no rematch button or durable save yet.

`npm run test:scoring` verifies branches, loops, blocked and disconnected roads, award thresholds, ties and transfers, private totals, own-turn victory, newly purchased victory points, knight victory, and the finished-game lock. These checks also run under `npm test`. `npm run test:scoring-network` plays a deterministic diagnostic match with two actual WebSocket clients from placement through production, bank trading, building, card purchases and knights to victory; it checks private/public scores, winner reveal, rejection of further moves, and reconnect. It uses a diagnostic board with all number tokens set to six and controlled random draws. Renderer route/geometry and existing card/trade regression checks pass. The new score/winner panels have not yet been visually tested in a browser.
