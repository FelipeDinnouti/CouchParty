export class GameClient {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.virtualWidth = options.virtualWidth || 800;
    this.virtualHeight = options.virtualHeight || 600;
    this.backgroundColor = options.backgroundColor || '#1a1a2e';
    this.socket = null;
    this.state = {};
    this.time = 0;
    this._rafId = null;
    this._running = false;
    this._overlays = [];
    this._resizeHandler = null;

    this._setupCanvas();
    this._setupResizeHandler();
  }

  _setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const scale = Math.min(w / this.virtualWidth, h / this.virtualHeight);
    const displayW = Math.floor(this.virtualWidth * scale);
    const displayH = Math.floor(this.virtualHeight * scale);

    this.canvas.width = displayW * dpr;
    this.canvas.height = displayH * dpr;
    this.canvas.style.width = `${displayW}px`;
    this.canvas.style.height = `${displayH}px`;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._scale = scale;
    this._offsetX = Math.floor((w - displayW) / 2);
    this._offsetY = Math.floor((h - displayH) / 2);
  }

  _setupResizeHandler() {
    this._resizeHandler = () => this._setupCanvas();
    window.addEventListener('resize', this._resizeHandler);
  }

  setSocket(socket) {
    this.socket = socket;
    socket.on('game:state', (state) => this.onState(state));
    socket.on('game:end', (results) => this.onGameEnd(results));
    socket.on('game:countdown', ({ remaining }) => this.onCountdown(remaining));
    socket.on('game:timer', ({ remaining }) => this.onTimer(remaining));
  }

  start() {
    if (this._running) return;
    this._running = true;
    let lastTime = performance.now();
    const loop = (now) => {
      if (!this._running) return;
      const dt = now - lastTime;
      lastTime = now;
      this.time += dt;
      this.onTick(dt);
      this._render();
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  stop() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _render() {
    this.ctx.save();
    this.ctx.translate(this._offsetX, this._offsetY);

    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, this.virtualWidth * this._scale, this.virtualHeight * this._scale);

    this.ctx.save();
    this.ctx.scale(this._scale, this._scale);
    this.render();
    this.ctx.restore();

    for (const overlay of this._overlays) {
      overlay.render(this.ctx, this._scale);
    }

    this.ctx.restore();
  }

  addOverlay(overlay) {
    this._overlays.push(overlay);
  }

  removeOverlay(overlay) {
    const idx = this._overlays.indexOf(overlay);
    if (idx !== -1) this._overlays.splice(idx, 1);
  }

  clearOverlays() {
    this._overlays = [];
  }

  onTick(dt) {}
  onState(state) { this.state = state; }
  onGameEnd(results) {}
  onCountdown(remaining) {}
  onTimer(remaining) {}
  render() {}

  destroy() {
    this.stop();
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    if (this.socket) {
      this.socket.off('game:state');
      this.socket.off('game:end');
      this.socket.off('game:countdown');
      this.socket.off('game:timer');
    }
  }

  get scale() { return this._scale; }
}
