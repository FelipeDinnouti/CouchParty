# Terminology Reference

This document defines the key terms used throughout the CouchParty codebase to ensure consistent understanding.

---

## Device Types

### Global Screen
The primary display device connected to the main computer/projector. This is the shared visual output that all players watch. It could be a TV, monitor, projector, or any larger display.

> **Note:** The original term "TV" has been replaced with "Global Screen" to reflect that the output device is not necessarily a television - it could be any screen (monitor, laptop display, projector, etc.).

### Controller
A personal device (typically a smartphone) that each player uses to control their game input. Controllers connect via the browser and provide touch controls, motion sensing, or other input methods.

---

## Architecture Terms

### Lobby
The pre-game waiting area where players gather before a game starts. The lobby displays:
- Connected players list
- Available games
- Global scoreboard
- QR code for easy joining

### Game Session
A single instance of a game being played. A game session includes:
- All participating players
- The active game state
- The game loop (tick)

### Global Scoreboard
A persistent score tracking system that maintains player points across multiple game sessions, enabling tournament-style play over an entire session.

---

## Socket Rooms

### Room: `lobby`
All players who are not currently in an active game. Players join this room upon connecting.

### Room: `game_{gameId}`
All players currently participating in a specific game session.

### Room: `game_{gameId}_globalScreen`
The global screen device connected to a specific game session. Only one device should be in this room per game.

### Room: `player_{playerId}`
An individual player's personal socket room. Used for private messages (e.g., vibration feedback, personal game state).

---

## Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `player:join` | Client → Server | Player enters name and joins lobby |
| `player:reconnect` | Client → Server | Player reconnects with saved token |
| `lobby:players` | Server → Global Screen | Current player list (real-time updates) |
| `lobby:games` | Server → Client | List of available games |
| `game:start` | Global Screen → Server | Host initiates a game |
| `game:start` | Server → All | All clients navigate to game pages |
| `game:input` | Controller → Server | Player sends game input |
| `game:orientation` | Controller → Server | Binary orientation data |
| `game:state` | Server → Global Screen | Game state for rendering |
| `game:end` | Server → All | Game finished, return to lobby |
| `player:points` | Server → Lobby | Update global scoreboard |
| `enableOrientation` | Server → Controller | Enable motion controls |
| `disableOrientation` | Server → Controller | Disable motion controls |

---

## Game Lifecycle Hooks

These are methods that game implementations can override:

- `onStart({ players, globalScoreboard })` - Called when game begins
- `onInput(playerId, data)` - Called when player sends input
- `onPlayerLeave(playerId)` - Called when player disconnects (return `true` to continue game)
- `onTick(deltaMs)` - Called every frame (~60 FPS)
- `onOrientation(playerId, alpha, beta, gamma)` - Called when motion data received

---

## Binary Protocol

Orientation data uses a compact 17-byte binary format:

```
Byte 0:   0x01 (message type = orientation)
Bytes 1-4: playerId (Uint32, little-endian)
Bytes 5-8: alpha (Float32, little-endian)
Bytes 9-12: beta (Float32, little-endian)
Bytes 13-16: gamma (Float32, little-endian)
```

---

## Directory Structure

```
CouchParty/
├── server.js              # Entry point
├── package.json
├── public/                # Static files
│   ├── lobby/             # Lobby pages
│   │   ├── globalScreen.html
│   │   └── controller.html
│   ├── shared/            # Shared scripts
│   │   ├── socket.js
│   │   ├── orientation.js
│   │   └── styles.css
│   └── games/             # Game plugins
│       └── pong/
│           ├── game.js
│           ├── globalScreen/
│           │   └── index.html
│           └── controller/
│               └── index.html
└── src/                   # Core framework
    ├── GameBase.js
    ├── PlayerManager.js
    ├── BinaryProtocol.js
    └── GameLoader.js
```

---

*This terminology should be used consistently across all documentation and code.*