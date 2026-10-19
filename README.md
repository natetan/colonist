# Private Settlers

Private multiplayer board-game project for local testing and self-hosted Windows/Azure deployment.

Windows VM deployment preparation is documented in [deploy/windows/README.md](deploy/windows/README.md).
It includes a private release packager, HTTPS origin configuration, and a Caddy
configuration generator that preserves an existing IIS server on port 80.
The existing Windows VM now runs automatic game/HTTPS services; public HTTPS,
two-player setup, and reconnect have been checked. Run `node tests/hosting.cjs`
for local configuration checks; see the guide for the live smoke test and limits.
Updates are explicitly deployed with `deploy/windows/Deploy.ps1`: local edits and
ordinary Git pushes do not change the live server. See the deployment guide for
the one-time VM Git access setup and the test/push/fetch/release workflow.

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

With another online player or bot in the match, choose **Offer to**, fill **You give** and **You receive**, then **Send trade offer**. Only the current player proposes trades; every other player can accept or decline independently when All players is selected (the default). You can also select one named recipient. Recipients respond outside their own turn. An offer may include several resource types but cannot put the same resource on both sides. Both sides need positive whole-card amounts. Only one offer is active at a time; a new offer replaces it. The offer is visible to the room, while each full resource hand stays private.

Offers reserve no cards. Acceptance records willingness without transferring cards or adding turn time. The trader then chooses one accepted player using the final confirmation button. Only this final step rechecks both hands, transfers all cards atomically without touching the bank, and adds up to 20 seconds, capped at the lobby turn limit. Multiple players may accept the same offer; unchosen hands are untouched. Accepted responses survive reconnects and restarts. An underfunded offer is rejected without changing either hand. The proposer can cancel; ending the turn expires the offer. Bots also respond to player offers after a short thinking delay. They use their own hand and public offer terms to reject unaffordable or unfavorable exchanges and accept fair trades that preserve or improve their next purchase. Bots wait for the human trader to choose them; they do not initiate player offers or use victory-point difficulty settings yet. Trades are supported in both local UIs. Refresh preserves an active offer while the server remains running.

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

The renderer trade popup now uses request cards, a proposed give/receive exchange, your available hand, and a bank/player/close action rail. Click hand cards to offer them, top cards to request them, and proposal cards to remove them. The bank action requires the exact current rate for one requested card; player offers support all players/bots or one named recipient, with server validation. Popups close on outside pointer clicks or Escape and only one can open at a time. Dock panels are disabled during the roll phase; the server continues supporting legal pre-roll development-card plays, but this renderer now waits for the roll. The prototype UI retains its existing controls. Renderer integration passes; the reference trade panel still uses a simplified recipient and pending-offer presentation.

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

Public player lists now show resource-card counts while resource identities remain private. Banks, cards, piece limits, development cards, awards, and ten-point victory are implemented. Standard islands support up to four active players; Large islands support up to six. Two-player and solo starts remain local testing variants, rather than claims of official variant support. Earlier larger saved matches remain loadable with their existing rules; they are not an implementation of the extension.

Verification now includes 250 generated boards, coastline and harbor-bag checks, specific/generic access and trade conservation, insufficient-bank production, physical settlement/city limits, settlement return after upgrades, and bot trade planning. These run under `npm test`; board checks can also run with `npm run test:board`. `npm run test:harbors-network` verifies real 2:1 and 3:1 trades through two clients. `npm run test:base-game-network` completes a generated standard-board four-player game with one automated human client and three server bots, including sevens, discards, maritime trades, cards, and victory. Its server random sources are seeded for reproducibility; normal games use cryptographic randomness. Existing diagnostic full-match checks now verify host-only rematches, seat preservation, and reset state.

