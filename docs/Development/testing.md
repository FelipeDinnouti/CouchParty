# Integration Testing

This document describes how to run integration tests for CouchParty's Socket.IO lobby and game systems.

> ⚠️ These tests require `socket.io-client` as a dev dependency. Install with:
> `npm install socket.io-client --save-dev`

---

## Overview

Integration tests spin up a real Socket.IO server + Express instance, connect `socket.io-client` instances as simulated browsers, and verify the full message flow. No browser automation needed — the tests run entirely in Node.js.

The core testing pattern:

1. Start a real `socket.io` `Server` on a random port
2. Wire up the same connection handlers as `server.js`
3. Connect `socket.io-client` instances (simulating phones/TVs)
4. Emit events and assert the responses

---

## Test: Lobby Join Flow

Verifies that a player joining the lobby appears on the global screen in real time.

```javascript
// Run with: node test.js

import { createServer } from 'http';
import { Server } from 'socket.io';
import { PlayerManager } from './src/PlayerManager.js';
import { GameLoader } from './src/GameLoader.js';

async function testLobbyJoin() {
  // 1. Create server with the same wiring as server.js
  const httpServer = createServer();
  const io = new Server(httpServer, { cors: { origin: '*' } });
  const playerManager = new PlayerManager();
  const gameLoader = new GameLoader('./public/games');
  await gameLoader.loadGames();

  io.on('connection', (socket) => {
    const token = socket.handshake.query.token;
    if (token) {
      const player = playerManager.reconnectPlayer(socket, token);
      if (player) {
        socket.emit('player:reconnected', { player });
        return;
      }
    }

    socket.join('lobby');
    socket.emit('lobby:games', gameLoader.getGameList());

    socket.on('lobby:requestState', () => {
      socket.emit('lobby:games', gameLoader.getGameList());
      socket.emit('lobby:players', playerManager.getLobbyPlayers());
    });

    socket.on('player:join', ({ name }) => {
      const { player, token } = playerManager.addPlayer(socket, name.trim());
      socket.emit('player:joined', { player, token });
      io.to('lobby').emit('lobby:players', playerManager.getLobbyPlayers());
    });
  });

  // 2. Start on random port
  await new Promise(r => httpServer.listen(0, r));
  const port = httpServer.address().port;

  const { io: ioc } = await import('socket.io-client');

  // 3. Connect global screen (simulates TV)
  const globalScreen = ioc(`http://localhost:${port}`);
  await new Promise(r => globalScreen.on('connect', r));

  // 4. Wire up assertion helpers
  let playersOnScreen = [];
  globalScreen.on('lobby:players', (players) => {
    playersOnScreen = players;
  });

  // 5. Connect a controller (simulates phone)
  const controller = ioc(`http://localhost:${port}`);
  await new Promise(r => controller.on('connect', r));

  let joinConfirmed = false;
  controller.on('player:joined', () => { joinConfirmed = true; });

  // 6. Emit join
  controller.emit('player:join', { name: 'Alice' });
  await new Promise(r => setTimeout(r, 100));

  // 7. Assert
  console.assert(joinConfirmed, 'Controller should receive player:joined');
  console.assert(playersOnScreen.length === 1, 'Global screen should see 1 player');
  console.assert(playersOnScreen[0].name === 'Alice', 'Player name should be Alice');
  console.assert(playerManager.getLobbyPlayers().length === 1, 'PlayerManager should have 1 lobby player');

  // 8. Cleanup
  controller.close();
  globalScreen.close();
  io.close();
  httpServer.close();

  console.log('Lobby join test passed!');
}

testLobbyJoin().catch(console.error);
```

### What it tests

| Assertion | What it verifies |
|-----------|------------------|
| Controller gets `player:joined` | Server accepted the join and responded |
| Global screen receives `lobby:players` broadcast | Room-based broadcast reaches anonymous sockets (requires `socket.join('lobby')`) |
| PlayerManager state is correct | Server-side state matches client expectations |

---

## Test: Reconnection Flow

Verifies a disconnected player can rejoin their game session using a stored token.

```javascript
async function testReconnection() {
  const httpServer = createServer();
  const io = new Server(httpServer, { cors: { origin: '*' } });
  const playerManager = new PlayerManager();

  io.on('connection', (socket) => {
    const token = socket.handshake.query.token;
    if (token) {
      const player = playerManager.reconnectPlayer(socket, token);
      if (player) {
        socket.emit('player:reconnected', { player });
        return;
      }
    }
    socket.join('lobby');
    socket.on('player:join', ({ name }) => {
      const { player, token } = playerManager.addPlayer(socket, name.trim());
      socket.emit('player:joined', { player, token });
    });
  });

  await new Promise(r => httpServer.listen(0, r));
  const port = httpServer.address().port;
  const { io: ioc } = await import('socket.io-client');

  // Connect, join, get token
  const ctrl = ioc(`http://localhost:${port}`);
  await new Promise(r => ctrl.on('connect', r));
  let savedToken;
  ctrl.on('player:joined', ({ token }) => { savedToken = token; });
  ctrl.emit('player:join', { name: 'Bob' });
  await new Promise(r => setTimeout(r, 50));
  const originalId = ctrl.id;

  // Simulate disconnect by closing and reconnecting with token
  ctrl.close();
  const reconnected = ioc(`http://localhost:${port}`, { query: { token: savedToken } });
  await new Promise(r => reconnected.on('connect', r));

  let reconfirmed = false;
  reconnected.on('player:reconnected', () => { reconfirmed = true; });
  await new Promise(r => setTimeout(r, 50));

  console.assert(reconfirmed, 'Reconnected controller should receive player:reconnected');
  console.assert(reconnected.id !== originalId, 'Should have a new socket ID');

  reconnected.close();
  io.close();
  httpServer.close();
  console.log('Reconnection test passed!');
}
```

---

## Test: Game Start & End Flow

Verifies that starting a game moves players to the correct rooms, and ending a game returns them to the lobby.

```javascript
async function testGameLifecycle() {
  // Creates players, starts a game, asserts room membership,
  // ends the game, asserts return to lobby
  // See test/lobby.js for full implementation
}
```

---

## Available Test Scripts

| Script | What it tests | Run command |
|--------|---------------|-------------|
| `test/lobby.js` | Lobby join, reconnection, game lifecycle | `node test/lobby.js` |
| (future) | Game plugin loading, orientation protocol | TBD |

---

## Notes for AI Agents

- **Use `socket.io-client`** to simulate browser connections. It's already a dev dependency.
- **Use random ports** (`httpServer.listen(0)`) to avoid port conflicts.
- **Always await a small delay** (`setTimeout(r, 50-100)`) after emits — Socket.IO is async and events need time to propagate.
- **Clean up** all sockets, the `io` server, and `httpServer` after each test.
- The socket.io `connection` event fires on the **server** when the transport is established. The client `connect` event fires on the **client**. Both happen asynchronously.
- `socket.join('lobby')` on the server adds the socket to a room. `io.to('lobby').emit(...)` broadcasts to all sockets in that room.
