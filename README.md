# Private Settlers

Private multiplayer board-game project for local testing, with eventual Azure hosting.

## Current status

Local multiplayer gameplay with initial placement, dice, resource production, building, robber handling, bank/player trading, development cards, scoring, winner detection, and basic bots. The original UI prototype runs on port 3000; an experimental original Colonist board renderer now presents the same local rules on port 3002. Matches can now finish at ten points. Harbors and separated red numbers are implemented; full UI polish remains unfinished. Local saves now survive server restarts.

## Run locally

Install Node.js (the prototype was tested with Node 16.14), then run:

```powershell
npm install
npm start
```

Open `http://localhost:3000`. Enter your name and create a room. Open a separate browser window, enter a different name, and join using the room code. Both windows show the same server-generated island and player list. Refreshing resumes your seat using a token kept in that tab's session storage. Use a fresh window rather than duplicating a tab, which can copy its session storage.

Run `npm test` for server integration checks. Stop the server with Ctrl+C. Set `$env:PORT = '3001'` before launching to change the port.

The server binds only to loopback for local testing. Lobbies retain up to six human seats; new base-game matches allow at most four online players and are saved locally by default. Saved rooms remain available after disconnects and server restarts. Temporary rooms expire after ten minutes fully disconnected. Accounts and expansions are not implemented yet. Azure access is not configured.

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

Open `http://127.0.0.1:3002`, create a room, and choose **Start with bots**, or join friends in another fresh tab on that same port. Place both settlement/road pairs using white markers, then roll dice. When affordable, select a build button to reveal legal locations. The renderer server has its own save file and rooms; room codes from port 3000 do not carry over. Stop with Ctrl+C; set `$env:RENDERER_LAB_PORT = '3003'` to change its port. Once setup is complete, only `npm run renderer:lab` is needed to launch.

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

Target the standard four-player game first. Five/six-player extension rules and larger matches remain to be scoped; the expected user group is up to ten people, usually four or five.

## Initial placement

The host sees Start game, enabled with at least two online players. Offline seats are excluded from the placement order. When alone, use Solo placement test to place both settlement/road pairs yourself (no bots). Players take turns placing a settlement on a white corner, then a road on an adjacent white edge. The second round runs in reverse order and grants starting resources from the second settlement. Other players cannot place during your turn; reconnect restores match state. New players cannot join after start. Regular turns begin automatically after placement. Refresh both tabs after updating the app; restart on the same port and hostname to resume saved seats automatically.

## Playing alone with bots

Create a room and click **Start with bots** on the host's tab. The server fills the active match to four players: one human gets three bots, two humans get two, and three humans get one. Offline lobby seats do not count. This option supports at most four online humans; the five/six-player extension will be added later.

Place your settlement and adjacent road. Computer players automatically take their placement turns using the same server validation as humans, then return control for your second settlement/road pair. Bots favor corners with higher expected resource production and pick a legal adjacent road. They do not control your seat or replace disconnected humans. Their hands remain private.

Bots also make bank/harbor trades, buy/play development cards, roll, discard when required, move the robber, steal, build affordable pieces, and end their regular turns automatically. They prefer cities, then settlements, then roads; this is basic legal behavior rather than strong strategy. Solo placement test remains available as a manual debugging shortcut and now continues into one-player regular turns.

## Regular turns

After setup, click **Roll dice**. The server rolls two dice and distributes resources from matching tiles, except the tile occupied by the robber. Cities produce two resources; settlements produce one. The bank starts with 19 of each resource, and building returns spent cards to it.

Choose a build button and click a white location marker. Buttons are disabled when you cannot afford the piece or have no legal location. Roads must connect to your network without passing through an opponent's settlement. Settlements obey the distance rule and must touch your road. Cities upgrade your own settlements. Piece limits are 15 roads, 5 settlements, and 4 cities. Colored squares are placeholder cities; the black circle is the robber.

On a seven, players with more than seven cards must choose and discard half, rounded down. When all discards are complete, the current player moves the robber to a different tile and chooses an eligible adjacent opponent to steal a random resource from. Bot discards and robber actions happen automatically; required human discards pause the game until submitted.

Click **End turn** to advance. Public points count buildings and awards; your own total also includes private victory-point cards. Reaching ten points on your turn ends the match automatically.

## Trading

After rolling and resolving the robber, the current player can trade matching resources for one different resource from the bank. The default is 4:1. Owning a settlement or city on a generic harbor gives 3:1 for every resource; a specific harbor gives 2:1 for its matching resource. The best applicable rate is used. Select **Give** and **Receive 1**, then the exchange button, which shows the actual cost and is disabled without enough cards or available bank stock.