Browser verification covered all nine renderer harbor labels, setup on generic and wood harbors, the displayed 2:1/3:1 options, and a successful 2:1 wood-to-brick exchange with matching hand/bank updates. Score panels were also visible. Rematch controls and complete-game endings are verified by automated tests, not yet by a full manual browser game. The board is playable with the original renderer, but ports use local text labels and the surrounding HUD is still our prototype. Next is a multiplayer playtest and UI polish; expansions follow that base-game pass. Azure/container packaging, account-based seat recovery, save-management tools, and stronger bot strategy remain later work.

Renderer dock: hover build and development purchase actions for costs; click to purchase or select placement. Private development cards appear in the hand and unavailable cards are dimmed. Knights and road building play directly; monopoly and year of plenty use inline resource choices. Trade is the only dock popup.

The renderer bottom bar aligns the parchment hand and six equal action buttons on one row, with a compact turn status and elapsed timer above the dock. Small screens stack the hand above the dock.

Robber turns show an action box above the hand: select an eligible player, inspect their public resource-card count, then confirm the random theft. The robber sits inside the selected tile to the left of its number.

The sidebar displays public points on each avatar ribbon; your ribbon adds your private total in parentheses when different. Longest-road and largest-army holders have yellow achievement icons. The duplicate score summary is removed; game-end results and host rematch remain. Reference sidebar SVGs remain ignored local assets.

Piece-button atlas styles are included in the renderer stylesheet, so existing server sessions display all player colors after refresh.

Action buttons use the reference SVG frame and proportional SVG icons, including the pass-turn arrows. Disabled actions dim the foreground only; piece counters use the player color. These downloaded SVG assets remain local and ignored.

Development-card metadata lives in public/development-cards.json (names, effects, sprite artwork). The renderer groups identical owned cards into overlapping stacks with counts and effect/availability tooltips on hover or keyboard focus. A playable older card is selected before a newly bought card of the same type. Restart the renderer after upgrading to register the catalog route.

Monopoly and year of plenty now use the shared action box above the hand: select resources, review selected cards, then confirm or cancel. Selection alone never spends the card. Year of plenty prevents selections beyond available bank stock; server validation remains authoritative.

The renderer dice use six locally cached reference SVG faces rather than font glyphs. Click the pair to roll when enabled; inactive dice display the latest server result with a darker tint.

History and chat use player-colored names and icons; game history includes piece art, dice faces, played development cards, and your own resource gains. Up to 500 entries are retained in the current browser session; scrolling upward pauses automatic scrolling. Opponent resource identities are never inferred from private hands. History is not yet persisted across refresh.

The renderer includes fallback card metadata so owned development cards remain visible even if an older running server cannot serve the JSON catalog. Action cost tooltips show resource-card art and quantities, including on disabled actions, with keyboard focus support for available buttons.

Trade selections update inside a stable popup element, preserving its open state and avoiding repeated entrance animations.

Trade-hand counters show resources remaining after the draft offer; removing offered cards restores those counters without changing the actual hand before a trade completes.

Victory-point artwork uses the actual card_vp atlas entry, including a static stylesheet rule for already-running renderer sessions.

Player offers appear above the hand with both resource rows, avatars, and accept/decline controls. A server-reported decline shows a red X on the recipient until another offer or turn. Offers default to all other human players. Each recipient can decline independently; their avatar gains a red X while the offer remains available to the others. The first valid acceptance completes the exchange once. All declines remain visible until the sender cancels, replaces the offer, or ends the turn. Counteroffers and bot negotiation remain unimplemented. Restart the server and refresh the clients after this update.

Incoming player offers overlay the upper-right board area immediately left of the chat sidebar. To test without bots, create a fresh room in one browser tab, join its code in a second tab, and start without bots; either human tab can offer cards to the other after rolling. Automated two-client trades run with npm run test:trading-network. Bots currently use bank trades and do not initiate player offers.

The trade creator is anchored to the inventory area: offer rows sit above the hand, and its hand row replaces the visible inventory while open. Bank, player-offer, and close actions use reference SVG artwork with dimmed foregrounds for unavailable actions.

