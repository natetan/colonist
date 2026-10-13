# Colonist client investigation

Evidence: the locally downloaded homepage and initial bundles. Findings describe that snapshot, not a complete reconstruction. No live game traffic was captured and no original server was accessed beyond the public homepage download.

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
