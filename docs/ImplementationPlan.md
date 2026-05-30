# CouchParty - Implementation Plan

## Overview

This document outlines the step-by-step implementation of the CouchParty game platform. The project follows the architecture defined in `ProjectSpec.md` and starts from scratch with no existing codebase.

**Current Status:** Phases 1-5 complete, engine layer and test harness planned  
**Target:** Fully functional platform with a Framework Test Harness that validates every feature.

---

## Phase 1: Project Foundation

### 1.1 Initialize Project
- [ ] Create `package.json` with dependencies:
  - `express` - HTTP server and static file serving
  - `socket.io` - Real-time communication
  - `qrcode` - Generate QR codes for easy phone joining
- [ ] Create `.gitignore` (ignore `node_modules/`, `.env`, etc.)
- [ ] Install dependencies

### 1.2 Create Folder Structure
```
CouchParty/
├── server.js
├── package.json
├── public/                     ← Static root
│   ├── lobby/
│   │   ├── globalScreen.html
│   │   └── controller.html
│   ├── shared/
│   │   ├── socket.js
│   │   ├── orientation.js
│   │   ├── styles.css
│   │   ├── nipplejs.min.js     ← Virtual joystick library
│   │   └── lib/                ← Game engine modules
│   │       ├── GameClient.js
│   │       ├── ControllerClient.js
│   │       ├── Physics.js
│   │       ├── AssetLoader.js
│   │       ├── AudioManager.js
│   │       ├── UIOverlay.js
│   │       ├── ScreenShake.js
│   │       ├── ParticleSystem.js
│   │       ├── CharacterController.js
│   │       └── Colors.js
│   └── games/
│       └── pong/
│           ├── game.js
│           ├── globalScreen/
│           │   ├── index.html
│           │   └── pong-globalScreen.js
│           └── controller/
│               ├── index.html
│               └── pong-controller.js
└── src/
    ├── PlayerManager.js
    ├── GameBase.js
    ├── BinaryProtocol.js
    └── GameLoader.js
```

---

## Phase 2: Core Framework (`src/`)

### 2.1 GameBase.js
Base class all games must extend.

**Features:**
- Constructor receives `id`, `name`, `description`, `minPlayers`, `maxPlayers`
- Lifecycle hooks: `onStart`, `onInput`, `onPlayerLeave`, `onTick`
- Helper methods: `sendToGlobalScreen`, `sendToPlayer`, `endGame`, `addPoints`
- Orientation toggle: `requireOrientation` flag

**Output:** `src/GameBase.js`

### 2.2 PlayerManager.js
Manages global player state independent of games.

**Features:**
- Assigns unique player IDs and reconnection tokens
- Tracks players in lobby vs. in-game
- Maintains global scoreboard
- Handles reconnection logic (token-based)

**Output:** `src/PlayerManager.js`

### 2.3 BinaryProtocol.js
Encodes/decodes binary orientation packets.

**Protocol (17 bytes):**
```
Byte 0:   0x01 (message type = orientation)
Bytes 1-4: playerId (Uint32, little-endian)
Bytes 5-8: alpha (Float32)
Bytes 9-12: beta (Float32)
Bytes 13-16: gamma (Float32)
```

**Methods:**
- `encodeOrientation(playerId, alpha, beta, gamma)` → ArrayBuffer
- `decodeOrientation(buffer)` → { playerId, alpha, beta, gamma }

**Output:** `src/BinaryProtocol.js`

### 2.4 GameLoader.js
Auto-discovers and loads game modules.

**Features:**
- Scans `public/games/*/game.js` on server start
- Builds games registry with metadata
- Creates game instances on demand
- Provides game list to lobby

**Output:** `src/GameLoader.js`

---

## Phase 3: Server (`server.js`)

### 3.1 Core Setup
- Initialize Express for static file serving
- Initialize Socket.IO with CORS configured for local network
- Load all games via GameLoader

