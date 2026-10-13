# Game action protocol investigation

REA MCP successfully connected after restarting Codex. A focused analysis of a byte-for-byte copy of `shared-async.ea6ade250f9df0b52883.js` parsed 92,984 bytes without parse failures. Application inventory coverage was complete for this one bundle; semantic coverage remained unknown with 7,059 unresolved observations. This is static evidence, not execution or server recovery.

REA parent evidence: `ev_21d06697eb8fd2e43152ab6c276a6f54de5a293fcfb9c53073ef54c50bd7c871`.
Portable session evidence is saved locally in ignored `.rea-tools/game-actions-evidence.json` (33,262,749 bytes). Do not print the whole file. The analyzed copy resides in `.rea-tools/game-actions/shared-async.js`.

## Observed sender contract

Direct static inspection of module 41418 establishes that each send constructs an object with `action`, `payload`, and `sequence`, then calls `sender.sendToServer(GameAction, getServerId(), object)`. Its constructor initializes the counter to 1 and each send increments it before constructing the object: the first ordinary send therefore uses sequence 2. Reconnect sequence behavior outside this class remains unresolved.

Module 46581 in `shared.55f93e21f783c5fe21cb.js` exports the action enum as `$d`. The following IDs were cross-checked against sender method references. Payload types passed through from method parameters are unresolved unless stated below.

| Action | ID | Sender payload |
| --- | ---: | --- |
| ClickedDice | 2 | true |
| SelectedTile | 3 | supplied tile value |
| SelectedTiles | 4 | supplied tile values |
| SelectedPlayer | 5 | supplied player value |
| PassedTurn | 6 | true |
| SelectedCards | 7 | supplied card value |
| SelectedCardsState | 8 | supplied card-state value |
| BuyDevelopmentCard | 9 | true |
| WantToBuildRoad | 10 | true |
| ConfirmBuildRoad | 11 | supplied location value |
| ConfirmBuildRoadSkippingSelection | 12 | supplied location value |
| WantToBuildSettlement | 14 | true |
| ConfirmBuildSettlement | 15 | supplied location value |
| ConfirmBuildSettlementSkippingSelection | 16 | supplied location value |
| WantToBuildCity | 17 | true |
| ConfirmBuildCity | 18 | supplied location value |
| ConfirmBuildCitySkippingSelection | 19 | supplied location value |
| CreateTrade | 49 | supplied trade value |
| ExecuteTrade | 51 | object containing tradeId and playerToExecuteTradeWith |
| SelectedInitialPlacementIndex | 66 | supplied placement value |

Building uses separate request and confirmation commands. This suggests an intermediate selection state in the client/server contract, but the exact state transitions still require state-schema inspection or runtime evidence. No commands were sent to Colonist during this pass.

## Next evidence needed

1. Trace UI confirmation call sites to resolve the location and card payload shapes.
2. Resolve the numeric GameAction transport subtype and incoming game-state event ID.
3. Inspect initial state and diff application schemas, including player-specific hidden fields.
4. Use an isolated local protocol fixture to verify encoding and sequencing before attempting an original-client handshake.

These findings identify a client command contract. They do not establish that the downloaded client contains authoritative rules or an offline bot engine.

## Initial connection and build boundary

Serialized map follow-up: module 19590 constructs its map validator from tileHexStates, tileCornerStates, tileEdgeStates, and portEdgeStates directly on mapState. Module 13627 declares tile entries with x, y, type, diceNumber. Tile enums are Desert=0, Lumber=1, Brick=2, Wool=3, Grain=4, Ore=5 (additional expansion/sea types are outside the current serializer). Corner and edge schemas make owner/buildingType/type optional. Empty land fixtures therefore omit these fields rather than assigning the prototype's null ownership marker.

serializeLandMap in protocol-map.cjs emits numeric-keyed collections with contiguous locally assigned indexes; object collection choice is a local representation compatible with the observed for-in loader, not a proven production container type. Desert diceNumber is 0. Tests check collection counts, field names, empty occupancy, invalid resource/number rejection, and a MessagePack round trip. The generated fixture is original diagnostic data, has empty portEdgeStates, and is not a complete renderable BuildGame event. Harbors, sea border, settings, mechanic states, and runtime ordering remain unresolved.

Geometry follow-up: module 25204 enumerates each face's six corners and edges and each edge's two endpoints. Module 15123 assigns North=0 and South=1 to corner orientation; module 29267 assigns NorthWest=0, West=1, SouthWest=2 to edges. The schema declarations in those modules store x/y/z directly, while the map validators expose hexCorner/hexEdge wrappers. Do not assume the wrapper property names are serialized field names.

`protocol-map.cjs` independently reconstructs this geometry and interns shared coordinates into local indexes. The test verifies 19 faces, 54 corners, 72 edges, every face's consecutive-corner edge incidence, and shared borders. These are meaningful topology checks but do not prove original board ordering. Input face order controls local index assignment. No adapter to the playable prototype or full map-state serializer has been added.

