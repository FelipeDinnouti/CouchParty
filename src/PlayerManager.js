export class PlayerManager {
  constructor() {
    this.players = new Map();
    this.globalScores = new Map();
    this.reconnectionTokens = new Map();
    this.nextPlayerId = 1;
  }

  generatePlayerId() {
    return `player_${this.nextPlayerId++}`;
  }

  generateToken() {
    return `token_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
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
    };

    this.players.set(playerId, player);
    this.globalScores.set(playerId, { score: 0, name });
    this.reconnectionTokens.set(token, playerId);

    socket.playerId = playerId;
    socket.join('lobby');

    return { player, token };
  }

  reconnectPlayer(socket, token) {
    const playerId = this.reconnectionTokens.get(token);
    if (!playerId) {
      return null;
    }

    const player = this.players.get(playerId);
    if (!player) {
      return null;
    }

    player.socketId = socket.id;
    socket.playerId = playerId;

    if (player.inGame && player.gameId) {
      socket.join(`game_${player.gameId}`);
    } else {
      socket.join('lobby');
    }

    return player;
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      this.players.delete(playerId);
      if (player.token) {
        this.reconnectionTokens.delete(player.token);
      }
    }
  }

  getPlayer(playerId) {
    return this.players.get(playerId);
  }

  getAllPlayers() {
    return Array.from(this.players.values());
  }

  getLobbyPlayers() {
    return this.getAllPlayers().filter(p => !p.inGame);
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
    } else {
      this.globalScores.set(playerId, { score: points, name: 'Unknown' });
    }
  }

  getGlobalScores() {
    return Array.from(this.globalScores.entries())
      .map(([playerId, data]) => ({ playerId, score: data.score, name: data.name }))
      .sort((a, b) => b.score - a.score);
  }

  updatePlayerName(playerId, name) {
    const player = this.players.get(playerId);
    if (player) {
      player.name = name;
    }
    const scoreData = this.globalScores.get(playerId);
    if (scoreData) {
      scoreData.name = name;
    }
  }

  getPlayerBySocketId(socketId) {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) {
        return player;
      }
    }
    return null;
  }
}