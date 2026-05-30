# CouchParty — Current Status

## Legend

- ✅ Done
- 🔄 In Progress
- ❌ Not Started

---

## Phase 1: Project Foundation
- ✅ `package.json` with dependencies (express, socket.io, qrcode)
- ✅ `.gitignore` configured
- ✅ Dependencies installed

## Phase 2: Core Framework (`src/`)
- ✅ `GameBase.js` — Base class with lifecycle hooks, communication helpers, startLoop/stopLoop
- ✅ `PlayerManager.js` — Player identity, scores, O(1) socket lookups, crypto tokens, reconnection
- ✅ `BinaryProtocol.js` — 17-byte orientation packet encode/decode with input validation
- ✅ `GameLoader.js` — Plugin discovery and game instantiation

## Phase 3: Server (`server.js`)
- ✅ Express + Socket.IO initialization, static serving, QR code endpoint
- ✅ Socket event handlers (player:join, player:leave, game:start, game:input, game:orientation, disconnect)
- ✅ Room management (lobby, game_{id}, game_{id}_globalScreen)
- ✅ Game lifecycle orchestration with callback-based hooks (no function wrapping)
- ✅ Reconnection emits game:start for mid-game players
- ✅ Input validation (type check, size limit) on game:input
- ✅ Binary orientation buffer handling (ArrayBuffer/Buffer agnostic)
- ✅ maxPlayers/minPlayers enforcement

## Phase 4: Shared Client Scripts (`public/shared/`)
- ✅ `socket.js` — Connection management, token persistence, role-based navigation, connect_error handler, game:end custom event + delayed redirect
- ❌ `orientation.js` — Motion permissions + binary streaming
- ✅ `styles.css` — Common styles (player cards, buttons, QR, status indicators)

## Phase 5: Lobby Pages (`public/lobby/`)
- ✅ `globalScreen.html` — QR code, player list (live updates), game selection, error toast, fullscreen, game-end results overlay
- ✅ `controller.html` — Name input, join flow, leave button, error toast, reconnection support

## Phase 6: Game Engine Layer (`public/shared/lib/` + `GameBase`)
- ✅ `GameBase` — `startLoop(fps)`, `stopLoop()`, `startCountdown()`, `startRoundTimer()`, `getPlayerColor()`, `static PLAYER_COLORS`
- ✅ `Colors.js` — Player color palette, hexToRgba, getPlayerColor
- ✅ `Physics.js` — Collision detection (aabb, circle, circleRect, pointInRect, overlap), vector math (distance, angle, normalize, clamp, lerp, mapRange)
- ✅ `AssetLoader.js` — Image/audio preloading with progress callback, error handling
- ✅ `AudioManager.js` — Sound playback, mute/unmute, global volume, AudioContext unlock
- ✅ `GameClient.js` — DPI-aware canvas, aspect-ratio preserving resize, rAF loop, socket wiring (game:state, game:end, game:countdown, game:timer)
- ✅ `ControllerClient.js` — Joystick (nipplejs), buttons (touch+fallback), orientation (iOS permission), vibration, binary packet sending
- ✅ `UIOverlay.js` — ScoreboardOverlay, TimerOverlay, HealthBarOverlay, ProgressBarOverlay, CountdownOverlay, GameOverOverlay
- ✅ `ScreenShake.js` — Camera shake with decay, overlapping shake support
- ✅ `ParticleSystem.js` — Burst/trail/fountain/confetti presets, gravity, fade, drag
- ✅ `CharacterController.js` — Platformer + top-down modes, states (idle/running/jumping/falling/stunned), knockback, variable-height jump
- ✅ `PlayerManager` — `color` property on player objects, `static PLAYER_COLORS`
- ✅ `server.js` — `game:start` payload now includes `players` array with `{ id, name, color }`
- ✅ `socket.js` — Stores `cp_playerColor` in localStorage, dispatches `game:start` CustomEvent with full payload
- ✅ `game-plugin.md` — Added client engine section, updated best practices for engine modules
- ✅ `lifecycle.md` — Documented startCountdown, startRoundTimer, getPlayerColor, PLAYER_COLORS, new properties

## Phase 7: Framework Test Harness (`public/games/test-harness/`)
A dev-tool game that validates every framework feature — not a real game, but a living test suite.

