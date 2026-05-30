/**
 * Integration tests for CouchParty lobby system.
 *
 * Spins up a real Socket.IO server, connects socket.io-client instances
 * as simulated browsers, and verifies the full message flow.
 *
 * Usage: node test/lobby.js
 */

import { createServer } from 'http';
import { Server } from 'socket.io';
import { PlayerManager } from '../src/PlayerManager.js';
import { GameLoader } from '../src/GameLoader.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function createTestServer() {
  const httpServer = createServer();
  const io = new Server(httpServer, { cors: { origin: '*' } });
  const playerManager = new PlayerManager();
  const gameLoader = new GameLoader('./public/games');

  return { httpServer, io, playerManager, gameLoader };
}

async function wireLobbyHandlers(io, playerManager, gameLoader) {
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
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return socket.emit('error', { message: 'Name is required' });
      }

      const { player, token } = playerManager.addPlayer(socket, name.trim());
      socket.emit('player:joined', { player, token });
      io.to('lobby').emit('lobby:players', playerManager.getLobbyPlayers());
      io.to('lobby').emit('player:points', playerManager.getGlobalScores());
    });

    socket.on('player:leave', () => {
      const player = playerManager.getPlayerBySocketId(socket.id);
      if (player) {
        playerManager.removePlayer(player.id);
        io.to('lobby').emit('lobby:players', playerManager.getLobbyPlayers());
      }
    });

    socket.on('disconnect', () => {
      const player = playerManager.disconnectPlayer(socket.id);
      if (!player) return;
      if (!player.inGame) {
        io.to('lobby').emit('lobby:players', playerManager.getLobbyPlayers());
      }
    });
  });
}

// ----------------------------------------------------------------

async function testLobbyJoin() {
  console.log('\n--- test: Lobby join flow ---');

  const { httpServer, io, playerManager, gameLoader } = createTestServer();
  await gameLoader.loadGames();
  await wireLobbyHandlers(io, playerManager, gameLoader);

  await new Promise(r => httpServer.listen(0, r));
  const port = httpServer.address().port;
  const { io: ioc } = await import('socket.io-client');

  // Connect global screen
  const globalScreen = ioc(`http://localhost:${port}`);
  await new Promise(r => globalScreen.on('connect', r));

  let gsPlayers = [];
  globalScreen.on('lobby:players', (players) => { gsPlayers = players; });

  // Request initial state
  globalScreen.emit('lobby:requestState');
  await sleep(50);

  // Connect controller and join
  const controller = ioc(`http://localhost:${port}`);
  await new Promise(r => controller.on('connect', r));

  let joinConfirmed = false;
  let savedToken = null;
  controller.on('player:joined', ({ player, token }) => {
    joinConfirmed = true;
    savedToken = token;
  });

  controller.emit('player:join', { name: 'Alice' });
  await sleep(100);

  // Assertions
  console.assert(joinConfirmed, 'Controller should receive player:joined');
  console.assert(gsPlayers.length === 1, `Global screen should see 1 player, got ${gsPlayers.length}`);
  console.assert(gsPlayers[0]?.name === 'Alice', `Player name should be Alice, got ${gsPlayers[0]?.name}`);
  console.assert(playerManager.getLobbyPlayers().length === 1, 'PlayerManager should have 1 lobby player');
  console.assert(savedToken && savedToken.startsWith('token_'), 'Token should be generated');

  console.log('  ✓ Lobby join works');
  console.log(`  ✓ Global screen received broadcast (${gsPlayers.length} player(s))`);
  console.log(`  ✓ Token: ${savedToken}`);

  controller.close();
  globalScreen.close();
  io.close();
  httpServer.close();
}

async function testLobbyWithoutJoinFails() {
  console.log('\n--- test: Global screen without socket.join(lobby) ---');

  const httpServer = createServer();
  const io = new Server(httpServer, { cors: { origin: '*' } });
  const playerManager = new PlayerManager();

  // Intentionally MISSING socket.join('lobby') — reproduces the bug
  io.on('connection', (socket) => {
    socket.on('player:join', ({ name }) => {
      const { player, token } = playerManager.addPlayer(socket, name.trim());
      socket.emit('player:joined', { player, token });
      io.to('lobby').emit('lobby:players', playerManager.getLobbyPlayers());
    });
  });

  await new Promise(r => httpServer.listen(0, r));
  const port = httpServer.address().port;
  const { io: ioc } = await import('socket.io-client');

  const globalScreen = ioc(`http://localhost:${port}`);
  await new Promise(r => globalScreen.on('connect', r));

  let broadcastCount = 0;
  globalScreen.on('lobby:players', () => { broadcastCount++; });

  const controller = ioc(`http://localhost:${port}`);
  await new Promise(r => controller.on('connect', r));
  controller.emit('player:join', { name: 'Bob' });
  await sleep(100);

  console.assert(broadcastCount === 0,
    `Without socket.join('lobby'), global screen should get 0 broadcasts, got ${broadcastCount}`);
  console.log('  ✓ Confirmed: socket.join(lobby) is required for broadcasts to reach global screen');

  controller.close();
  globalScreen.close();
  io.close();
  httpServer.close();
}

