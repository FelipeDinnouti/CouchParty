# CouchParty - Implementation Plan

## Overview

This document outlines the step-by-step implementation of the CouchParty game platform. The project follows the architecture defined in `ProjectSpec.md` and starts from scratch with no existing codebase.

**Current Status:** Not started  
**Target:** Fully functional platform with one test game (Pong) as proof of concept.

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
│   │   └── nipplejs.min.js     ← Virtual joystick library
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
Bytes 1-4: playerId (Uint32, big-endian)
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

## Phase 6: Test Game - Pong (`public/games/pong/`)

### 6.1 Server Logic (`game.js`)
**Game Rules:**
- Single match between 2 players
- First to 5 points wins
- Ball speed increases after each hit

**Server-Side:**
- Tracks: ball position/velocity, paddle positions, scores
- Handles: collision detection, scoring, win condition
- Runs tick loop at 60 FPS

**Player Controls:**
- Joystick Y-axis controls paddle position

**Output:** `public/games/pong/game.js`

### 6.2 Global Screen Display (`globalScreen/index.html`, `pong-globalScreen.js`)
**Features:**
- Canvas rendering of game field
- Two paddles, ball, center line
- Score display for both players
- Player name labels above paddles
- Winner announcement overlay

**Output:**
- `public/games/pong/globalScreen/index.html`
- `public/games/pong/globalScreen/pong-globalScreen.js`

### 6.3 Phone Controller (`controller/index.html`, `pong-controller.js`)
**Features:**
- Full-screen virtual joystick (nipplejs)
- Y-axis only (vertical paddle control)
- Visual feedback on connection
- Vibrate on score (when ball goes past opponent)

**Output:**
- `public/games/pong/controller/index.html`
- `public/games/pong/controller/pong-controller.js`

---

## Phase 7: Documentation

### 7.1 Architecture Overview
**Output:** `docs/ARCHITECTURE.md`

**Contents:**
- System overview diagram
- Component responsibilities
- Data flow between server, global screen, and phones

### 7.2 Game Plugin Contract
**Output:** `docs/GAME_PLUGIN.md`

**Contents:**
- Required file structure for a game
- GameBase API reference
- Example minimal game implementation
- Best practices for game developers

### 7.3 Socket Events Reference
**Output:** `docs/SOCKET_EVENTS.md`

**Contents:**
- Complete list of all socket events
- Payload schemas for each event
- Direction (client/server) and purpose

### 7.4 Update Main README
- Add project overview
- Include quick-start instructions
- Link to detailed documentation

---

## Implementation Order

| Phase | Task | Priority |
|-------|------|----------|
| 1 | Project foundation | Required |
| 2 | Core framework | Required |
| 3 | Server | Required |
| 4 | Shared client scripts | Required |
| 5 | Lobby pages | Required |
| 6 | Pong test game | Proof of concept |
| 7 | Documentation | Ongoing |

---

## Notes

- **Virtual Joystick:** Using nipplejs for cross-platform compatibility
- **No Motion Controls Yet:** Pong proof-of-concept uses only joystick; motion can be added later
- **Binary Protocol:** Implemented but only activated for games that request it
- **Zero Build Step:** All code is plain JS/HTML served directly; no bundler required
- **Documentation First:** Each system should be documented as it is built
