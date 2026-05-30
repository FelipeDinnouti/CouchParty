# Game Plugin Guide

This guide explains how to create a new game plugin for CouchParty.

---

## Overview

Games are self-contained plugins stored in `public/games/{gameId}/`. Each game folder must contain:

```
public/games/mygame/
├── game.js          # Server-side game logic
├── globalScreen/
│   └── index.html  # Global display (monitor/projector)
└── controller/
    └── index.html  # Player controller (phone)
```

The server auto-discovers games on startup - no configuration needed.

---

## Step 1: Create the Game Folder

```bash
mkdir -p public/games/mygame/globalScreen public/games/mygame/controller
```

---

## Step 2: Write the Server Logic (game.js)

### Basic Structure

```javascript
import { GameBase } from '../../src/GameBase.js';

export default class MyGame extends GameBase {
  constructor() {
    super('mygame', 'My Game', 'Description here', 2, 4);
  }

  async onStart({ players, globalScoreboard }) {
    // Initialize game state
    this.players = players;
    this.scores = {};
    players.forEach(p => this.scores[p.id] = 0);

    // Start game loop (automatically calls onTick, stopped by endGame)
    this.startLoop(60);
  }

  onInput(playerId, data) {
    // Handle player input
  }

  onTick(deltaMs) {
    // Update game state
    // Send state to global screen
    this.sendToGlobalScreen('game:state', { /* state */ });
  }

  onPlayerLeave(playerId) {
    // Handle disconnect
    return true; // Continue game
  }
}
```

### Full Example (Pong)

```javascript
import { GameBase } from '../../src/GameBase.js';

export default class PongGame extends GameBase {
  constructor() {
    super('pong', 'Pong', 'Classic paddle game - first to 5 wins!', 2, 2);
    this.paddles = {};
    this.ball = { x: 400, y: 300, vx: 0, vy: 0 };
    this.scores = {};
    this.winningScore = 5;
    this.interval = null;
  }

  async onStart({ players, globalScoreboard }) {
    // Position players
    players.forEach((p, i) => {
      this.paddles[p.id] = {
        y: 250,
        side: i === 0 ? 'left' : 'right'
      };
      this.scores[p.id] = 0;
    });

    // Serve ball
    this.resetBall();

    // Start loop (automatically stopped by endGame)
    this.startLoop(60);
  }

  onInput(playerId, data) {
    if (data.type === 'joystick' && this.paddles[playerId]) {
      // Map 0-1 joystick Y to 0-500 paddle position
      this.paddles[playerId].y = data.y * 500;
    }
  }

  onTick(deltaMs) {
    // Move ball
    this.ball.x += this.ball.vx * (deltaMs / 16);
    this.ball.y += this.ball.vy * (deltaMs / 16);

    // Wall collisions
    if (this.ball.y <= 0 || this.ball.y >= 600) {
      this.ball.vy *= -1;
    }

    // Paddle collisions
    for (const playerId in this.paddles) {
      const paddle = this.paddles[playerId];
      if (this.checkPaddleHit(paddle)) {
        this.ball.vx *= -1.1; // Speed up
        this.sendToPlayer(playerId, 'vibrate', { duration: 50 });
      }
    }

    // Scoring
    if (this.ball.x <= 0 || this.ball.x >= 800) {
      const scoredId = this.ball.x <= 0 ? Object.keys(this.paddles)[1] : Object.keys(this.paddles)[0];
      this.scores[scoredId]++;
      this.sendToPlayer(scoredId, 'vibrate', { duration: 200 });

      if (this.scores[scoredId] >= this.winningScore) {
        this.endGame({ winners: [scoredId], scores: this.scores });
      } else {
        this.resetBall();
      }
    }

    // Send state
    this.sendToGlobalScreen('game:state', {
      ball: this.ball,
      paddles: this.paddles,
      scores: this.scores
    });
  }

  checkPaddleHit(paddle) {
    // Simplified collision
    const paddleX = paddle.side === 'left' ? 20 : 780;
    return Math.abs(this.ball.x - paddleX) < 20 &&
           Math.abs(this.ball.y - paddle.y) < 50;
  }

  resetBall() {
    this.ball = { x: 400, y: 300, vx: (Math.random() > 0.5 ? 3 : -3), vy: (Math.random() - 0.5) * 4 };
  }

  onPlayerLeave(playerId) {
    this.endGame({ winners: [], scores: this.scores });
    return false;
  }
}
```

---

### Using the Client Engine

Games can import the shared engine modules from `/shared/lib/` for rapid development:

