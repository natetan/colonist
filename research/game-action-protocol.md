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

## Follow-up: placement and transport

Static UI inspection in `ui-game.ef351c1079ae7886fa5e.js` at character offsets approximately 85,500–95,000 shows edge highlights indexing `mapState.tileState.tileEdges[t]`, and corner highlights indexing `tileState.tileCorners[t]`. Their confirmation callbacks forward the highlight index into `confirmBuildRoad` or `confirmBuildSettlement`. These are numeric array indexes, not hex-coordinate objects. Our prototype's board numbering has not been matched to that ordering.

Module 36872 exports `lo` as the command subtype enum: `GameAction=1`. Its `Vd` export refers to constant `a=130`, resolving the top-level game-state message ID used by module 67908. The sender's direct route is 3. The envelope builder encodes the recipient as UTF-8 and writes its byte length in a one-byte field.

Module 11148's `gameStateUpdated` reads `diff` and `timeLeftInState`, applies the diff through the game controller, then selectively refreshes UI for changed sections including `currentState`, `playerStates`, `diceState`, `bankState`, `tradeState`, `mapState`, and mechanic-specific state. Module 68736 delegates actual merging to module 54801's `p_` export. Merge semantics, complete initial state, and per-player visibility are still unresolved; a generic recursive merge would be an unverified design choice.

The independently written `protocol.cjs` now implements a bounded subset of action construction, sender sequencing, and direct envelope framing. It rejects oversized recipients rather than reproducing the original builder's one-byte overflow. `tests/protocol.cjs` verifies framing against a manually specified MessagePack fixture, UTF-8 byte length, malformed input, action IDs, and sequencing. This proves the local implementation matches those specified bytes; it does not establish production codec compatibility or a successful original-client handshake. No downloaded code is executed, served, or copied into the implementation.
