# Game Lifecycle

This document describes the GameBase class and the lifecycle hooks available to game implementations.

---

## GameBase Class

All games must extend the `GameBase` class from `src/GameBase.js`. This provides a standardized interface for the framework to interact with games.

### Constructor

```javascript
constructor(id, name, description, minPlayers, maxPlayers)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Unique identifier (e.g., "pong") |
| name | string | Display name (e.g., "Pong") |
| description | string | Brief description for lobby |
| minPlayers | number | Minimum required players |
| maxPlayers | number | Maximum allowed players |

---

## Game Loop Management

### startLoop(fps = 60)

Starts a game loop that calls `onTick(deltaMs)` at the specified FPS. Automatically stopped when `endGame()` is called.

```javascript
async onStart({ players, globalScoreboard }) {
  this.players = players;
  this.scores = {};
  players.forEach(p => this.scores[p.id] = 0);
  this.startLoop(60);
}
```

### stopLoop()

Stops the game loop manually (called automatically by `endGame`).

```javascript
this.stopLoop(); // Usually not needed — endGame() handles this
```

---

## Lifecycle Hooks

### onStart({ players, globalScoreboard })

Called when the game begins. Use this to:
- Initialize game state (ball position, scores, etc.)
- Set up the game loop if needed
- Enable motion controls if required

```javascript
async onStart({ players, globalScoreboard }) {
  this.players = players;
  this.scores = {};
  players.forEach(p => this.scores[p.id] = 0);

  // Enable motion controls if needed
  this.requireOrientation = true;
  this.enableOrientation();

  // Start the game loop
  this.startLoop();
}
```

### onInput(playerId, data)

Called when a player sends input from their controller. Common input types:
- `button` - Button press (A, B, etc.)
- `joystick` - Joystick movement { x, y }
- `tap` - Screen tap at position

```javascript
onInput(playerId, data) {
  if (data.type === 'joystick') {
    this.updatePaddle(playerId, data.y);
  } else if (data.type === 'button') {
    this.handleButton(playerId, data.button);
  }
}
```

### onPlayerLeave(playerId)

Called when a player disconnects during a game. Return `true` to continue the game with remaining players, or `false` to end the game.

```javascript
onPlayerLeave(playerId) {
  // Remove player's paddle
  delete this.paddles[playerId];

  // If less than 2 players, end game
  if (Object.keys(this.paddles).length < 2) {
    return false;
  }
  return true;
}
```

### onTick(deltaMs)

Called every frame (~60 FPS). Use this to:
- Update game physics
- Check collisions
- Move game objects
- Send state updates to global screen

```javascript
onTick(deltaMs) {
  // Update ball position
  this.ball.x += this.ball.vx * deltaMs;
  this.ball.y += this.ball.vy * deltaMs;

  // Check collisions
  this.checkPaddleCollision();
  this.checkWallCollision();
  this.checkScoring();

  // Send state to global screen
  this.sendToGlobalScreen('game:state', {
    ball: this.ball,
    paddles: this.paddles,
    scores: this.scores,
  });
}
```

### onOrientation(playerId, alpha, beta, gamma)

Called when motion data is received (only if `requireOrientation = true`).

```javascript
onOrientation(playerId, alpha, beta, gamma) {
  // Use beta (tilt forward/back) for vertical paddle control
  // gamma (tilt left/right) could be used for other mechanics
  const normalizedBeta = (beta + 90) / 180; // Normalize to 0-1
  this.paddles[playerId].y = normalizedBeta * this.fieldHeight;
}
```

---

## Communication Methods

### sendToGlobalScreen(event, payload)

Send a message to the global screen only.

```javascript
this.sendToGlobalScreen('game:state', { ... });
```

### sendToPlayer(playerId, event, payload)

Send a private message to a specific player (vibration, personal UI).

```javascript
this.sendToPlayer(playerId, 'vibrate', { duration: 100 });
this.sendToPlayer(playerId, 'flash', { color: 'red' });
```

### broadcastToAll(event, payload)

Send to all players AND the global screen.

```javascript
this.broadcastToAll('game:message', { text: 'Player scored!' });
```

### endGame(results)

Must be called when the game finishes. Updates global scores automatically.

```javascript
this.endGame({
  winners: ['player_1'],
  scores: { player_1: 5, player_2: 3 },
});
```

### addPoints(playerId, points)

Award points during gameplay. Updates the global scoreboard and emits `game:points` to all players and the global screen.

```javascript
this.addPoints(playerId, 10);
```

---

## Orientation Control

### enableOrientation()

Call to tell all controllers to start streaming motion data. Sends `enableOrientation` event to all players.

```javascript
this.enableOrientation();
```

### disableOrientation()

Call to stop motion data streaming.

```javascript
this.disableOrientation();
```

---

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `this.id` | string | Game identifier |
| `this.name` | string | Game display name |
| `this.io` | Socket.IO | Reference to Socket.IO instance (set by framework) |
| `this.gameId` | string | Current game session ID (set by framework) |
| `this.requireOrientation` | boolean | Set to true if game needs motion controls |

---

## Best Practices

1. **Always call endGame()** when the game finishes - this returns players to lobby
2. **Use onTick for physics**, but don't spam sendToGlobalScreen - consider throttling
3. **Validate player input** - don't trust data from controllers
4. **Handle disconnects gracefully** - use onPlayerLeave to manage < 2 player scenarios
5. **Keep state in sync** - send complete state, not just deltas, for simplicity