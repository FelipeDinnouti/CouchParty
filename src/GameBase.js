export class GameBase {
  constructor(id, name, description, minPlayers, maxPlayers) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.minPlayers = minPlayers;
    this.maxPlayers = maxPlayers;
    this.requireOrientation = false;
    this.io = null;
    this.gameId = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  setGameId(gameId) {
    this.gameId = gameId;
  }

  async onStart({ players, globalScoreboard }) {
    throw new Error('onStart must be implemented by game');
  }

  onInput(playerId, data) {
  }

  onPlayerLeave(playerId) {
    return true;
  }

  onTick(deltaMs) {
  }

  onOrientation(playerId, alpha, beta, gamma) {
  }

  sendToGlobalScreen(event, payload) {
    if (this.io && this.gameId) {
      this.io.to(`game_${this.gameId}_globalScreen`).emit(event, payload);
    }
  }

  sendToPlayer(playerId, event, payload) {
    if (this.io) {
      this.io.to(`player_${playerId}`).emit(event, payload);
    }
  }

  broadcastToAll(event, payload) {
    if (this.io && this.gameId) {
      this.io.to(`game_${this.gameId}`).emit(event, payload);
    }
  }

  endGame(results) {
    if (this.io && this.gameId) {
      this.io.to(`game_${this.gameId}`).emit('game:end', results);
      this.io.to(`game_${this.gameId}_globalScreen`).emit('game:end', results);
    }
  }

  addPoints(playerId, points) {
    if (this.io && this.gameId) {
      this.io.to('lobby').emit('player:points', { playerId, points });
    }
  }

  enableOrientation() {
    if (this.io && this.gameId) {
      this.io.to(`game_${this.gameId}`).emit('enableOrientation');
    }
  }

  disableOrientation() {
    if (this.io && this.gameId) {
      this.io.to(`game_${this.gameId}`).emit('disableOrientation');
    }
  }
}