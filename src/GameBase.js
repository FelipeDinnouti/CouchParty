export class GameBase {
  static PLAYER_COLORS = ['#e94560', '#0f3460', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4'];

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
    this._countdownTimeout = null;
    this._timerTimeout = null;
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

  startCountdown(seconds, callback) {
    let remaining = seconds;
    const emitCountdown = () => {
      if (this._ended) return;
      this.sendToGlobalScreen('game:countdown', { remaining });
      if (remaining <= 0) {
        if (callback) callback();
        return;
      }
      remaining--;
      this._countdownTimeout = setTimeout(emitCountdown, 1000);
    };
    emitCountdown();
  }

  startRoundTimer(seconds, callback) {
    const endTime = Date.now() + seconds * 1000;
    const tick = () => {
      if (this._ended) return;
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      this.sendToGlobalScreen('game:timer', { remaining });
      if (remaining <= 0) {
        if (callback) callback();
        return;
      }
      this._timerTimeout = setTimeout(tick, 1000);
    };
    tick();
  }

  getPlayerColor(index) {
    return GameBase.PLAYER_COLORS[index % GameBase.PLAYER_COLORS.length];
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

    if (this._countdownTimeout) {
      clearTimeout(this._countdownTimeout);
      this._countdownTimeout = null;
    }
    if (this._timerTimeout) {
      clearTimeout(this._timerTimeout);
      this._timerTimeout = null;
    }

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