### Core patterns tested
- ❌ **Server** (`game.js`) — Lifecycle hooks (onStart, onTick, onInput, onPlayerLeave, onOrientation, endGame), game loop (startLoop/stopLoop), communication (sendToPlayer, sendToGlobalScreen, broadcastToAll), scores (addPoints, endGame with winners/scores), orientation (enable/disable), idempotent endGame, multiple player counts
- ❌ **Global screen** (`globalScreen/index.html`) — Live state rendering, test selection and execution, pass/fail result display, heartbeat/FPS indicator, manual trigger for each test
- ❌ **Controller** (`controller/index.html`) — Input type buttons (tap, joystick, button), orientation display, private feedback display (test:feedback), broadcast display (test:broadcast)

### Tests the harness runs

| Test | Framework Feature |
|------|-------------------|
| `onStart` receives correct player data | PlayerManager + GameBase lifecycle |
| `onTick` loop runs at ~60 FPS with valid delta | startLoop/stopLoop |
| `onInput` delivers correct playerId | GameBase input routing |
| `sendToPlayer` reaches the right socket | Player messaging |
| `sendToGlobalScreen` isolates to display only | Room isolation |
| `broadcastToAll` reaches both roles | Room broadcast |
| `addPoints` persists to global scoreboard | Score persistence |
| `endGame` returns everyone to lobby with scores | Full game lifecycle |
| `onPlayerLeave` fires with correct id | Disconnect handling |
| `onOrientation` delivers valid floats | Binary protocol |
| `endGame` is idempotent (double-call safe) | _ended flag |

## Phase 8: Documentation
- ✅ ProjectSpec.md, TheIdea.md, ImplementationPlan.md
- ✅ Architecture docs (overview, terminology)
- ✅ Framework docs (game-plugin, lifecycle, player-manager, binary-protocol)
- ✅ Game design docs (racing, wood-cutting, cook-off, friend-bombs)
- ✅ docs/README.md index
- ✅ AGENTS.md, currently.md
- ✅ Root README.md with full project overview, architecture, developer guide, and status
- ✅ Integration testing guide (`docs/Development/testing.md`) + reusable test script (`test/lobby.js`)
- ✅ `game-plugin.md` — Documented engine workflow and module usage
- ✅ `lifecycle.md` — Documented new GameBase methods

---

## Code Quality Fixes (May 2026)

- ✅ `GameBase` — `_onEndGameCallback`/`_onAddPointsCallback` replace function wrapping, rename `player:points` → `game:points`
- ✅ `PlayerManager` — O(1) socketId→playerId Map, `crypto.randomUUID()` for tokens, `removePlayer` cleans up all 3 maps, `addGlobalScore` validates entry exists
- ✅ `BinaryProtocol` — `PACKET_SIZE` constant, NaN/undefined input validation
- ✅ `GameLoader` — Removed unused `__dirname`/`__filename`
- ✅ `server.js` — Reconnection emits `game:start` for mid-game players, `game:input` validated (type/size), binary orientation buffer handling fixed, `socket.join('lobby')` for fresh connections, `player:leave` handler added
- ✅ `socket.js` — Role-based navigation via `cp_role` localStorage, `connect_error` handler, `game:end` dispatches custom event + delayed redirect
- ✅ `lobby/globalScreen.html` — Role storage, metadata-based `updateStartButton`, error toast, fullscreen try-catch, game-end results overlay
- ✅ `lobby/controller.html` — Role storage, error toast, Leave Game button
- ✅ `docs/Framework/lifecycle.md` and `game-plugin.md` — Updated for new APIs
- ✅ Integration tests (`test/lobby.js`) + testing guide (`docs/Development/testing.md`)
- ✅ Switch from `setInterval` to `setTimeout`-based game loop to eliminate drift/stacking
- ✅ Orientation handler uses authenticated socket playerId instead of packet data
- ✅ Per-player `game:input` throttle (30ms cooldown)
- ✅ Removed dead `updatePlayerName` method from PlayerManager

---

## Immediate Next Steps

1. **Build Framework Test Harness** — `public/games/test-harness/` with game.js, globalScreen, controller pages
2. **Build orientation.js** — Client-side motion permissions + binary streaming (or integrate into `ControllerClient.js`)
3. **Run integration tests** — Verify nothing broke: `node test/lobby.js`
4. **Manual test** — Start server, open screens, verify lobby + game flow
