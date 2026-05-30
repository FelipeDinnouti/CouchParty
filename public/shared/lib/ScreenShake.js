export class ScreenShake {
  constructor() {
    this._intensity = 0;
    this._duration = 0;
    this._elapsed = 0;
    this._offsetX = 0;
    this._offsetY = 0;
    this._applied = false;
  }

  shake(intensity, duration) {
    this._intensity = Math.max(this._intensity, intensity);
    this._duration = Math.max(this._duration, duration);
    if (this._elapsed >= this._duration) {
      this._elapsed = 0;
    }
  }

  update(dt) {
    if (!this.isActive) return;
    this._elapsed += dt;
    if (this._elapsed >= this._duration) {
      this._intensity = 0;
      this._duration = 0;
      this._elapsed = 0;
      this._offsetX = 0;
      this._offsetY = 0;
      return;
    }
    const decay = 1 - this._elapsed / this._duration;
    const currentIntensity = this._intensity * decay;
    this._offsetX = (Math.random() * 2 - 1) * currentIntensity;
    this._offsetY = (Math.random() * 2 - 1) * currentIntensity;
  }

  apply(ctx) {
    if (!this.isActive) return;
    ctx.save();
    ctx.translate(this._offsetX, this._offsetY);
    this._applied = true;
  }

  reset(ctx) {
    if (!this._applied) return;
    ctx.restore();
    this._applied = false;
  }

  get isActive() {
    return this._elapsed < this._duration && this._intensity > 0;
  }
}