### 3.2 Socket Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `player:join` | Client → Server | Player enters name, joins lobby |
| `player:reconnect` | Client → Server | Player reconnects with token |
| `lobby:players` | Server → Global Screen | Broadcasts current player list |
| `lobby:games` | Server → Client | Sends available games list |
| `game:start` | Global Screen → Server | Host starts selected game |
| `game:start` | Server → All | Notifies all to navigate to game |
| `game:input` | Controller → Server | Player sends game input |
| `game:orientation` | Controller → Server | Binary orientation data |
| `game:state` | Server → Global Screen | Broadcasts game state |
| `game:end` | Server → All | Game finished, return to lobby |

### 3.3 Room Management
- `lobby` - All connected players in pre-game state
- `game_{id}_globalScreen` - Global screen display for a specific game
- `player_{id}` - Individual player socket room

### 3.4 Game Lifecycle
1. Instantiate game class
2. Move players from lobby to game room
3. Call `game.onStart({ players })`
4. Enable orientation if requested
5. On `endGame`, update scores, move players back to lobby

**Output:** `server.js`

---

## Phase 4: Shared Client Scripts (`public/shared/`)

### 4.1 socket.js
Socket.IO connection helper.

**Features:**
- Auto-reconnect with exponential backoff
- Join/leave lobby flow
- Token persistence in localStorage
- Common event handlers (error, disconnect, reconnect)

**Output:** `public/shared/socket.js`

### 4.2 orientation.js
Gyroscope/accelerometer helper.

**Features:**
- iOS 13+ permission request wrapper
- DeviceOrientation listener
- Toggle streaming on/off
- Send binary packets when enabled

**Output:** `public/shared/orientation.js`

### 4.3 styles.css
Common CSS for lobby and shared components.

**Includes:**
- Player card styling
- QR code container
- Button styles
- Responsive layout for phone screens

**Output:** `public/shared/styles.css`

