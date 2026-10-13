# Colonist client investigation

Evidence: the locally downloaded homepage and bundles, plus an isolated guest beginner-game session inspected through the browser. Findings describe that snapshot, not a complete reconstruction. No raw WebSocket traffic was captured; the production server was used through ordinary guest UI interactions. The user's existing multiplayer match was not inspected or changed.

## Startup and assets

The homepage supplies runtime configuration through globals, including `assetPath` and `socketServerWSS`. The downloaded configuration points assets at `https://cdn.colonist.io/dist/` and sockets at `wss://socket.svr.colonist.io/`.

Bundles register modules with `webpackChunkkatan`. The shared bundle sets the webpack public asset path from `window.assetPath`. Game UI controllers are also imported asynchronously, so the five initial bundles are not the complete client.

Startup calls user-state initialization before completing the entry flow. A standalone client therefore needs more than replacing the WebSocket address: configuration, user/session initialization, assets, and lazy modules must be accounted for.

## Socket transport

The client creates a native WebSocket and sets `binaryType` to `arraybuffer`. Its connection URL includes a protocol version and may include a previous session ID. Conditional Discord authentication and Turnstile handling are present; their necessity for a replacement local implementation has not been established.

Initial text messages are parsed as JSON. The `Connected` message carries `userSessionId`; `SessionEstablished` switches the client to the regular message handler and resolves the connection attempt.

Regular incoming messages pass through decoder module **64853**, then dispatch using `Number(message.id)` and `message.data`. The encoder and decoder implementations in the vendor bundle have the characteristic MessagePack API and types; this identification is based on static inspection and has not yet been verified through a wire-format round trip.

Outgoing commands use encoder module **62777** for the payload, with a custom envelope:

| Bytes | Meaning |
| --- | --- |
| 0 | Route kind: server type (2), direct server (3), or socket router (4) |
| 1 | Command subtype |
| 2 | UTF-8 recipient byte length |
| 3 onward | UTF-8 recipient followed by encoded payload |

The sender buffers commands while the session is pending. The socket controller also supports socket replacement and reconnect observers.

## State dispatch

Module **67908** contains state/event enums. Visible top-level message kinds include lobby updates (133), channel updates (134), general updates (135), socket monitoring (136), room events (137), shuffle updates (139), and socket replacement (140). The game-state update ID references another module and has not yet been resolved.

The game listener handles a first-game-state event containing a server ID, database game ID, settings ID, and reconnect token. Subsequent updates contain a `diff` and `timeLeftInState`; UI controllers apply these diffs and update timers. Client move validators are present, but this does not establish that authoritative move execution is available in the client.

## Next implementation checkpoint

Before choosing between adapting this client and implementing a new UI:

1. Resolve the startup user-state calls and minimum session/lobby/room schemas.
2. Locate lazy game modules and asset requirements.
3. Resolve action enums, game-state shape, and payload encoding.
4. Build an isolated local handshake/lobby experiment. A successful connection alone is not a playable game.

Only then implement shared board state and authoritative rules. Keep local experiments from connecting to the production socket endpoint.

## Reproducing module lookups

`npm run inspect:module -- 67908` locates the state enums. `npm run inspect:module -- handleInitialWebSocketMessage` locates the socket implementation. The tool performs static text indexing and does not execute third-party bundles. Its declaration matcher is a navigation aid, not a full JavaScript parser; output is bounded and module boundaries may be imperfect.

## Browser investigation: October 12, 2026

Opened a separate in-app browser session. The site selected its mobile interface, exposed guest access, and successfully launched a beginner game. The rendered view showed a canvas board, bank counts, player inventory, dice, a turn indicator, and road-placement tutorial objectives. This confirms the original UI works in the research browser, not that it can run independently of Colonist.

Observed and downloaded these additional public bundles for local static analysis:

| Bundle | Bytes | Purpose established by inspection |
| --- | ---: | --- |
| `pixi.0d3da6198b196c2999cb.js` | 494778 | Pixi rendering library |
| `vendors-async.314ebd0bd0dea1ef16e6.js` | 319788 | Asynchronous vendor dependencies |
| `ui-game.ef351c1079ae7886fa5e.js` | 643242 | Game UI and controllers |
| `shared-async.ea6ade250f9df0b52883.js` | 92984 | Shared asynchronous code, including action sender |

Important module locations:

- **41418**, shared-async: game action sender. Methods include `clickedDice`, `clickedPassTurn`, trade creation/execution, development-card purchase, and build confirmations. Sends `{action, payload, sequence}` to the game server through the `GameAction` command subtype. The sequence counter starts at 1 and is incremented before sending.
- **68736**, ui-game: `UIGameController`. Applies state updates through the shared state updater and exposes turn, player, resource, and validator information.
- **54801**, shared: state update helpers and game event enums, including `FirstGameState = 1` and `BuildGame = 4`.
- **55935**, shared: player colors and strict player-state schemas, including resource cards, trade ratios, victory points, and connection/action flags.
- **46581**, shared: imported by the action sender for action enums. This is the next place to resolve action IDs.

The screenshot `research/bot-inspection.png` is local evidence and is ignored by Git. Downloaded additional bundles also remain ignored. The inventory JSON can be regenerated with `npm run inspect:client`; the earlier inventory predates these downloads.

The next client-compatibility experiment is to supply minimum session, room, and first-game-state messages from a local server. This requires resolving the schemas and startup calls first.

## Local implementation

An original local lobby and shared-board prototype is now available through `npm start`. It uses JSON over WebSockets rather than the original binary transport. The initial `Connected` and `SessionEstablished` names are borrowed from the observed handshake, but no compatibility with the original client is claimed. It does not load or serve the downloaded third-party bundles. This gives a locally testable multiplayer foundation while original-client feasibility remains under investigation.
