import { GameBase } from '../../../src/GameBase.js';

export default class TestHarnessGame extends GameBase {
  constructor() {
    super('test-harness', 'Framework Test Harness',
      'Visual validation tool for framework and engine features',
      1, 4);
    this.requireOrientation = false;
    this._playerInputs = {};
  }

  async onStart({ players }) {
    for (const p of players) {
      this._playerInputs[p.id] = {
        name: p.name,
        color: p.color,
        taps: 0,
        joystickMoves: 0,
        buttons: { A: 0, B: 0 },
        lastJoystick: { x: 0, y: 0 },
      };
    }

    this._log('Test harness started');
    this._broadcastInputCounts();
    this.startLoop(10);
  }

  onInput(playerId, data) {
    if (!data || typeof data !== 'object') return;

    if (data.type === 'test') {
      this._handleTestAction(playerId, data);
      return;
    }

    const input = this._playerInputs[playerId];
    if (!input) return;

    switch (data.type) {
      case 'joystick': {
        input.joystickMoves++;
        input.lastJoystick = { x: data.x || 0, y: data.y || 0 };
        this.sendToGlobalScreen('test:joystick', {
          playerId,
          x: data.x || 0,
          y: data.y || 0,
        });
        break;
      }
      case 'tap': {
        input.taps++;
        break;
      }
      case 'button': {
        const btn = data.button;
        if (btn === 'A' || btn === 'B') {
          if (data.pressed) input.buttons[btn]++;
        }
        break;
      }
    }

    this._broadcastInputCounts();
  }

  onOrientation(playerId, alpha, beta, gamma) {
    this.sendToGlobalScreen('test:orientation', {
      playerId,
      alpha,
      beta,
      gamma,
    });
  }

  onTick() {
    this._broadcastInputCounts();
  }

  onPlayerLeave(playerId) {
    const had = this._playerInputs[playerId];
    delete this._playerInputs[playerId];
    this._log(`Player ${had ? had.name : playerId} left`);
    this._broadcastInputCounts();
    return Object.keys(this._playerInputs).length > 0;
  }

  _handleTestAction(sourceId, data) {
    const { action, targetId, msg } = data;
    this._log(`Test action: ${action}${targetId ? ` (target: ${targetId})` : ''}`);

    switch (action) {
      case 'sendToPlayer':
        if (targetId) {
          this.sendToPlayer(targetId, 'test:feedback', { msg: msg || 'Hello from GS!' });
        }
        break;

      case 'sendToGS':
        this.sendToGlobalScreen('test:gsMessage', { msg: msg || 'This is a GS-only message' });
        break;

      case 'broadcast':
        this.broadcastToAll('test:broadcast', { msg: msg || 'Broadcast to all!' });
        break;

      case 'enableOrientation':
        this.requireOrientation = true;
        this.enableOrientation();
        break;

      case 'disableOrientation':
        this.requireOrientation = false;
        this.disableOrientation();
        break;

      case 'countdown':
        this.startCountdown(3, () => {
          this._log('Countdown finished');
        });
        break;

      case 'timer':
        this.startRoundTimer(30, () => {
          this._log('Timer expired');
        });
        break;

      case 'addPoints':
        if (targetId) {
          this.addPoints(targetId, 10);
          this._log(`Added 10 points to ${targetId}`);
        }
        break;

      case 'endGame': {
        const scores = {};
        for (const [id, inp] of Object.entries(this._playerInputs)) {
          scores[id] = inp.taps;
        }
        this.endGame({ winners: [], scores });
        break;
      }
    }
  }

  _log(msg) {
    this.sendToGlobalScreen('test:log', { timestamp: Date.now(), msg });
  }

  _broadcastInputCounts() {
    this.sendToGlobalScreen('test:inputCounts', { ...this._playerInputs });
  }
}
