# PlayerManager System

The `PlayerManager` class manages all player state, independent of any game. It handles player registration, reconnection, global scores, and room assignment.

---

## Overview

**Location:** `src/PlayerManager.js`

**Responsibilities:**
- Generate unique player IDs and reconnection tokens
- Track players in lobby vs. in-game
- Maintain global scoreboard across multiple games
- Handle reconnection logic

---

## Core Methods

### addPlayer(socket, name)

Register a new player and add them to the lobby.

```javascript
const { player, token } = playerManager.addPlayer(socket, 'Alice');
```

**Returns:** `{ player: Player, token: string }`

The `token` should be sent to the client for persistent reconnection.

---

### reconnectPlayer(socket, token)

Attempt to reconnect a player using their token.

```javascript
const player = playerManager.reconnectPlayer(socket, savedToken);
if (player) {
  // Reconnected successfully
}
```

**Returns:** `Player` if successful, `null` if token invalid.

---

### removePlayer(playerId)

Remove a player from the system (disconnect cleanup).

```javascript
playerManager.removePlayer(playerId);
```

---

### getPlayer(playerId)

Get a specific player by ID.

```javascript
const player = playerManager.getPlayer(playerId);
```

---

### getAllPlayers()

Get all registered players.

```javascript
const all = playerManager.getAllPlayers();
```

---

### getLobbyPlayers()

Get players currently in the lobby (not in a game).

```javascript
const lobbyPlayers = playerManager.getLobbyPlayers();
```

---

### getGamePlayers(gameId)

Get players currently in a specific game.

```javascript
const gamePlayers = playerManager.getGamePlayers('pong');
```

---

### setPlayerGame(playerId, gameId, inGame)

Update a player's game state.

```javascript
playerManager.setPlayerGame(playerId, 'pong', true);  // Join game
playerManager.setPlayerGame(playerId, null, false);    // Return to lobby
```

---

### addGlobalScore(playerId, points)

Add points to a player's global score (persists across games).

```javascript
playerManager.addGlobalScore(playerId, 10);
```

---

### getGlobalScores()

Get all players' scores, sorted by points descending.

```javascript
const scores = playerManager.getGlobalScores();
// Returns: [{ playerId, score, name }, ...]
```

---

### updatePlayerName(playerId, name)

Update a player's display name.

```javascript
playerManager.updatePlayerName(playerId, 'NewName');
```

---

### getPlayerBySocketId(socketId)

Find a player by their socket ID.

```javascript
const player = playerManager.getPlayerBySocketId(socket.id);
```

---

## Data Structures

### Player Object

```javascript
{
  id: 'player_1',           // Unique identifier
  token: 'token_123...',   // For reconnection
  name: 'Alice',            // Display name
  socketId: 'abc123',       // Current socket ID
  joinedAt: 1700000000000,  // Timestamp
  inGame: false,           // Currently in game?
  gameId: null              // Current game ID if in game
}
```

### Global Score Entry

```javascript
{
  playerId: 'player_1',
  score: 150,
  name: 'Alice'
}
```

---

## Internal State

The PlayerManager maintains these data structures:

| Map | Key | Value |
|-----|-----|-------|
| `players` | playerId | Player object |
| `globalScores` | playerId | { score, name } |
| `reconnectionTokens` | token | playerId |
| `nextPlayerId` | - | Auto-incrementing counter |

---

## Usage in server.js

```javascript
import { PlayerManager } from './src/PlayerManager.js';

const playerManager = new PlayerManager();

// On player connection
io.on('connection', (socket) => {
  // Check for reconnection token
  const token = socket.handshake.query.token;
  if (token) {
    const player = playerManager.reconnectPlayer(socket, token);
    if (player) {
      // Send current game state if in game
      return;
    }
  }

  // New player joins
  socket.on('player:join', ({ name }) => {
    const { player, token } = playerManager.addPlayer(socket, name);
    socket.emit('player:joined', { player, token });

    // Broadcast updated player list
    io.to('lobby').emit('lobby:players', playerManager.getLobbyPlayers());
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const player = playerManager.getPlayerBySocketId(socket.id);
    if (player && !player.inGame) {
      playerManager.removePlayer(player.id);
      io.to('lobby').emit('lobby:players', playerManager.getLobbyPlayers());
    }
  });
});

// When game ends - update global scores
game.endGame({ winners, scores });
scores.forEach(({ playerId, score }) => {
  playerManager.addGlobalScore(playerId, score);
});
```

---

## Score Persistence

Global scores are maintained across multiple games within a single server session. When a game calls `endGame(results)`:

1. The framework automatically adds points to the global scoreboard
2. The lobby's global screen displays the updated leaderboard
3. Scores persist until the server restarts

---

## Reconnection Flow

1. Player joins → receives token, saved to localStorage
2. Player disconnects (network issue)
3. Player reopens controller page
4. Page reads token from localStorage
5. Socket connects with token in handshake query
6. Server calls `reconnectPlayer(socket, token)`
7. If valid, player restored to their game/lobby position
8. If invalid, player starts fresh (new ID)