**Global Screen** (`globalScreen/index.html`):
```html
<script type="module">
  import { GameClient } from '/shared/lib/GameClient.js';
  import { ScoreboardOverlay, CountdownOverlay } from '/shared/lib/UIOverlay.js';

  const client = new GameClient('game-canvas', {
    virtualWidth: 800,
    virtualHeight: 600,
    backgroundColor: '#1a1a2e',
  });

  const scores = new ScoreboardOverlay({ x: 10, y: 10, width: 300 });
  const countdown = new CountdownOverlay();
  client.addOverlay(scores);
  client.addOverlay(countdown);

  client.setSocket(socket);
  client.onState = (state) => { client.state = state; };
  client.onCountdown = (remaining) => countdown.update(remaining);
  client.render = () => { /* draw game objects from client.state */ };
  client.start();
</script>
```

**Controller** (`controller/index.html`):
```html
<script type="module">
  import { ControllerClient } from '/shared/lib/ControllerClient.js';

  const ctrl = new ControllerClient();
  ctrl.setSocket(socket);
  ctrl.createJoystick('joystick-zone');
  ctrl.createButton('action-btn', 'action-btn');
</script>
```

See the module docs in the sidebar for full API details of each engine module.

---

## Step 3: Create the Global Screen Page

`public/games/mygame/globalScreen/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>My Game</title>
  <link rel="stylesheet" href="/shared/styles.css">
</head>
<body>
  <div id="game-container">
    <canvas id="game-canvas" width="800" height="600"></canvas>
  </div>
  <script src="/shared/socket.js"></script>
  <script>
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const socket = getSocket();

    socket.on('game:state', (state) => {
      render(state);
    });

    function render(state) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Draw game elements based on state
    }

    socket.emit('game:ready');
  </script>
</body>
</html>
```

---

## Step 4: Create the Controller Page

`public/games/mygame/controller/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <title>My Game Controller</title>
  <link rel="stylesheet" href="/shared/styles.css">
  <style>
    body { touch-action: none; }
    #joystick-zone { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="joystick-zone"></div>
  <script src="/shared/socket.js"></script>
  <script src="/shared/nipplejs.min.js"></script>
  <script>
    const socket = getSocket();

    // Initialize joystick
    const zone = document.getElementById('joystick-zone');
    const joystick = nipplejs.create({ zone: zone, mode: 'static', position: { left: '50%', top: '50%' } });

    joystick.on('move', (evt, data) => {
      if (data.vector) {
        socket.emit('game:input', {
          type: 'joystick',
          x: data.vector.x,
          y: data.vector.y
        });
      }
    });

    socket.on('vibrate', (data) => {
      if (navigator.vibrate) {
        navigator.vibrate(data.duration);
      }
    });
  </script>
</body>
</html>
```

---

## Testing Your Game

1. Start the server: `npm start`
2. Open global screen: `http://localhost:3000/lobby/globalScreen.html`
3. Open controller: `http://localhost:3000/lobby/controller.html`
4. Join with a name
5. Select your game and play!

---

## Best Practices

### Client Engine
- Import `GameClient` for global screen: handles canvas, DPI, resize, game loop
- Import `ControllerClient` for phone: joystick, buttons, orientation, vibration
- Import `Physics.js` for collision detection and vector math in both server `game.js` and client pages
- Import `UIOverlay.js` for scoreboards, timers, countdown, health bars, game-over screens
- Import `ScreenShake.js` and `ParticleSystem.js` for visual effects
- Import `AssetLoader.js` and `AudioManager.js` for loading and playing assets
- Import `CharacterController.js` for platformer/top-down character movement
- All modules are opt-in — import only what your game needs

### Game Logic
- Keep all game logic in `game.js` (server-side)
- Use `onTick` for physics updates
- Send complete state each frame (simpler than deltas)

### Controller
- Handle touch events via `ControllerClient.createJoystick()` and `createButton()`
- Map joystick values to your game's coordinate system
- Use `sendToPlayer` for vibration feedback

### Global Screen
- Extend `GameClient` or use it directly for canvas setup + game loop
- Handle window resize (built into `GameClient`)
- Show winner overlay on game end
- Use `UIOverlay` components for HUD elements

### Edge Cases
- Handle less than minPlayers (end game)
- Validate all input from controllers
- The framework auto-clears `startLoop`/`startCountdown`/`startRoundTimer` on `endGame`

---

## Adding Motion Controls

If your game uses phone motion:

```javascript
// game.js - in onStart
this.requireOrientation = true;
this.enableOrientation();

// Handle orientation in onTick or onOrientation
onOrientation(playerId, alpha, beta, gamma) {
  // beta = front-back tilt (-180 to 180)
  // gamma = left-right tilt (-90 to 90)
  this.paddles[playerId].y = ((beta + 90) / 180) * 600;
}
```

---

## Game Checklist

- [ ] Created folder in `public/games/`
- [ ] Implemented `game.js` extending GameBase
- [ ] Created globalScreen/index.html (uses `GameClient` or raw canvas)
- [ ] Created controller/index.html (uses `ControllerClient` or raw input)
- [ ] Handles all player counts between minPlayers and maxPlayers
- [ ] Calls `endGame()` when finished
- [ ] Imports engine modules from `/shared/lib/` as needed