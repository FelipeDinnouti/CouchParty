# CouchParty

**A local web game platform to play with friends on a shared network.**

Bring Your Own Phone — no controllers, no app downloads, no accounts. Just a browser.

```
npm install
npm run dev
```

Open `http://localhost:3000` on your TV, scan the QR code with your phone, and play.

---

## How It Works

A lightweight Node.js server runs on any laptop in your living room. The TV or monitor shows the **global screen** that everyone watches. Each player opens a link on their phone's browser and it becomes a **game controller** — joysticks, buttons, even motion controls.

All communication happens over your home Wi-Fi via Socket.IO. No internet required.

### Device Roles

| Device | Role |
|--------|------|
| **Laptop** (server) | Runs the Node.js server, game logic, and Socket.IO broker |
| **TV/Monitor** (global screen) | Shows the shared game view — the big display everyone watches |
| **Phones** (controllers) | Each player's personal input device — sends taps, tilts, and button presses |

---

## Quick Start

### Prerequisites

- Node.js 18+
- A local Wi-Fi network
- A laptop and a TV/monitor (or just use the laptop screen)
- Smartphones for each player

### Setup

```bash
git clone <repo-url>
cd CouchParty
npm install
npm run dev
```

The server starts on `http://localhost:3000`.

### Play

1. Open `http://localhost:3000` on your TV/laptop — the lobby shows a QR code
2. Friends scan the QR code on their phones (or open the URL manually) → enter a name → they appear on the TV
3. Select a game from the list on the TV and click **Start Game**
4. Everyone's browser auto-navigates to the game — global screen renders on the TV, controllers show input on each phone
5. Play! Scores accumulate globally across multiple games
6. When a game ends, everyone returns to the lobby for the next round

> **Tip:** On a TV stick (Chromecast, Xiaomi), click the **Fullscreen** button in the top-right corner.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  server.js                       │
│         Express + Socket.IO + GameLoader         │
└────────┬────────────┬───────────────┬────────────┘
         │            │               │
    ┌────▼────┐ ┌────▼────┐    ┌─────▼─────┐
    │ GameBase│ │PlayerMgr│    │BinaryProto│
    └────┬────┘ └────┬────┘    └───────────┘
         │           │
         └─────┬─────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼────┐ ┌──▼───┐ ┌────▼────┐