Follow-up inspection of module 68736's constructor establishes additional reads: playerColor, timeLeftInState, gameState.currentState, diceState, mapState, bankState, playerStates, and tradeState. User records are joined to playerStates by numeric selectedColor; playOrder is stored separately. Optional experimental, development-card, and progress-card branches exist. The partial checker in tools/check-build-game.cjs records these structural expectations and checks identity consistency. Its expected primitive types and consistency checks are local validation assumptions; they are not a recovered full schema.

Module 19590's map loaders read hexFace.x/y, hexCorner.x/y/z, and hexEdge.x/y/z from stored map entries and build coordinate-to-index lookup tables. This means pixel coordinates from our prototype cannot be substituted directly. Exact coordinate conventions, collection layout, enum values, settings deserialization, and mechanic-state contents still need resolution before a renderable BuildGame fixture can be produced.

Module 55547 parses initial JSON text messages. Connected supplies userSessionId; SessionEstablished switches to binary decoding. Binary records decode to `{id,data}`; message ID 130 feeds a sequenced receiver. Its receiver's addData implementation (shared-bundle character offset 369616) reads `sequence`; downstream dispatch reads `type` and `payload`. The first observed sequence initializes the receiver's baseline. Later events wait for consecutive numbers; more than ten pending records or an entry waiting at least 500 milliseconds triggers recovery. These facts come from static code, not a packet capture.

The FirstGameState handler (offset 493732) consumes serverId, databaseGameId, gameSettingId, reconnectToken, shouldResetGameClient, and isReconnectingSession. This event is metadata, not the board snapshot. BuildGame is type 4; GameStateUpdated is type 91. The BuildGame UI code consumes gameState, gameSettings, playerUserStates, gameDetails, and playOrder. Its gameDetails reads include matchmakingMatchType, isRanked, and isDiscord. The initial gameState's settlement, city, road, and robber mechanic sections feed their respective UI controllers. These observed fields are not a complete schema or a proof that an arbitrary fixture can launch the UI.

`tools/protocol-lab.cjs` exercises the observed framing on loopback only with synthetic metadata and diagnostic diffs. The integration test exchanges actual WebSocket frames and verifies text/binary separation, event sequence numbers, the incoming event wrapper, an outgoing roll action, and diff application. The harness deliberately does not emit a fabricated BuildGame payload. It is not a compatible game server and does not implement the observed receiver's recovery policy or reconnect semantics.

## State merge and codec implementation

Further direct static inspection resolves module 54801's `p_` to function P, which applies each diff in order through function k (character offset 459245 in the shared bundle). Null deletes a key, arrays replace a value, objects recursively merge, and primitives overwrite. Missing object branches are created. `protocol.cjs` independently implements these rules for JSON-like state, additionally rejecting prototype keys and incompatible structures and copying arrays. These hardening choices are not claims about original behavior.

Vendor module 62777 delegates encoding to module 29337 with default options. The constructor exposes extensionCodec, context, maxDepth=100, initialBufferSize=2048, sortKeys=false, forceFloat32=false, ignoreUndefined=false, and forceIntegerToFloat=false. This supports the MessagePack identification, but does not identify the exact upstream package version. The local implementation uses pinned @msgpack/msgpack 2.8.0 and matches the independently specified roll-action byte fixture. No production capture or original-code execution has verified broader compatibility.

The same shared module contains a state-copy/filter function that masks other players' resource cards and private victory points and filters additional mechanic and chat fields. This is evidence of client-delivered filtering helpers, not proof that authoritative state execution or bots are available. Full initial state, visibility rules, and handshake requirements remain unresolved.

## Follow-up: placement and transport

Static UI inspection in `ui-game.ef351c1079ae7886fa5e.js` at character offsets approximately 85,500–95,000 shows edge highlights indexing `mapState.tileState.tileEdges[t]`, and corner highlights indexing `tileState.tileCorners[t]`. Their confirmation callbacks forward the highlight index into `confirmBuildRoad` or `confirmBuildSettlement`. These are numeric array indexes, not hex-coordinate objects. Our prototype's board numbering has not been matched to that ordering.

Module 36872 exports `lo` as the command subtype enum: `GameAction=1`. Its `Vd` export refers to constant `a=130`, resolving the top-level game-state message ID used by module 67908. The sender's direct route is 3. The envelope builder encodes the recipient as UTF-8 and writes its byte length in a one-byte field.

Module 11148's `gameStateUpdated` reads `diff` and `timeLeftInState`, applies the diff through the game controller, then selectively refreshes UI for changed sections including `currentState`, `playerStates`, `diceState`, `bankState`, `tradeState`, `mapState`, and mechanic-specific state. Module 68736 delegates actual merging to module 54801's `p_` export. Merge semantics, complete initial state, and per-player visibility are still unresolved; a generic recursive merge would be an unverified design choice.

The independently written `protocol.cjs` now implements a bounded subset of action construction, sender sequencing, and direct envelope framing. It rejects oversized recipients rather than reproducing the original builder's one-byte overflow. `tests/protocol.cjs` verifies framing against a manually specified MessagePack fixture, UTF-8 byte length, malformed input, action IDs, and sequencing. This proves the local implementation matches those specified bytes; it does not establish production codec compatibility or a successful original-client handshake. No downloaded code is executed, served, or copied into the implementation.