Trade creation keeps the original inventory visible and selectable. Click resource cards in the hand to offer them; offer rows sit above it, and the dock trade button becomes the close X.

Trade-creator columns share the inventory and dock edges; bank and player buttons align with their corresponding selector and offer rows.

Trade bank/player actions form an evenly spaced column immediately above the dock close button, independent of the height of the resource-selection rows.

Game completion opens a full-screen results overlay over the final board, with winner, ranked public overview, piece/development summaries, board-view controls, and host-only rematch. It contains no advertising. Dice distributions, timed duration, and resource/activity statistics are not tracked and are not fabricated; losing players retain private card identities.

Closing the trade creator with the X, Escape, or an outside click clears its draft offer and requested cards; reopening starts empty.

Robber placement automatically steals one server-random resource when exactly one eligible neighboring opponent has cards. Multiple eligible opponents still require selection; empty opponents are excluded. Knight turns return to their previous phase after automatic theft.

Renderer setup tolerates scoring and build-availability fields being absent before the regular turns begin; starting with bots transitions directly into settlement placement.

The renderer launch command paces bot actions 700ms apart. New settlements, city upgrades, and roads drop into position over 540ms; reconnecting does not replay old placements, and reduced-motion settings skip the drop. Restart the server to enable bot pacing. Automated tests retain immediate bot turns unless a delay is explicitly configured.

Renderer bot actions wait 1100ms before acting, including the first action after a human ends their turn. Resource payments animate from your hand back to the bank; newly acquired development cards animate from the bank into their hand stack. Transfers use your private hand and public bank deltas, and reduced-motion settings suppress flights. Restart the server for updated bot timing.

Dice production broadcasts a public payout record (tile, recipient, resource, amount). Cards animate from each producing tile to every recipient’s player-info card counter, respecting robber blocking, city production, bank shortages, and reduced-motion preferences. Private hands remain redacted; a reconnect does not replay old production. Restart the server for payout records.

Sidebar avatars use the reference logged-in player/bot SVGs on player-colored medallions, with the small/large score-ribbon artwork. Private score totals remain visible only in your own ribbon.

On a seven, only players with more than seven resource cards discard floor(hand/2); development cards do not count. A mandatory action box lets you select resource cards, undo selections, and confirm the exact discard amount. Its draft survives bot updates. The status strip states your required discard explicitly.

On desktop, the board column fills the same viewport height as the sidebar, keeping the hand and action dock aligned with the bottom player row.

Build placement ends after the server confirms your new road, settlement, or city. The extra cancel-placement button is removed; clicking the selected build icon again exits an uncommitted placement.

### Full-game and trading QA

Run `npm run practice:trading` for a disposable four-human match at port 3011. Open all four printed seat URLs in separate tabs; setup and the first roll are already complete. These are real multiplayer seats: offer cards in the host tab, then independently decline or accept in the other tabs. The diagnostic board deliberately uses sixes for quick production. It has no persistence and does not modify your saved rooms. Keep it on localhost; the generated seat links and bootstrap files are local diagnostics. Stop with Ctrl+C and rerun to reset.

Run `npm run qa:renderer` to record a complete integration-test match and two-human trade snapshots, then open the printed port-3010 replay URL. Use its scenario selector for discard, development hand, incoming/declined offers, results, and recorded animation transitions. Replay controls do not send live game moves. Generated snapshots, HTML, and assets remain ignored.

This pass verified complete four-player matches on two generated boards (including asynchronous bot scheduling), real browser-to-browser offer/decline/accept flows, resource payment and development-card purchase flights, discard controls, and the results overlay. Fixed clipped boards on shorter desktop windows, over-wide inventory, detached discard-box positioning, and sender drafts surviving completed trades. Broadcast human offers and 5–6 player islands are supported; counteroffers and maps above six players remain later work.