│ Global  │ │Phone │ │ Game    │
│ Screen  │ │Ctrl's│ │Sessions │
└─────────┘ └──────┘ └─────────┘
```

### Core Components

| Component | File | Purpose |
|-----------|------|---------|
| **GameBase** | `src/GameBase.js` | Abstract base class all games extend. Provides lifecycle hooks, communication helpers, and orientation control |
| **PlayerManager** | `src/PlayerManager.js` | Player identity, lobby/in-game tracking, reconnection tokens, global scoreboard |
| **BinaryProtocol** | `src/BinaryProtocol.js` | Compact 17-byte binary encoding for 60Hz gyroscope/accelerometer data |
| **GameLoader** | `src/GameLoader.js` | Auto-discovers game plugins in `public/games/*/game.js` on startup |
| **Server** | `server.js` | Express static serving, Socket.IO event routing, game lifecycle orchestration, QR code generation |

### Socket.IO Room Architecture

| Room | Purpose |
|------|---------|
| `lobby` | All connected players waiting for a game |
| `game_{id}` | Players in an active game session |
| `game_{id}_globalScreen` | The global screen display for a game |
| `player_{id}` | Private channel to individual players (vibration, personal state) |

### Flow

1. **Join** → Phone opens controller page, enters name, joins `lobby`
2. **Start** → Host selects a game, server creates a game session, moves players to `game_{id}`
3. **Play** → Game loop runs on the server (~60 FPS), broadcasts state to global screen, receives input from phones
4. **End** → Game calls `endGame(results)`, global scores update, everyone returns to `lobby`

---

## Project Structure

```
CouchParty/
├── server.js                  ← Entry point (Express + Socket.IO)
├── package.json
├── AGENTS.md                  ← AI agent context (for development assistants)
├── currently.md               ← Current status tracker
├── README.md                  ← This file
├── src/                       ← Core framework
│   ├── GameBase.js            ← Base class for all games
│   ├── PlayerManager.js       ← Player identity, scores, reconnection
│   ├── BinaryProtocol.js      ← 17-byte orientation packet encoder/decoder
│   └── GameLoader.js          ← Auto-discovers games in public/games/
├── public/                    ← Static files (served as-is, no build step)
│   ├── lobby/                 ← Lobby pages
│   │   ├── globalScreen.html  ← TV display: QR code, player list, game selection
│   │   └── controller.html    ← Phone display: name input, join flow
│   ├── shared/                ← Shared client code
│   │   ├── socket.js          ← Socket.IO connection helper, auto-reconnect, navigation
│   │   ├── orientation.js     ← Motion permission + binary streaming (not yet built)
│   │   └── styles.css         ← Common CSS: cards, buttons, QR, status indicators
│   └── games/                 ← Game plugins (each in its own folder)
│       └── test-harness/      ← Framework validation suite
│           ├── game.js        ← Tests every lifecycle hook (extends GameBase)
│           ├── globalScreen/  ← Test results display
│           │   └── index.html
│           └── controller/    ← Test trigger buttons
│               └── index.html
└── docs/                      ← Obsidian vault — full documentation
```

---

## Creating a New Game

Games are self-contained plugins. Create a folder in `public/games/` with three things:

```
public/games/mygame/
├── game.js              ← Server logic (extends GameBase)
├── globalScreen/
│   └── index.html       ← Shared display page
└── controller/
    └── index.html       ← Phone controller page
```

Restart the server — the game is auto-discovered. No config changes needed.

### Minimal game.js

```javascript
import { GameBase } from '../../../src/GameBase.js';

export default class MyGame extends GameBase {
  constructor() {
    super('mygame', 'My Game', 'Description here', 2, 4);
  }

  async onStart({ players, globalScoreboard }) {
    // Initialize state, start game loop
    this.startLoop();
  }

  onTick(deltaMs) {
    // Update physics, check win conditions
    this.sendToGlobalScreen('game:state', { /* current state */ });
  }

  onInput(playerId, data) {
    // Handle controller input
  }

  onPlayerLeave(playerId) {
    return true; // continue game, or false to end
  }
}
```

For full details, see the [Game Plugin Guide](docs/Framework/game-plugin.md).

### Key Lifecycle Hooks

| Hook | When | Must Implement? |
|------|------|-----------------|
| `onStart({ players, globalScoreboard })` | Game begins | Yes |
| `onTick(deltaMs)` | Every frame (~60 FPS) | For physics/gameplay |
| `onInput(playerId, data)` | Player sends input | For interactivity |
| `onPlayerLeave(playerId)` | Player disconnects | For cleanup (return bool) |
| `onOrientation(playerId, alpha, beta, gamma)` | Motion data received | Only if `requireOrientation` |

### Communication Helpers (available in game.js)

| Method | Sends To |
|--------|----------|
| `sendToGlobalScreen(event, payload)` | The global display only |
| `sendToPlayer(playerId, event, payload)` | A specific player's phone |
| `broadcastToAll(event, payload)` | All players + global screen |
| `endGame(results)` | Ends game, updates global scores, returns everyone to lobby |

---

## Binary Motion Protocol

Orientation data (gyroscope) can be streamed at 60Hz using a compact 17-byte binary format — enabled only when a game opts in via `this.requireOrientation = true`.

| Byte(s) | Field | Type |
|---------|-------|------|
| 0 | Message type (0x01) | uint8 |
| 1-4 | Player ID | uint32 LE |
| 5-8 | Alpha | float32 LE |
| 9-12 | Beta | float32 LE |
| 13-16 | Gamma | float32 LE |

Without binary, the same data would be 80+ bytes of JSON per packet. For 4 players at 60 FPS, binary saves ~150 KB/s.

---

## Current Status

The core framework is complete and functional. Here's what's done and what's next:

| Area | Status |
|------|--------|
| **Core framework** (`src/`) — GameBase, PlayerManager, BinaryProtocol, GameLoader | Complete |
| **Server** — Express, Socket.IO, game lifecycle, QR code | Complete |
| **Lobby pages** — global screen + controller join flow | Complete |
| **Shared client** — socket.js (connection/reconnect), styles.css | Complete |
| **orientation.js** — client-side binary streaming | Not yet built |
| **Game engine layer** — GameClient, ControllerClient, Physics, UIOverlay, etc. | Planned (Phase 8) |
| **Framework Test Harness** | Not yet built |
| **Game concepts** — Racing, Wood Cutting, Cook-Off, Friend Bombs | Designed (docs) |

For detailed status, see [currently.md](currently.md). For the roadmap, see [ImplementationPlan.md](docs/ImplementationPlan.md).

---

## Documentation

The `docs/` folder is an [Obsidian](https://obsidian.md) vault containing the full project specification, architecture docs, framework API references, and game design documents.

| Topic | Document |
|-------|----------|
| Elevator pitch | [docs/TheIdea.md](docs/TheIdea.md) |
| Full specification | [docs/ProjectSpec.md](docs/ProjectSpec.md) |
| Architecture | [docs/Architecture/overview.md](docs/Architecture/overview.md) |
| Terminology | [docs/Architecture/terminology.md](docs/Architecture/terminology.md) |
| Game plugin guide | [docs/Framework/game-plugin.md](docs/Framework/game-plugin.md) |
| GameBase lifecycle API | [docs/Framework/lifecycle.md](docs/Framework/lifecycle.md) |
| PlayerManager API | [docs/Framework/player-manager.md](docs/Framework/player-manager.md) |
| Binary protocol spec | [docs/Framework/binary-protocol.md](docs/Framework/binary-protocol.md) |
| Implementation plan | [docs/ImplementationPlan.md](docs/ImplementationPlan.md) |

---

## Design Philosophy

- **Zero setup for guests** — scan a QR code, tap a link, you're in. No accounts, no app store.
- **Modular games** — each game is a self-contained folder. Add a folder, restart the server, done.
- **No build step** — raw ES modules served directly from `public/`. No bundler, no config.
- **Opt-in complexity** — binary motion protocol, game engine modules — use what you need, ignore the rest.
- **Tournament-style play** — global scores persist across games within a session. Every round matters.
- **Reconnection built-in** — players get a token on join; if they disconnect, they can rejoin their game.

---

## License

MIT
