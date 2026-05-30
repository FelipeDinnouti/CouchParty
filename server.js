import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { PlayerManager } from './src/PlayerManager.js';
import { GameLoader } from './src/GameLoader.js';
import { BinaryProtocol } from './src/BinaryProtocol.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/qrcode', async (req, res) => {
  const text = req.query.text || `${req.protocol}://${req.hostname}:${PORT}/lobby/controller.html`;
  try {
    const qrPng = await QRCode.toBuffer(text, { type: 'png', margin: 1, width: 400, color: { dark: '#1a1a2e', light: '#ffffff' } });
    res.type('image/png').send(qrPng);
  } catch {
    res.status(500).send('QR generation failed');
  }
});

app.get('/', (req, res) => {
  res.redirect('/lobby/globalScreen.html');
});

const playerManager = new PlayerManager();
const gameLoader = new GameLoader(path.join(__dirname, 'public', 'games'));

let currentGame = null;
let currentGameId = null;

await gameLoader.loadGames();
console.log(`Loaded ${gameLoader.getGameList().length} game(s):`, gameLoader.getGameList().map(g => g.name).join(', ') || 'none');

// ------------------- Socket.IO -------------------

io.on('connection', (socket) => {
  const token = socket.handshake.query.token;
  if (token) {
    const player = playerManager.reconnectPlayer(socket, token);
    if (player) {
      socket.emit('player:reconnected', { player });
      if (player.inGame && currentGame && player.gameId === currentGameId) {
        const gamePlayers = playerManager.getGamePlayers(currentGameId);
        socket.emit('game:start', {
          gameId: currentGame.id,
          globalScreenUrl: `/games/${currentGame.id}/globalScreen/`,
          controllerUrl: `/games/${currentGame.id}/controller/`,
          players: gamePlayers.map(p => ({
            id: p.id,
            name: p.name,
            color: p.color,
          })),
        });
        socket.join(`game_${currentGameId}`);
      }
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
    if (name.trim().length > 20) {
      return socket.emit('error', { message: 'Name must be 20 characters or less' });
    }

    const { player, token } = playerManager.addPlayer(socket, name.trim());

    socket.emit('player:joined', { player, token });
    socket.emit('lobby:games', gameLoader.getGameList());

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

  socket.on('game:start', async ({ gameId }) => {
    if (currentGame) {
      return socket.emit('error', { message: 'A game is already in progress' });
    }

    if (!gameId || !gameLoader.hasGame(gameId)) {
      return socket.emit('error', { message: 'Game not found' });
    }

    const lobbyPlayers = playerManager.getLobbyPlayers();
    const games = gameLoader.getGameList();
    const meta = games.find(g => g.id === gameId);

    if (lobbyPlayers.length < meta.minPlayers) {
      return socket.emit('error', { message: `Need at least ${meta.minPlayers} player(s) to start` });
    }
    if (lobbyPlayers.length > meta.maxPlayers) {
      return socket.emit('error', { message: `Too many players (max ${meta.maxPlayers})` });
    }

    const game = gameLoader.getGame(gameId);
    currentGameId = `${gameId}_${Date.now()}`;
    currentGame = game;

    game.setSocketIO(io);
    game.setGameId(currentGameId);

    game._onEndGameCallback = (results) => {
      const enrichedResults = {
        ...results,
        scores: results && results.scores ? { ...results.scores } : {},
        names: {},
      };
      if (results && results.scores) {
        for (const playerId of Object.keys(results.scores)) {
          const player = playerManager.getPlayer(playerId);
          enrichedResults.names[playerId] = player ? player.name : playerId;
          playerManager.addGlobalScore(playerId, results.scores[playerId]);
        }
      }

      game._broadcastEndGame(enrichedResults);

      const gamePlayers = playerManager.getGamePlayers(currentGameId);
      for (const p of gamePlayers) {
        playerManager.setPlayerGame(p.id, null, false);
        const ps = io.sockets.sockets.get(p.socketId);
        if (ps) {
          ps.leave(`game_${currentGameId}`);
          ps.join('lobby');
        }
      }

      io.to('lobby').emit('lobby:players', playerManager.getLobbyPlayers());
      io.to('lobby').emit('lobby:games', gameLoader.getGameList());
      io.to('lobby').emit('player:points', playerManager.getGlobalScores());

      currentGame = null;
      currentGameId = null;
    };

    game._onAddPointsCallback = (playerId, points) => {
      playerManager.addGlobalScore(playerId, points);
    };

    for (const player of lobbyPlayers) {
      playerManager.setPlayerGame(player.id, currentGameId, true);
      const playerSocket = io.sockets.sockets.get(player.socketId);
      if (playerSocket) {
        playerSocket.leave('lobby');
        playerSocket.join(`game_${currentGameId}`);
      }
    }

    socket.join(`game_${currentGameId}_globalScreen`);

    const gameStartPayload = {
      gameId,
      globalScreenUrl: `/games/${gameId}/globalScreen/`,
      controllerUrl: `/games/${gameId}/controller/`,
      players: lobbyPlayers.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
      })),
    };
    io.to(`game_${currentGameId}`).emit('game:start', gameStartPayload);
    io.to(`game_${currentGameId}_globalScreen`).emit('game:start', gameStartPayload);

    try {
      await game.onStart({ players: lobbyPlayers, globalScoreboard: playerManager.getGlobalScores() });
    } catch (err) {
      console.error('Game onStart error:', err);
      game.endGame({ winners: [], scores: {} });
    }
  });

  const playerInputThrottle = new Map();

  socket.on('game:input', (data) => {
    const player = playerManager.getPlayerBySocketId(socket.id);
    if (!player || !currentGame || !player.inGame || player.gameId !== currentGameId) {
      if (currentGame && data && typeof data === 'object' && data.type === 'test') {
        currentGame.onInput('gs', data);
      }
      return;
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) return;

    const now = Date.now();
    const lastInput = playerInputThrottle.get(player.id) || 0;
    if (now - lastInput < 30) return;
    playerInputThrottle.set(player.id, now);

    try {
      const size = JSON.stringify(data).length;
      if (size > 10240) return;
    } catch {
      return;
    }

    currentGame.onInput(player.id, data);
  });

  socket.on('game:orientation', (data) => {
    if (!currentGame || !currentGame.requireOrientation) return;
    if (!data) return;

    const player = playerManager.getPlayerBySocketId(socket.id);
    if (!player) return;

    let buffer;
    if (data instanceof ArrayBuffer) {
      buffer = data;
    } else if (data.buffer instanceof ArrayBuffer) {
      buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    } else {
      return;
    }

    if (BinaryProtocol.isBinaryMessage(buffer)) {
      const orientation = BinaryProtocol.decodeOrientation(buffer);
      if (orientation) {
        currentGame.onOrientation(player.id, orientation.alpha, orientation.beta, orientation.gamma);
      }
    }
  });

  socket.on('disconnect', () => {
    const player = playerManager.disconnectPlayer(socket.id);
    if (!player) return;

    if (player.inGame && currentGame && player.gameId === currentGameId) {
      const canContinue = currentGame.onPlayerLeave(player.id);

      if (!canContinue && !currentGame._ended) {
        currentGame.endGame({ winners: [], scores: {} });
      }
    } else {
      io.to('lobby').emit('lobby:players', playerManager.getLobbyPlayers());
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`CouchParty server running on http://localhost:${PORT}`);
});