With another online human in the match, choose **Offer to**, fill **You give** and **You receive**, then **Send trade offer**. Only the current player proposes trades; the named recipient can accept or decline outside their own turn. An offer may include several resource types but cannot put the same resource on both sides. Both sides need positive whole-card amounts. Only one offer is active at a time; a new offer replaces it. The offer is visible to the room, while each full resource hand stays private.

Offers reserve no cards. Acceptance rechecks both hands and transfers all cards atomically, without touching the bank. An underfunded offer is rejected without changing either hand. The proposer can cancel; ending the turn expires the offer. Bots make bank/harbor trades but do not negotiate player trades. Trades are supported in both local UIs. Refresh preserves an active offer while the server remains running.

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

Restart the running server and refresh both tabs after this update, then create a new room. For the original board view use `npm run renderer:lab`; for the prototype use `npm start`. Rooms created after enabling local saves survive subsequent restarts; earlier in-memory rooms cannot be recovered from a stopped server.

`npm run test:development` checks deck counts, costs, private views, atomic rejection, turn restrictions, pre/post-roll knights, free-road connections and limits, bank shortages, Monopoly conservation, and bots. It also runs under `npm test`. `npm run test:development-network` uses real WebSocket clients to verify purchase costs, private snapshots, card ownership and age, public knight play, return to the roll phase, and replay rejection. Renderer integration and geometry checks pass; the new card controls have not yet been exercised in a browser.

## Scoring and completed matches

The server awards **Longest Road** for a continuous route of at least five roads, and **Largest Army** after at least three played knights. Each award is worth two points. Longest road counts the best route through branches and loops without reusing a road; an opponent's settlement or city interrupts the route. Your own buildings do not interrupt it.

The current award holder keeps a tie. A longer road or larger army transfers the award. If a road is split and its former holder no longer shares the greatest qualifying length, a sole leader receives it; tied leaders leave it unclaimed. Road lengths and award holders are shown in both local UIs.

