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
    this._ended = false;
    this._loopTimeout = null;
    this._onEndGameCallback = null;
    this._onAddPointsCallback = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  setGameId(gameId) {
    this.gameId = gameId;
  }

  startLoop(fps = 60) {
    this.stopLoop();
    const intervalMs = 1000 / fps;
    let lastTime = performance.now();
    const tick = () => {
      if (this._ended) return;
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;
      this.onTick(delta);
      const elapsed = performance.now() - now;
      const nextDelay = Math.max(0, intervalMs - elapsed);
      this._loopTimeout = setTimeout(tick, nextDelay);
    };
    this._loopTimeout = setTimeout(tick, intervalMs);
  }

  stopLoop() {
    if (this._loopTimeout) {
      clearTimeout(this._loopTimeout);
      this._loopTimeout = null;
    }
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
    if (this._ended) return;
    this._ended = true;
    this.stopLoop();

    if (this._onEndGameCallback) {
      this._onEndGameCallback(results);
    } else {
      this._broadcastEndGame(results);
    }
  }

  _broadcastEndGame(results) {
    if (this.io && this.gameId) {
      this.io.to(`game_${this.gameId}`).emit('game:end', results);
      this.io.to(`game_${this.gameId}_globalScreen`).emit('game:end', results);
    }
  }

  addPoints(playerId, points) {
    if (this._onAddPointsCallback) {
      this._onAddPointsCallback(playerId, points);
    }

    if (this.io && this.gameId) {
      this.io.to(`game_${this.gameId}`).emit('game:points', { playerId, points });
      this.io.to(`game_${this.gameId}_globalScreen`).emit('game:points', { playerId, points });
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