### 4.4 Virtual Joystick (nipplejs)
Using [nipplejs](https://github.com/yoannrodrigo/nipplejs) - a lightweight virtual joystick.

**Output:** `public/shared/nipplejs.min.js` (CDN or bundled)

---

## Phase 5: Lobby Pages (`public/lobby/`)

### 5.1 Global Screen Lobby (`globalScreen.html`)
**Features:**
- Display QR code linking to controller page
- Show current player list (updates in real-time)
- Display available games list
- "Start Game" button (enabled when min players reached)
- Fullscreen toggle

**Output:** `public/lobby/globalScreen.html`

### 5.2 Controller Lobby (`controller.html`)
**Features:**
- Name input field
- Large "Join" button
- Connection status indicator
- Auto-redirects after game ends

**Output:** `public/lobby/controller.html`

---

## Phase 6: Game Engine Layer (`public/shared/lib/` + `GameBase` enhancements)

### Background

Every game currently rewrites the same boilerplate from scratch: canvas setup, game loop, input handling, score display, countdown, game-over screens, collision detection, and more. Phase 6 introduces a shared **client-side game engine** — a set of opt-in base classes and utility modules — plus server-side enhancements to `GameBase`. The goal is to eliminate repetitive code while keeping the "no build step, no framework overhead" philosophy: modules are imported only when needed.

**Design Principles:**
- **Opt-in, not mandatory** — games can use the engine or build their own
- **Zero build step** — plain ES modules served directly from `public/shared/lib/`
- **Thin, focused modules** — each module solves one problem, no monolithic engine
- **Extend, don't configure** — games import and extend base classes with hooks

---

### 6.1 Server-Side: GameBase Enhancements (`src/GameBase.js`)

Add built-in utilities to the base class that 2+ games need, removing boilerplate from every `game.js`.

**Features:**

| Method | Purpose |
|--------|---------|
| `startLoop(fps)` | Starts a `setInterval` game loop at given FPS, calls `onTick(deltaMs)` each frame. Stored in `this._loopTimer`. |
| `stopLoop()` | Clears the interval and resets `this._loopTimer`. |
| `startCountdown(seconds, callback)` | Emits `game:countdown` to the global screen each second (for "3-2-1-GO!" overlay). Calls `callback` when countdown reaches 0. |
| `startRoundTimer(seconds, callback)` | Emits `game:timer` events for round-based play. Calls `callback` when time expires. |
| `getPlayerColor(index)` | Returns a hex color from a fixed palette by player index. |

**Static Constants:**
```javascript
static PLAYER_COLORS = ['#e94560', '#0f3460', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4'];
```

**No new lifecycle hooks** — games simply call `this.startLoop(60)` in `onStart` instead of writing their own `setInterval` + `Date.now()` boilerplate.

**Output:** `src/GameBase.js` (modified)

---

### 6.2 Client-Side: Module Overview (`public/shared/lib/`)

```
public/shared/lib/
├── GameClient.js          ← Base: global screen canvas + loop + overlays
├── ControllerClient.js    ← Base: phone input + orientation + vibration
├── Physics.js             ← Collision detection, vector math, clamping
├── AssetLoader.js         ← Preload images + audio with progress
├── AudioManager.js        ← Play sounds, mute, volume
├── UIOverlay.js           ← Scoreboard, timer, health bars, countdown, game over
├── ScreenShake.js         ← Camera shake effect
├── ParticleSystem.js      ← Burst/trail/fountain particle effects
├── CharacterController.js ← Movement, state machine, physics body
└── Colors.js              ← Player color palette + helpers
```

Each module is detailed below.

---

### 6.3 Colors.js

A static palette and helpers for assigning consistent player colors across all games.

```javascript
export const COLORS = ['#e94560', '#0f3460', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4'];

export function getPlayerColor(index) {
  return COLORS[index % COLORS.length];
}

export function getPlayerColorRgba(index, alpha) {
  // Convert hex to rgba string
}
```

**Output:** `public/shared/lib/Colors.js`

---

### 6.4 Physics.js

Pure functions for 2D collision detection and vector math. Used by both server-side game logic and client-side rendering.

**Collision:**
- `aabbOverlap(a, b)` — Axis-aligned bounding box overlap test
- `circleOverlap(a, b)` — Circle-circle overlap test
- `circleRectOverlap(c, r)` — Circle-rectangle overlap test
- `pointInRect(px, py, rect)` — Point-in-rectangle test
- `overlap(rect1, rect2)` — Returns overlap amount for push-out resolution

**Vector Math:**
- `distance(x1, y1, x2, y2)` — Euclidean distance
- `angle(x1, y1, x2, y2)` — Angle between two points
- `normalize(x, y)` — Returns unit vector `{ x, y }`
- `magnitude(x, y)` — Vector length
- `clamp(value, min, max)` — Clamp to range
- `lerp(a, b, t)` — Linear interpolation
- `mapRange(value, inMin, inMax, outMin, outMax)` — Remap from one range to another

**Output:** `public/shared/lib/Physics.js`

---

### 6.5 AssetLoader.js

Preloads images and audio files with progress tracking. Games call this once at startup to load all their assets before gameplay begins.

```javascript
const loader = new AssetLoader();
await loader.loadImages({
  'ball': '/games/pong/sprites/ball.png',
  'paddle': '/games/pong/sprites/paddle.png',
});
await loader.loadAudio({
  'hit': '/games/pong/sounds/hit.wav',
  'score': '/games/pong/sounds/score.wav',
});
// Then access via: loader.images.get('ball')
```

**Features:**
- `loadImages({ name: url, ... })` → `Promise` resolves when all images are loaded
- `loadAudio({ name: url, ... })` → `Promise` resolves when all audio is loaded
- `onProgress(current, total)` callback option
- Caches loaded assets; subsequent loads return immediately
- Handles load errors gracefully (logs warning, continues)

**Output:** `public/shared/lib/AssetLoader.js`

---

### 6.6 AudioManager.js

Sound playback system that works around browser autoplay policies.

```javascript
const audio = new AudioManager();
audio.addSounds({ 'hit': '/games/pong/sounds/hit.wav' });
audio.play('hit');
audio.setVolume(0.5);
audio.toggleMute();
```

**Features:**
- `addSounds({ name: url, ... })` — Register preloaded sounds
- `play(name)` — Play a sound effect
- `setVolume(0-1)` — Global volume
- `mute()` / `unmute()` / `toggleMute()` — Mute control
- `setVolume(name, 0-1)` — Per-sound volume
- Creates `AudioContext` on first user interaction to satisfy autoplay restrictions

**Output:** `public/shared/lib/AudioManager.js`

---

### 6.7 GameClient.js

Base class for all **global screen** game pages. Eliminates the canvas setup, game loop, resize handling, and common socket event listeners that every game currently rewrites.

```javascript
export class GameClient {
  constructor(canvasId, options = {}) {
    // Options: { width, height, virtualWidth, virtualHeight, backgroundColor }
    // Auto-sets up canvas with DPI awareness
    // Adds window resize listener that maintains aspect ratio
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.state = {};
    this.time = 0;
  }

  setSocket(socket) {
    this.socket = socket;
    // Auto-wires: game:state → onState, game:end → showGameOver
    // game:countdown → showCountdown, game:timer → updateTimer
  }

  start() {
    // Launches requestAnimationFrame loop
    // Calls onTick(deltaMs) + render() each frame
  }

  stop() {
    // Cancels rAF
  }

  // Hooks for games to override:
  onTick(deltaMs) {}
  onState(state) { this.state = state; }
  onGameEnd(results) {}
  onCountdown(remaining) {}
  render() { this.ctx.clearAll(); }

  // Built-in overlays (toggleable):
  showCountdown(seconds) {}  // "3, 2, 1, GO!" animation
  showGameOver(results) {}   // Winner + scores + "Back to Lobby" button
  hideOverlays() {}
}
```

**Features:**
- DPI-aware canvas sizing: respects `devicePixelRatio` for sharp rendering on Retina/HiDPI displays
- Aspect-ratio-preserving resize: maintains a virtual coordinate system (e.g., 800×600) regardless of actual canvas size
- Built-in socket listeners for `game:state`, `game:end`, `game:countdown`, `game:timer`
- Countdown overlay with "3, 2, 1, GO!" animation
- Game-over overlay with winner announcement, final scores, and "Back to Lobby" button
- `onState(state)` hook called every time server state arrives; stores in `this.state`
- `onTick(deltaMs)` called every animation frame for smooth interpolation

**Output:** `public/shared/lib/GameClient.js`

---

### 6.8 ControllerClient.js

Base class for all **phone controller** pages. Eliminates the joystick setup, button binding, orientation handling, and input emitting boilerplate.

```javascript
export class ControllerClient {
  constructor(config = {}) {
    // config: { joystick: true, buttons: ['A', 'B'], orientation: false }
    this.input = { x: 0, y: 0, buttons: {}, tilt: null };
  }

  setSocket(socket) {
    this.socket = socket;
    // Auto-listens for enableOrientation/disableOrientation events
  }

  createJoystick(zoneId, options = {}) {
    // Wraps nipplejs, auto-emits game:input on move/drag/end
    // Returns joystick instance for custom event binding
  }

  createButton(id, element, options = {}) {
    // Binds touchstart/touchend (or mousedown/up fallback)
    // Auto-emits game:input with { type: 'button', button: id, pressed: true/false }
  }

  enableOrientation() {
    // iOS 13+ permission request
    // Adds deviceorientation listener
    // Sends binary packets via game:orientation when game requires it
  }

  disableOrientation() {
    // Removes deviceorientation listener
  }

  vibrate(duration) {
    if (navigator.vibrate) navigator.vibrate(duration);
  }

  sendInput(data) {
    if (this.socket) this.socket.emit('game:input', data);
  }
}
```

**Features:**
- Joystick factory: wraps nipplejs with sensible defaults, emits `{ type: 'joystick', x, y }` on `game:input`
- Button factory: touch-aware button binding, emits `{ type: 'button', button, pressed }`
- Orientation manager: handles iOS permission flow, binary packet encoding, and server opt-in (`enableOrientation` / `disableOrientation` socket events)
- Vibration helper: wraps `navigator.vibrate` with existence check
- Connection status: shows disconnected overlay when socket drops

**Output:** `public/shared/lib/ControllerClient.js`

---

### 6.9 UIOverlay.js

Reusable HUD components that games compose onto their global screen. Each overlay is a class that receives canvas context and game state, and renders itself.

| Class | Purpose |
|-------|---------|
| `ScoreboardOverlay` | Displays player scores with name labels and animated bars. Accepts `{ playerId: score }` or `[{ playerId, score, name }]`. Positions players horizontally or in corners. |
| `TimerOverlay` | Shows MM:SS countdown. Flashes red when under 10 seconds. Optionally shows elapsed time instead of countdown. |
| `HealthBarOverlay` | HP/death bars for each player. Configurable colors, orientation (horizontal/vertical), max HP. |
| `ProgressBarOverlay` | Generic progress bar (tree HP, cooking progress, race position). Label + fill level + color. |
| `CountdownOverlay` | Large centered "3, 2, 1, GO!" with scale-up animation between steps. |
| `GameOverOverlay` | Semi-transparent backdrop + winner name, final scores table, "Back to Lobby" button. |

```javascript
import { ScoreboardOverlay, TimerOverlay } from '/shared/lib/UIOverlay.js';

const scores = new ScoreboardOverlay(ctx, { x: 10, y: 10, width: 300 });
const timer = new TimerOverlay(ctx, { x: 400, y: 10 });

// In render():
scores.update(game.state.scores);
timer.update(game.state.timeRemaining);
scores.render();
timer.render();
```

**Output:** `public/shared/lib/UIOverlay.js`

---

### 6.10 ScreenShake.js

A screen shake effect for hit feedback and explosions.

```javascript
import { ScreenShake } from '/shared/lib/ScreenShake.js';

const shake = new ScreenShake();

// On hit:
shake.shake(8, 300); // intensity: 8px, duration: 300ms

// In render(), before drawing game objects:
shake.apply(ctx);
// ... draw everything ...
shake.reset(ctx);
```

**Features:**
- `shake(intensity, duration)` — Start a shake with given pixel intensity (in virtual pixels) and duration in ms
- `apply(ctx)` — Call before drawing; applies random offset to canvas transform
- `reset(ctx)` — Call after drawing; restores canvas transform
- `update(dt)` — Decays intensity over duration; call each tick
- Supports chaining multiple shakes (overlapping)
- `isActive` property for checking if shake is still going

**Output:** `public/shared/lib/ScreenShake.js`

---

### 6.11 ParticleSystem.js

Lightweight particle effects for explosions, celebrations, item pickups, and ambient effects.

```javascript
import { ParticleSystem } from '/shared/lib/ParticleSystem.js';

const particles = new ParticleSystem();

// Burst explosion:
particles.emit({
  x: 200, y: 300,
  count: 30,
  speed: { min: 50, max: 150 },
  angle: { min: 0, max: Math.PI * 2 },
  color: ['#ff0', '#f80', '#f00'],
  size: { min: 2, max: 6 },
  lifetime: { min: 300, max: 800 },
  gravity: 100,
  fade: true,
});

// In tick: particles.update(deltaMs);
// In render: particles.render(ctx);
```

**Features:**
- `emit(config)` — Spawn a burst of particles with given configuration
- `update(dt)` — Update all alive particles (position, velocity, life, alpha, size)
- `render(ctx)` — Draw all alive particles
- Particle properties: position, velocity, lifetime, age, color, size, alpha, gravity, drag
- Built-in emitter presets: `burst`, `trail`, `fountain`, `confetti`
- `clear()` — Remove all particles instantly
- `getCount()` — Number of alive particles (for performance monitoring)

**Output:** `public/shared/lib/ParticleSystem.js`

---

### 6.12 CharacterController.js

A state machine + physics body for player-controlled characters in games like Friend Bombs, Racing, and Wood Cutting. Opt-in — only games with player characters import this.

```javascript
import { CharacterController } from '/shared/lib/CharacterController.js';

const character = new CharacterController({
  mode: 'platformer',  // or 'topdown'
  maxSpeed: 300,
  acceleration: 800,
  friction: 600,
  jumpVelocity: -400,
  gravity: 1200,
  width: 32,
  height: 48,
});

// Each tick:
character.update(dt, { x: input.x, jump: input.buttons.A });

// Read state:
const { x, y, vx, vy, state, facing } = character.getState();
// state: 'idle' | 'running' | 'jumping' | 'falling' | 'stunned'
// facing: 'left' | 'right'

// Apply forces:
character.applyKnockback(angle, force);
character.stun(500); // Stun for 500ms
```

**Features:**

**Platformer Mode** (Friend Bombs):
- Horizontal acceleration + friction for smooth movement
- Jump with variable height (cut jump early by releasing button)
- Gravity and ground detection
- One-way platform support (can jump up through, fall down through)
- Knockback with stun state (Smash Bros-style: lower HP = more knockback)

**Top-Down Mode** (Racing):
- 8-direction movement with constant speed or acceleration
- Optional turning radius for vehicle feel
- Collision with walls (push-out)

**States:**
- `idle` — No movement input, on ground
- `running` — Movement input, on ground
- `jumping` — Airborne with upward velocity
- `falling` — Airborne with downward velocity
- `stunned` — Disabled control for duration (hit reaction)

**Collision:**
- `setPosition(x, y)` — Teleport to position
- `getBounds()` → `{ x, y, width, height }` for collision checks
- `resolveCollision(overlap, normal)` — Push-out from obstacles
- `isOnGround` property

**Output:** `public/shared/lib/CharacterController.js`

---

### 6.13 Implementation Order (Sub-Phases)

| Order | Module | Notes |
|-------|--------|-------|
| 6.1 | `GameBase` enhancements | `startLoop`, `stopLoop`, `startCountdown`, `startTimer`, `getPlayerColor` |
| 6.2 | `Colors.js` | Simple data + helpers, no dependencies |
| 6.3 | `Physics.js` | Pure functions, no dependencies |
| 6.4 | `AssetLoader.js` | Independent module |
| 6.5 | `AudioManager.js` | Sound playback, autoplay handling |
| 6.6 | `GameClient.js` | Core base class for global screen clients |
| 6.7 | `UIOverlay.js` | HUD components (scoreboard, timer, etc.) |
| 6.8 | `ScreenShake.js` | Independent, used within `GameClient.render()` |
| 6.9 | `ParticleSystem.js` | Independent, used within `GameClient.render()` |
| 6.10 | `ControllerClient.js` | Core base class for phone controllers |
| 6.11 | `CharacterController.js` | Depends on `Physics.js` |
| 6.12 | `server.js` update | Pass `player.color` on join |
| 6.13 | Update `game-plugin.md` | Document new engine workflow |
| 6.14 | Update `lifecycle.md` | Document new `GameBase` methods |

---

## Phase 7: Framework Test Harness (`public/games/test-harness/`)

A developer dashboard game for visually monitoring, exercising, and validating every framework and engine feature during development. Built after Phase 6 is complete.

### Design Goals

- **Live monitoring** — Show joystick position, orientation angles, and input counters for every connected controller on the global screen in real-time
- **Round-trip validation** — Press GS buttons to trigger framework features (sendToPlayer, broadcast, orientation streaming, countdowns) and observe the visual result: messages appearing on controllers, angles updating, overlays rendering
- **Engine feature exercise** — Press GS buttons to instantiate Phase 6 modules (Physics, Particles, ScreenShake, Audio, Character, AssetLoader, UIOverlay) and see their output rendered in a dedicated canvas area
- **Developer judgement** — The developer watches and confirms correctness, rather than reading automated pass/fail assertions
- **Multi-player** — works with 1-4 players

### 7.1 Server Logic (`game.js`)

Extends GameBase like any game. Key responsibilities:

- **Input tracking**: Maintains `playerInputs` map with live counters (joystick moves, taps, button presses) per player
- **Orientation forwarding**: Receives binary orientation packets via `onOrientation`, streams α/β/γ values to GS in real-time
- **Test action dispatcher**: `onInput` routes `{ type: 'test', action: '...' }` messages from GS buttons to the appropriate GameBase method:

| Action | What the server does |
|--------|---------------------|
| `sendToPlayer` | `sendToPlayer(targetId, 'test:feedback', { msg })` |
| `sendToGS` | `sendToGlobalScreen('test:gsMessage', { msg })` |
| `broadcast` | `broadcastToAll('test:broadcast', { msg })` |
| `enableOrientation` | `enableOrientation()` |
| `disableOrientation` | `disableOrientation()` |
| `countdown` | `startCountdown(3)` |
| `timer` | `startRoundTimer(30)` |

Minimal server logic — mostly pass-through. Engine feature tests run entirely client-side in the GS page.

### 7.2 Global Screen Dashboard (`globalScreen/index.html`)

Four distinct UI sections:

**Player Monitor (always visible)**
A card per connected player showing:
- Name and connection dot
- Live joystick x/y (updated via `test:joystick`)
- Live orientation α/β/γ (updated via `test:orientation`)
- Input counters: tap count, joystick move count, button press count per button (updated via `test:inputCounts`)

**Communication Tests (button grid)**
One button per framework feature:
- Send to Player 1 / Send to Player 2 — targets specific players
- Send to Global Screen — tests room isolation
- Broadcast — tests multi-room delivery
- Orientation On / Orientation Off — toggles binary streaming
- Countdown 3s / Round Timer 30s — tests countdown and timer overlays

**Engine Feature Tests (button grid)**
One button per Phase 6 module, rendered in a canvas area:
- Physics — runs collision demos (aabb, circle, circleRect)
- Particles — spawns burst/fountain/confetti presets
- Screen Shake — triggers shake at configurable intensity
- Audio — plays test sounds (requires user gesture)
- Character — spawns a character controllable via joystick
- Asset Loader — loads a test asset with progress display
- UIOverlay — cycles through Scoreboard/Timer/HealthBar/GameOver demos

**Engine Test Output (canvas)**
A `<canvas>` element that appears when an engine test is active. Draws the engine module's output. Clears when dismissed.

**Live Event Log (scrolling)**
Timestamped feed of all test events. DOM-based, auto-scrolls.

### 7.3 Controller Page (`controller/index.html`)

Four functional areas:

- **Joystick Zone** — Full-screen nipplejs joystick with live x/y readout. Emits `game:input { type: 'joystick', x, y }`.
- **Input Buttons** — Tap zone (emits `{ type: 'tap', x, y }`), A and B buttons (emit `{ type: 'button', button: 'A'|'B' }`).
- **Orientation Display** — Shows α/β/γ values when streaming is enabled. Uses `orientation.js` for iOS permission flow and binary encoding.
- **Message Inbox** — Displays `test:feedback` (noted "Private") and `test:broadcast` (noted "Broadcast") messages from server. Each appears as a styled toast with auto-dismiss.

### 7.4 Event Protocol

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `test:joystick` | Server → GS | `{ playerId, x, y }` | Live joystick position |
| `test:orientation` | Server → GS | `{ playerId, alpha, beta, gamma }` | Live orientation angles |
| `test:inputCounts` | Server → GS | `{ playerId: { taps, joystickMoves, buttons } }` | Input statistics |
| `test:feedback` | Server → Controller | `{ msg }` | Private message test |
| `test:gsMessage` | Server → GS | `{ msg }` | GS-only message test |
| `test:broadcast` | Server → All | `{ msg }` | Broadcast message test |
| `test:log` | Server → GS | `{ timestamp, msg }` | Event log entry |
| `game:input` | GS → Server | `{ type: 'test', action, ... }` | Test action commands |

### 7.5 Implementation (after Phase 6 is complete)

| Step | File | What to build |
|------|------|---------------|
| 1 | `game.js` | Game class with input tracking, orientation forwarding, test action dispatch |
| 2 | `controller/index.html` | Joystick (nipplejs), tap zone, A/B buttons, orientation display, message inbox |
| 3 | `globalScreen/index.html` | Player monitor, comm test buttons, engine test buttons, canvas area, event log |
| 4 | — | Wire each engine test to import and run its corresponding Phase 6 module |

### 7.6 Relationship to Integration Tests

- `test/lobby.js` = **automated** regression suite (Node.js, no browser)
- **Test Harness** = **manual** visual validation tool (browser-based)
- Both are needed: automation catches regressions, the harness lets developers explore and debug round-trip communication and engine rendering

---

## Phase 8: Documentation

### 8.1 Architecture Overview
**Output:** `docs/ARCHITECTURE.md`

**Contents:**
- System overview diagram
- Component responsibilities
- Data flow between server, global screen, and phones

### 8.2 Game Plugin Contract
**Output:** `docs/GAME_PLUGIN.md`

**Contents:**
- Required file structure for a game
- GameBase API reference
- Example test-harness implementation
- Best practices for game developers

### 8.3 Socket Events Reference
**Output:** `docs/SOCKET_EVENTS.md`

**Contents:**
- Complete list of all socket events
- Payload schemas for each event
- Direction (client/server) and purpose

### 8.4 Update Main README
- Add project overview
- Include quick-start instructions
- Link to detailed documentation

### 8.5 Update Framework Docs
- `game-plugin.md` — Document engine workflow
- `lifecycle.md` — Document startLoop, stopLoop, callback hooks

---

## Implementation Order

| Phase | Task | Priority |
|-------|------|----------|
| 1 | Project foundation | Required |
| 2 | Core framework | Required |
| 3 | Server | Required |
| 4 | Shared client scripts | Required |
| 5 | Lobby pages | Required |
| 6 | Game engine layer | Required (before games) |
| 7 | Framework Test Harness | Required (dev dashboard + visual validation) |
| 8 | Documentation | Ongoing |

---

## Notes

- **Virtual Joystick:** Using nipplejs for cross-platform compatibility (future games)
- **Binary Protocol:** Implemented but only activated for games that request it
- **Zero Build Step:** All code is plain JS/HTML served directly; no bundler required
- **Documentation First:** Each system should be documented as it is built
- **Game Engine Philosophy:** The `public/shared/lib/` modules are opt-in, not mandatory. Games can import individual modules or build from scratch — the engine eliminates boilerplate without imposing a framework.
- **Client-Side ES Modules:** All `public/shared/lib/` files are served as ES modules (`<script type="module">`), keeping the zero-build-step promise.
- **CharacterController is Game-Specific:** The `CharacterController.js` module provides platformer and top-down movement patterns but will likely need per-game customization. It's a starting point, not a finished solution.