The renderer plays a short synthesized bell when your turn starts (including settlement setup). Settings → Sound enables or mutes it and remembers your choice. Browser audio needs an initial click or keypress in the game tab; no audio download is required.

Sound uses the supplied `public/audio/dice-roll-sound.mp3` for every player’s dice roll, alongside soft placement impacts for roads/buildings/the robber, and distinct ascending fanfares when Longest Road or Largest Army changes holder. These follow confirmed server updates for every player; repeated snapshots stay silent.

### Main menu and map lobby

Run `npm run renderer:lab` and open http://127.0.0.1:3002. Create game opens a host lobby; Join game accepts an invite code. The lobby previews terrain, numbers, and harbors for everyone. Classic is our fixed island layout; Random uses the server generator with exact base-game bags and separated 6s/8s. The host can select a map and use Generate again before starting. Start with bots fills four seats on Standard; Large lets you choose five or six. Start game requires at least two online humans. Room capacity follows the island size, including disconnected seats reserved for reconnect. Map settings and the selected board survive server restarts. Once started, the map is locked. Rematch returns to the lobby with the same map so the host can keep it or generate another. Existing saved rooms without map metadata are shown as Random.

Verify shared map changes, host permissions, the four-seat cap, and map locking with `npm run test:lobby-maps`. Renderer menu checks are included in `npm run test:renderer`.

Use Settings → Quit game to return to the main menu. Leaving a lobby frees the seat. During a match, a bot takes over your seat and host authority passes to another human. If the last human leaves, the room is removed. Ordinary disconnects still preserve your seat for reconnect; quitting clears the current tab’s saved session.

### Large islands for 5–6 players

In the lobby, choose **Island size → Large · 5–6 players**, then Classic or Random. Generate again preserves the selected size. Large uses 30 land tiles (6 wood, 6 sheep, 6 wheat, 5 brick, 5 ore, 2 deserts), 28 number tokens with six separated red numbers, and 11 harbors (5 generic, 2 sheep, 1 each other resource). It has 24 cards per resource and 34 development cards (20 knights, 5 victory points, 3 of each progress card). The host can fill five or six seats with bots or start with human players. Downsizing is rejected if too many seats are occupied.

