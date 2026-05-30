import { randomUUID } from 'crypto';

export class PlayerManager {
  constructor() {
    this.players = new Map();
    this.globalScores = new Map();
    this.reconnectionTokens = new Map();
    this.socketIdToPlayer = new Map();
    this.nextPlayerId = 1;
  }

  generatePlayerId() {
    return `player_${this.nextPlayerId++}`;
  }

  generateToken() {
    return `token_${randomUUID()}`;
  }

  addPlayer(socket, name) {
    const playerId = this.generatePlayerId();
    const token = this.generateToken();

    const player = {
      id: playerId,
      token,
      name,
      socketId: socket.id,
      joinedAt: Date.now(),
      inGame: false,
      gameId: null,
      connected: true,
    };

    this.players.set(playerId, player);
    this.globalScores.set(playerId, { score: 0, name });
    this.reconnectionTokens.set(token, playerId);
    this.socketIdToPlayer.set(socket.id, playerId);

    socket.playerId = playerId;
    socket.join('lobby');

    return { player, token };
  }

  disconnectPlayer(socketId) {
    const playerId = this.socketIdToPlayer.get(socketId);
    if (!playerId) return null;

    this.socketIdToPlayer.delete(socketId);

    const player = this.players.get(playerId);
    if (player) {
      player.connected = false;
    }
    return player || null;
  }

  reconnectPlayer(socket, token) {
    const playerId = this.reconnectionTokens.get(token);
    if (!playerId) {
      return null;
    }

    const player = this.players.get(playerId);
    if (!player) {
      this.reconnectionTokens.delete(token);
      return null;
    }

    this.socketIdToPlayer.delete(player.socketId);

    player.socketId = socket.id;
    player.connected = true;
    socket.playerId = playerId;

    this.socketIdToPlayer.set(socket.id, playerId);

    if (player.inGame && player.gameId) {
      socket.join(`game_${player.gameId}`);
    } else {
      socket.join('lobby');
    }

    return player;
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;

    this.players.delete(playerId);
    this.globalScores.delete(playerId);
    if (player.token) {
      this.reconnectionTokens.delete(player.token);
    }
    if (player.socketId) {
      this.socketIdToPlayer.delete(player.socketId);
    }
  }

  getPlayer(playerId) {
    return this.players.get(playerId);
  }

  getAllPlayers() {
    return Array.from(this.players.values());
  }

  getLobbyPlayers() {
    return this.getAllPlayers().filter(p => !p.inGame && p.connected);
  }

  getGamePlayers(gameId) {
    return this.getAllPlayers().filter(p => p.gameId === gameId && p.inGame);
  }

  setPlayerGame(playerId, gameId, inGame) {
    const player = this.players.get(playerId);
    if (player) {
      player.inGame = inGame;
      player.gameId = inGame ? gameId : null;
    }
  }

  addGlobalScore(playerId, points) {
    const scoreData = this.globalScores.get(playerId);
    if (scoreData) {
      scoreData.score += points;
    }
  }

  getGlobalScores() {
    return Array.from(this.globalScores.entries())
      .map(([playerId, data]) => ({ playerId, score: data.score, name: data.name }))
      .sort((a, b) => b.score - a.score);
  }

  getPlayerBySocketId(socketId) {
    const playerId = this.socketIdToPlayer.get(socketId);
    if (!playerId) return null;
    return this.players.get(playerId) || null;
  }
}