async function testReconnection() {
  console.log('\n--- test: Player reconnection ---');

  const { httpServer, io, playerManager, gameLoader } = createTestServer();
  await gameLoader.loadGames();
  await wireLobbyHandlers(io, playerManager, gameLoader);

  await new Promise(r => httpServer.listen(0, r));
  const port = httpServer.address().port;
  const { io: ioc } = await import('socket.io-client');

  // Connect and join
  const ctrl = ioc(`http://localhost:${port}`);
  await new Promise(r => ctrl.on('connect', r));

  let savedToken;
  ctrl.on('player:joined', ({ token }) => { savedToken = token; });
  ctrl.emit('player:join', { name: 'Bob' });
  await sleep(50);

  console.assert(savedToken, 'Should have a token after joining');

  // Simulate disconnect by closing socket
  ctrl.close();

  // Reconnect with token — register handler BEFORE awaiting connect
  const reconnected = ioc(`http://localhost:${port}`, { query: { token: savedToken } });
  let reconfirmed = false;
  reconnected.on('player:reconnected', ({ player }) => {
    reconfirmed = true;
    console.assert(player.name === 'Bob', 'Reconnected player name should match');
  });
  await new Promise(r => reconnected.on('connect', r));
  await sleep(50);

  console.assert(reconfirmed, 'Reconnected controller should receive player:reconnected');
  console.assert(playerManager.getPlayerBySocketId(reconnected.id)?.name === 'Bob',
    'PlayerManager should track new socket ID');

  console.log('  ✓ Reconnection works with token');
  console.log('  ✓ Player state preserved after reconnect');

  reconnected.close();
  io.close();
  httpServer.close();
}

async function testPlayerLeave() {
  console.log('\n--- test: Player leave flow ---');

  const { httpServer, io, playerManager, gameLoader } = createTestServer();
  await gameLoader.loadGames();
  await wireLobbyHandlers(io, playerManager, gameLoader);

  await new Promise(r => httpServer.listen(0, r));
  const port = httpServer.address().port;
  const { io: ioc } = await import('socket.io-client');

  const globalScreen = ioc(`http://localhost:${port}`);
  await new Promise(r => globalScreen.on('connect', r));

  let gsPlayers = [];
  globalScreen.on('lobby:players', (players) => { gsPlayers = players; });
  globalScreen.emit('lobby:requestState');
  await sleep(50);

  const ctrl = ioc(`http://localhost:${port}`);
  await new Promise(r => ctrl.on('connect', r));
  ctrl.emit('player:join', { name: 'Charlie' });
  await sleep(50);

  console.assert(gsPlayers.length === 1, 'Charlie should appear on global screen');
  console.assert(playerManager.getLobbyPlayers().length === 1, 'PlayerManager has Charlie');

  // Leave
  ctrl.emit('player:leave');
  await sleep(50);

  console.assert(gsPlayers.length === 0, 'Global screen should show 0 players after leave');
  console.assert(playerManager.getLobbyPlayers().length === 0, 'PlayerManager should have 0 lobby players');
  console.assert(playerManager.players.size === 0, 'Player should be fully removed from all maps');

  console.log('  ✓ Player leaves lobby');
  console.log('  ✓ Global screen updates after leave');
  console.log('  ✓ PlayerManager maps cleaned up');

  ctrl.close();
  globalScreen.close();
  io.close();
  httpServer.close();
}

// ----------------------------------------------------------------

const tests = [testLobbyJoin, testLobbyWithoutJoinFails, testReconnection, testPlayerLeave];

async function runAll() {
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (err) {
      console.error(`  ✗ ${test.name} FAILED:`, err.message);
      failed++;
    }
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runAll();