This is our larger-map variant with the existing one-player-at-a-time turns, seven-card discard threshold, and ten-point target. It does **not** implement paired turns or the special building phase from physical 5–6 player editions. Component scaling follows the [official 5–6 player rulebook](https://www.catan.com/sites/default/files/2024-03/Catan%20Game%205-6%20Rules%202022%20240313.pdf). Standard maps and older saved games keep their existing supplies.

Run `npm run test:extended` to check 100 generated large maps, 5/6-player setup and conservation, saved-state validation, complete five- and six-player games (including delayed bots), and six-human broadcast trade responses. `npm run test:extended-board` runs only the map/rule checks.

### Turn timers

The host chooses a turn timer in the lobby: Off, 30 seconds, 1 minute (default), 90 seconds, 2, 3, or 5 minutes. Settings lock when the match starts. The countdown covers the entire turn. Successful rolls, placements/builds, development-card purchases/plays, robber choices, and completed bank/player trades add up to 20 seconds to the remaining time, capped at the lobby turn limit (50 seconds becomes 60 in a one-minute game; 3 becomes 23). Offering, declining, or cancelling trades, invalid actions, and reconnects add no time. A completed player trade extends the active player's clock after the trader confirms a willing partner; consent alone adds no time. Ending a turn starts the next player's normal allowance; Timer Off stays off. Each starting settlement/road pair has its own allowance; a successful settlement adds time for placing its road. Final-eight-second warning ticks play for the active player (and anyone still required to discard), using the Sound setting.

At zero the server expires open offers and skips the turn without rolling or buying anything for the player. Pending discards and robber/steal choices are resolved automatically; unused free roads are forfeited. During setup the server completes the current settlement/road pair so the placement order remains valid. Deadlines are saved and restored. If everyone disconnects, scheduled callbacks stop; an overdue turn is resolved on reconnect. Run `npm run test:timers` for expiry, settings permissions, setup/discard safety, reconnect and late-action checks. Renderer tests cover the countdown and eight warning ticks.

### Shaped islands

The host can select **Star**, **Crescent**, or **Long Island** under Map type in the main lobby, then use **Generate again** to reshuffle that shape. All guests share the same preview. Each shape supports Standard (3–4 players, 19 tiles) and Large (5–6 players, 30 tiles), using the same resource tiles, number tokens, bank supplies, development deck, and rules as that size. Star has a filled center and five broad, tapered points, Crescent curves around an open bay, and Long Island favors a longer coastline. There are no volcano or other scenario rules.

Shaped generation keeps red 6/8 tokens nonadjacent and chooses up to 100 shuffled layouts to minimize differences in average production pips per resource tile, stopping at a spread of one pip or less. This is a resource-production safeguard, not a guarantee that all starting locations are equally strong; narrow arms and coastal positions change strategy. Ports are spaced around the full coastline without sharing vertices. Saved games retain the selected shape. Classic and Random retain their existing geography. Run `npm run test:board` for shaped generation, setup, bot-action, persistence, and renderer-topology checks.

### Link previews and favicon

The rendered lobby serves a Natac N logo as an SVG/ICO favicon, a touch icon, and a 512-pixel PNG for social previews. Page descriptions and Open Graph/Twitter tags are present in the initial HTML, including room invite links, so crawlers do not need JavaScript. Preview image URLs use https://natac.natetan.com/. Branding files live in `public/branding` and ship in the Windows release. The icon is adapted from the user-supplied Colonist mobile SVG with its central letter replaced by an N. Discord can cache existing previews; changes become available after explicit deployment, and cached messages may retain the previous preview.

### Returning to a disconnected seat

The rendered game remembers up to 20 room-specific seat tokens in this browser's local storage, with a tab-local session for refresh and automatic network reconnect. Close the tab and return later: enter the room code and press **Join game** to reclaim your seat, even after the match starts; no name is required. A room invite automatically resumes a remembered seat for that room, never a different room. Existing tab-only sessions migrate when they reconnect.

For another browser/device, copy your **Seat recovery key** from Settings before leaving. Enter the room code, expand **Returning from another browser?**, paste the key, and join. The key is private and is never included in public room links or other players' snapshots. A name alone cannot reclaim a seat. A currently connected seat rejects a second connection; dead networks are detected by a 30-second heartbeat (normally within 60 seconds). If the old window is still open and healthy, close it before switching.

**Quit game** intentionally forfeits the seat to a bot and revokes recovery. Clearing browser data, private browsing, or changing the site's hostname can lose access to remembered seats; keep a recovery key if you need cross-device access. Without either the saved token or recovery key, there is no name-based or host-approved recovery yet. When storage is disabled, only the current tab can remember its session. Server saves must still exist; temporary rooms expire ten minutes after everyone disconnects. Run `npm run test:reconnect` for browser storage/join behavior, private-hand protection, dead connection cleanup, and forfeiture checks.

### Room invite arrival

Opening a room invite link goes directly to a live lobby preview and asks for a name in a dialog; it does not present Create game. Joining by a typed room code uses the same flow. The host sees **Player joining…** until the name is submitted. The temporary reservation counts toward capacity, has no access to gameplay or private hands, and prevents starting while a name is pending. It disappears on cancel, disconnect, or after 90 seconds. Closing the last human's room also closes its previews.

A remembered seat resumes directly without a name prompt. An invite to a match already in progress offers recovery through the private seat key; it does not admit a new player or expose the running match. Run `npm run test:invites` for live previews, reservation limits, authorization, and cleanup checks.
