# Architecture Overview

CouchParty is a modular local network party game platform. This document explains how the system components interact.

---

## System Diagram

```java
                    ┌─────────────────┐
                    │   Game Loader   │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
    ┌──────┴──────┐   ┌──────┴──────┐   ┌──────┴──────┐
    │ GameBase    │   │PlayerManager│   │ BinaryProto │
    └──────┬──────┘   └──────┬──────┘   └─────────────┘
           │                │
           └────────┬───────┘
                    │
           ┌────────▼────────┐
           │   server.js     │
           │ (Express+Socket)│
           └────────┬────────┘
                    │
     ┌──────────────┼──────────────┐
     │              │              │
┌────▼────┐   ┌────▼────┐   ┌────▼────┐
│ Global  │   │Players  │   │ Game    │
│ Screen  │   │(Phones) │   │ Sessions│
└─────────┘   └─────────┘   └─────────┘
```

---

## Core Components

### 1. GameBase (`src/GameBase.js`)
Abstract base class that all games extend. Provides:
- Lifecycle hooks (onStart, onTick, onInput, etc.)
- Communication helpers (sendToGlobalScreen, sendToPlayer, broadcastToAll)
- Game management (endGame, addPoints)
- Orientation control (enableOrientation, disableOrientation)

### 2. PlayerManager (`src/PlayerManager.js`)
Manages all player state independently of games:
- Player registration and identification
- Reconnection token handling
- Lobby vs. in-game state tracking
- Global scoreboard management

### 3. BinaryProtocol (`src/BinaryProtocol.js`)
Handles compact binary encoding for motion data:
- Encodes orientation (alpha, beta, gamma) into 17-byte packets
- Decodes incoming binary messages
- Reduces bandwidth vs. JSON (~17 bytes vs. 80+ bytes)

### 4. GameLoader (`src/GameLoader.js`)
Auto-discovers and loads game plugins:
- Scans `public/games/*/game.js` directories
- Validates games extend GameBase
- Provides game metadata (name, min/max players)
- Creates game instances on demand

---

## Data Flow

### Player Joining Flow

```
1. Global Screen loads /lobby/globalScreen.html
   → Displays QR code with controller URL

2. Player opens controller URL on phone
   → Shows name input form

3. Player submits name
   → socket.emit('player:join', { name })

4. Server creates player via PlayerManager
   → Returns player object + token
   → Token saved to localStorage on phone

5. Server broadcasts updated player list
   → io.to('lobby').emit('lobby:players', players)
```

### Game Start Flow

```
1. Host selects game on Global Screen
   → socket.emit('game:start', { gameId })

2. Server creates game instance
   → Moves players to game room
   → Calls game.onStart({ players })

3. If game requires orientation:
   → game.enableOrientation() sends 'enableOrientation'
   → Controllers start streaming binary data

4. All devices navigate to game pages
   → Global Screen → /games/{id}/globalScreen/
   → Controllers → /games/{id}/controller/

5. Game loop runs at 60 FPS
   → game.onTick(deltaMs) called each frame
   → Game sends state via sendToGlobalScreen()
```

### Game End Flow

```
1. Game calls endGame(results)
   → Broadcasts 'game:end' to all
   → Updates global scores via PlayerManager

2. All devices redirect to lobby

3. Global Screen shows updated leaderboard
   → Fetches global scores from PlayerManager
```

---

## Room Architecture

### Socket.IO Rooms

| Room Name                | Purpose               | Members                  |
| ------------------------ | --------------------- | ------------------------ |
| `lobby`                  | Pre-game waiting area | All non-playing players  |
| `game_{id}`              | Active game players   | Players in current game  |
| `game_{id}_globalScreen` | Global display        | One global screen device |
| `player_{id}`            | Private messaging     | Individual player socket |

### Message Routing

- **Game State** → `game_{id}_globalScreen` (only global screen receives)
- **Private Feedback** → `player_{id}` (vibration, personal UI)
- **Broadcast** → `game_{id}` (all players + global screen)

---

## Key Design Decisions

### 1. No Build Step
All code is plain JavaScript/HTML served directly. Games are simple folders with `.js`, `.html`, and assets. This makes adding games trivial.

### 2. Binary Orientation Protocol
Motion data (gyroscope) sent at 60Hz. JSON would be wasteful. Binary Protocol reduces payload from 80+ bytes to 17 bytes.

### 3. In-Memory State
No database - all state in memory. Appropriate for local party use where server restarts between sessions.

### 4. Modular Game System
Each game is self-contained. Games don't interfere with each other. Adding a game = creating a folder with game.js.

### 5. Persistent Reconnection
Players get tokens on first join. If disconnected, they can rejoin and return to the same game session.

---

## File Responsibilities

| File | Responsibility |
|------|-----------------|
| `server.js` | HTTP server, Socket.IO setup, event routing |
| `GameBase.js` | Game interface contract, communication helpers |
| `PlayerManager.js` | Player identity, scores, reconnection |
| `BinaryProtocol.js` | Orientation packet encode/decode |
| `GameLoader.js` | Plugin discovery, game instantiation |
| `socket.js` (client) | Connection management, event |
| `orientation.js` (client) | Motion permissions, binary streaming |

---

## Extension Points

To add a new game, create:
```
public/games/mygame/
├── game.js          # Server logic (extends GameBase)
├── globalScreen/
│   └── index.html   # Display rendering
└── controller/
    └── index.html   # Touch/motion controls
```

The server auto-discovers the game on restart. No code changes needed.