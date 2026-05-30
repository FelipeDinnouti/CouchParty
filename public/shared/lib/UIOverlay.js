export class ScoreboardOverlay {
  constructor(options = {}) {
    this.x = options.x || 10;
    this.y = options.y || 10;
    this.width = options.width || 200;
    this._scores = [];
    this._maxScore = 1;
  }

  update(scores) {
    this._scores = scores;
    if (scores.length > 0) {
      this._maxScore = Math.max(1, ...scores.map(s => s.score ?? 0));
    }
  }

  render(ctx, scale = 1) {
    const h = 30;
    const padding = 4;
    const barWidth = this.width - 60;

    ctx.save();
    ctx.font = `${14}px monospace`;
    ctx.textBaseline = 'middle';

    for (let i = 0; i < this._scores.length; i++) {
      const entry = this._scores[i];
      const score = entry.score ?? 0;
      const name = entry.name || entry.playerId;
      const color = entry.color || '#fff';
      const y = this.y + i * (h + padding);

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(this.x, y, this.width, h);

      ctx.fillStyle = color;
      ctx.fillText(name, this.x + 4, y + h / 2);

      const fillW = (score / this._maxScore) * barWidth;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(this.x + 56, y + 4, fillW, h - 8);
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#fff';
      ctx.textAlign = 'right';
      ctx.fillText(String(score), this.x + this.width - 4, y + h / 2);
      ctx.textAlign = 'left';
    }

    ctx.restore();
  }
}

export class TimerOverlay {
  constructor(options = {}) {
    this.x = options.x || 400;
    this.y = options.y || 10;
    this._remaining = 0;
  }

  update(remaining) {
    this._remaining = remaining;
  }

  render(ctx, scale = 1) {
    const mins = Math.floor(this._remaining / 60);
    const secs = this._remaining % 60;
    const text = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const isUrgent = this._remaining <= 10;

    ctx.save();
    ctx.font = `bold ${24}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(this.x - 40, this.y - 16, 80, 32);

    ctx.fillStyle = isUrgent ? '#ff4444' : '#ffffff';
    ctx.fillText(text, this.x, this.y);
    ctx.restore();
  }
}

export class HealthBarOverlay {
  constructor(options = {}) {
    this.x = options.x || 10;
    this.y = options.y || 60;
    this.width = options.width || 150;
    this.height = options.height || 12;
    this._bars = [];
  }

  update(bars) {
    this._bars = bars;
  }

  render(ctx, scale = 1) {
    ctx.save();

    for (let i = 0; i < this._bars.length; i++) {
      const bar = this._bars[i];
      const y = this.y + i * (this.height + 6);

      ctx.fillStyle = '#333';
      ctx.fillRect(this.x, y, this.width, this.height);

      const fillW = Math.max(0, (bar.current / bar.max) * this.width);
      ctx.fillStyle = bar.color || '#4caf50';
      ctx.fillRect(this.x, y, fillW, this.height);

      if (bar.label) {
        ctx.font = `${10}px monospace`;
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'bottom';
        ctx.fillText(bar.label, this.x, y - 2);
      }
    }

    ctx.restore();
  }
}

export class ProgressBarOverlay {
  constructor(options = {}) {
    this.x = options.x || 100;
    this.y = options.y || 300;
    this.width = options.width || 200;
    this.height = options.height || 24;
    this.label = options.label || '';
    this.color = options.color || '#4caf50';
    this._progress = 0;
  }

  update(progress) {
    this._progress = Math.max(0, Math.min(1, progress));
  }

  render(ctx, scale = 1) {
    ctx.save();

    ctx.fillStyle = '#333';
    ctx.fillRect(this.x, this.y, this.width, this.height);

    const fillW = this._progress * this.width;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, fillW, this.height);

    ctx.font = `${12}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(this.label, this.x + this.width / 2, this.y + this.height / 2);

    ctx.restore();
  }
}

export class CountdownOverlay {
  constructor(options = {}) {
    this._remaining = 0;
    this._active = false;
    this._lastDisplayed = -1;
    this.width = options.width || 800;
    this.height = options.height || 600;
  }

  start(seconds) {
    this._remaining = seconds;
    this._active = true;
    this._lastDisplayed = seconds;
  }

  update(remaining) {
    this._remaining = remaining;
    if (remaining > 0) {
      this._active = true;
    } else {
      this._active = false;
    }
  }

  render(ctx, scale = 1) {
    if (!this._active) return;
    const display = Math.ceil(this._remaining);
    const text = display > 0 ? String(display) : 'GO!';

    ctx.save();

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.font = `bold ${120}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = display > 0 ? '#ffffff' : '#4caf50';
    ctx.fillText(text, this.width / 2, this.height / 2);

    ctx.restore();
  }

  get active() { return this._active; }
}

export class GameOverOverlay {
  constructor(options = {}) {
    this._results = null;
    this._active = false;
    this._buttonLabel = options.buttonLabel || 'Back to Lobby';
    this._onBack = options.onBack || null;
    this.width = options.width || 800;
    this.height = options.height || 600;
  }

  show(results) {
    this._results = results;
    this._active = true;
  }

  hide() {
    this._results = null;
    this._active = false;
  }

  render(ctx, scale = 1) {
    if (!this._active || !this._results) return;

    ctx.save();

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.font = `bold ${48}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd700';

    const winners = this._results.winners || [];
    const winnerText = winners.length === 1 ? `${winners[0].name || winners[0]} Wins!` : 'Game Over!';
    ctx.fillText(winnerText, this.width / 2, 150);

    const scores = this._results.scores || this._results.finalScores || [];
    ctx.font = `${24}px monospace`;
    ctx.fillStyle = '#fff';

    for (let i = 0; i < scores.length; i++) {
      const s = scores[i];
      const name = s.name || s.playerId || `Player ${i + 1}`;
      const score = s.score ?? s.points ?? 0;
      ctx.fillText(`${name}: ${score}`, this.width / 2, 250 + i * 40);
    }

    ctx.restore();
  }

  get active() { return this._active; }
}