Settlements count one point and cities two. The **Your score** panel includes your hidden victory-point cards; the player list shows public scores. Following the [official CATAN rules](https://www.catan.com/faq/basegame), victory is checked on the current player's turn. A player reaching ten points outside their turn must wait until their turn begins. Newly bought victory-point cards can complete a win immediately. A winning knight can end the game before its robber effect is resolved.

The winner panel displays their total and revealed victory-point-card count. Further gameplay commands are rejected, bots stop, and reconnect restores the finished board, including after a server restart with local saves enabled. Other players' private hands remain private. After victory, the host can click **Rematch · return to lobby**. This keeps human seats and tokens, removes bots, clears the finished match, and creates a new board and harbors in the same room. Choose Start game or Start with bots again. The server rejects rematches during an active match and requests from other players.

`npm run test:scoring` verifies branches, loops, blocked and disconnected roads, award thresholds, ties and transfers, private totals, own-turn victory, newly purchased victory points, knight victory, and the finished-game lock. These checks also run under `npm test`. `npm run test:scoring-network` plays a deterministic diagnostic match with two actual WebSocket clients from placement through production, bank trading, building, card purchases and knights to victory; it checks private/public scores, winner reveal, rejection of further moves, and reconnect. It uses a diagnostic board with all number tokens set to six and controlled random draws. Renderer route/geometry and existing card/trade regression checks pass. The new score/winner panels have not yet been visually tested in a browser.

## Saved games and restart recovery

Normal launches save automatically before acknowledging gameplay changes. `npm start` uses `data/prototype.json`; `npm run renderer:lab` uses `data/renderer.json`. Lobby seats, board, setup progress, private hands/deck, pending trades, robber/discard/free-road phases, turn order, awards, and finished matches are preserved. Live sockets are never serialized. When the server starts again, humans are offline until their existing browser tabs reconnect; interrupted bot turns resume when a human reconnects.

Stop with Ctrl+C, launch the same command on the same port, and keep the same hostname (`localhost` and `127.0.0.1` have separate browser storage). The tab's existing session token restores its seat. Clearing browser session storage or closing the tab may lose that token; the room code alone cannot reclaim a seat. No account-based recovery or save-management UI exists yet. Rooms from an older server that had no saving enabled are not migrated.

Save files and backups contain private hands and seat tokens. The entire `data/` folder is ignored by Git and is never served over HTTP. A temporary file is flushed and renamed into place; `.bak` holds the preceding save. A single-process lock prevents two servers from writing the same file. A lock left by a dead process is reclaimed on startup. Use local disk; this is not a database or a multi-server/cloud storage design.

Optional configuration (also documented in `.env.example`; the app does not load `.env` automatically):

```powershell
# Override the path for one server. Use different files for separate servers.
$env:SETTLERS_SAVE_FILE = 'data/my-games.json'
npm run renderer:lab

# Restore the default path for subsequent launches.
Remove-Item Env:SETTLERS_SAVE_FILE

# Opt into temporary, in-memory games instead.
$env:SETTLERS_SAVE_FILE = 'off'
npm start
```

Invalid or incompatible saves stop startup without resetting the file. To restore a backup, stop the server, preserve the invalid file separately, and copy its `.bak` over the main save. The backup may be one move behind. If saving fails during play, further commands are paused; fix storage and restart to recover the last successfully saved state. Moves whose save failed are not acknowledged. Saved rooms currently have no automatic expiry or deletion, so the file grows as rooms are created. Backups are local and do not protect against losing the disk.

`npm run test:persistence` checks round trips through setup, discard/robber and free-road phases, socket exclusion, token preservation, file locking, stale-lock recovery, backup writing, failed replacement, and refusal of incompatible/corrupt state. It also runs under `npm test`. `npm run test:persistence-network` restarts real servers during setup, roll/build, a pending trade, a new card, and knight resolution; it verifies identical private/public snapshots, failed-save command blocking and recovery, and resuming an interrupted bot turn. `npm run test:scoring-network` now also restarts and restores a completed match from disk. These are automated loopback checks; browser restart behavior has not yet been manually exercised.

## Base-game board milestone

The renderer trade popup now uses request cards, a proposed give/receive exchange, your available hand, and a bank/player/close action rail. Click hand cards to offer them, top cards to request them, and proposal cards to remove them. The bank action requires the exact current rate for one requested card; player offers retain named recipients and server validation. Popups close on outside pointer clicks or Escape and only one can open at a time. Dock panels are disabled during the roll phase; the server continues supporting legal pre-roll development-card plays, but this renderer now waits for the roll. The prototype UI retains its existing controls. Renderer integration passes; the reference trade panel still uses a simplified recipient and pending-offer presentation.

The dock orders Trade, development cards, road, settlement, city, and end turn. Build icons use the local player's sprite color, with a narrower road icon. Bank trade resource selection uses clickable card rows; the original validated player-offer form remains available. REA analyzed the local UI bundle (`ev_b325549316116c48de9cc58e419fb7a26f19e5dff006d1675d9411e8ca3d75d0`), recovering 75 modules with partial semantic coverage. This is static evidence, not a recovered working interface; the exact original trade interaction still needs further reconstruction.

History now scrolls within a bounded sidebar area instead of expanding the player list. Harbor piers extend from both owning corners to the boat and render above the shoreline. Positive changes in your own resource hand display a four-second receipt and short card flights; bank reductions use the matching bank card as the origin, while other gains originate at the board. Opponent resource identities are never used. Reduced-motion mode retains the receipt without flights. Renderer/geometry checks pass, and browser testing verified starting-resource feedback and internal history scrolling. Flights show net gains between snapshots, not a complete per-card transaction replay.

Harbors now show paired wooden piers at their owning corners and resource-specific boat sprites; generic harbors use a local question-mark sail illustration. The sidebar uses compact opponent rows, avatar/point badges, resource/development counters, army/road indicators, and a larger local-player row. Dock panels, markers, and counters have short CSS transitions, with reduced-motion support. Renderer route and geometry checks pass. The generic boat, avatar sizing, dice graphics, and log formatting remain approximations; these changes do not reconstruct the original animation engine.

The renderer now rolls by clicking the dice, uses sprite icons for build/trade/development dock controls, shows remaining physical pieces, and uses translucent placement targets. Settings include a remembered sound toggle; turn and dice cues are synthesized with Web Audio after a user gesture. The clock shows elapsed time in the current phase, resets on phase changes or refresh, and does not enforce a deadline. Original sound recordings, a countdown/timeout policy, and the reference trade selector layout remain unfinished. Renderer and complete-game tests pass; browser testing verified setup and clicking the dice through to the build phase. Audible sound quality still needs user testing.

The latest renderer layout follows the supplied Colonist reference: blue ocean board area, parchment log/chat/bank sidebar, vertical player seats, and a bottom action dock. Trade and development controls open above their dock buttons. Resource cards use the locally available sprite sheets; `/sprites.css` derives atlas positions without copying downloaded assets into Git. Chat is restricted to the sender's room, uses server-assigned identity, accepts up to 300 characters, and limits message frequency. Chat and the snapshot-derived public game log are session-only and do not survive refresh. The log covers visible placements, rolls, robber moves, card plays, and victory; it is not a complete persisted event history. The layout still differs in harbor art, player avatars, action icons, and timer behavior; no countdown is enforced.

Interaction controls now explain blocked bank trades, validate player-offer drafts before enabling Send, highlight the selected building action, and describe each development card's effect and availability. Year of Plenty choices exclude empty bank resources and prevent selecting two of a resource when only one remains; Monopoly choices remain independent of bank stock. These browser-side checks supplement server authority. `npm test` includes interaction-decision checks for valid and invalid offers, harbor exchange commands, and development-card resource choices.

The renderer table layout places phase guidance above the board, five resource-count cards below it, and action panels alongside it on wide screens. Smaller screens stack the panels. Player cards identify the active seat, while scoring, trading, and development controls use compact sections. Styles are served locally from `/game.css`. Browser testing verified initial settlement placement and updated phase guidance; the renderer route test checks the stylesheet response. This remains a work-in-progress UI, with text harbor badges and no final card artwork or animations.

The renderer UI now has responsive player cards with an active-turn highlight, phase instructions, visible building costs, cancelable placement selection, and room-link copying with room-code autofill. Discard controls display the selected total and enable submission only for exactly the required number of available whole cards. Server validation still decides whether any move is legal. Diagnostics are collapsed by default, and the hand is hidden when a rematch returns to the lobby. Room links point to the current server address; loopback links work only on the same computer until hosting is configured. Renderer/network regressions pass; browser checks cover reconnect, room-link copying, and the displayed controls. Discard and rematch UI flows still need manual playtesting.

New rooms and rematches use the standard 19 land tiles: four wood, four sheep, four wheat, three brick, three ore, and one desert. The usual 18 number tokens are randomized with no adjacent 6s or 8s. This constraint is what “balanced” means here; resource clusters and equally strong starting positions are not guaranteed. Randomness remains server-side. Old saved boards are retained unchanged, including any older rooms without harbors.

Nine harbors surround the island: four generic 3:1 harbors and one 2:1 harbor for each resource. Each attaches to the two endpoints of a coastal edge. Harbor endpoints do not overlap, and the pattern leaves gaps around the coastline. Both local UIs show harbor labels; hovering a renderer label identifies its two corner IDs. Owning a settlement or city at either endpoint grants access immediately. Roads alone grant none. Ports do not stack their discounts and the robber does not disable them. The server computes trade costs and ignores client-supplied rate fields. See the [official maritime trade rules](https://www.catan.com/sites/default/files/2021-06/catan-family-rules-overview.pdf).

Public player lists now show resource-card counts while resource identities remain private. Banks, cards, piece limits, development cards, awards, and ten-point victory are implemented. New normal matches are limited to four active players until the five/six-player extension exists. Two-player and solo starts remain local testing variants, rather than claims of official variant support. Earlier larger saved matches remain loadable with their existing rules; they are not an implementation of the extension.

Verification now includes 250 generated boards, coastline and harbor-bag checks, specific/generic access and trade conservation, insufficient-bank production, physical settlement/city limits, settlement return after upgrades, and bot trade planning. These run under `npm test`; board checks can also run with `npm run test:board`. `npm run test:harbors-network` verifies real 2:1 and 3:1 trades through two clients. `npm run test:base-game-network` completes a generated standard-board four-player game with one automated human client and three server bots, including sevens, discards, maritime trades, cards, and victory. Its server random sources are seeded for reproducibility; normal games use cryptographic randomness. Existing diagnostic full-match checks now verify host-only rematches, seat preservation, and reset state.

Browser verification covered all nine renderer harbor labels, setup on generic and wood harbors, the displayed 2:1/3:1 options, and a successful 2:1 wood-to-brick exchange with matching hand/bank updates. Score panels were also visible. Rematch controls and complete-game endings are verified by automated tests, not yet by a full manual browser game. The board is playable with the original renderer, but ports use local text labels and the surrounding HUD is still our prototype. Next is a multiplayer playtest and UI polish; expansions follow that base-game pass. Azure/container packaging, account-based seat recovery, save-management tools, and stronger bot strategy remain later work.

Renderer dock: hover build and development purchase actions for costs; click to purchase or select placement. Private development cards appear in the hand and unavailable cards are dimmed. Knights and road building play directly; monopoly and year of plenty use inline resource choices. Trade is the only dock popup.

The renderer bottom bar aligns the parchment hand and six equal action buttons on one row, with a compact turn status and elapsed timer above the dock. Small screens stack the hand above the dock.

Robber turns show an action box above the hand: select an eligible player, inspect their public resource-card count, then confirm the random theft. The robber sits inside the selected tile to the left of its number.

The sidebar displays public points on each avatar ribbon; your ribbon adds your private total in parentheses when different. Longest-road and largest-army holders have yellow achievement icons. The duplicate score summary is removed; game-end results and host rematch remain. Reference sidebar SVGs remain ignored local assets.

Piece-button atlas styles are included in the renderer stylesheet, so existing server sessions display all player colors after refresh.
