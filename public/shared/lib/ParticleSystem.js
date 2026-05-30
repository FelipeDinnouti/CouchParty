class Particle {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    const speed = config.speed?.min != null
      ? config.speed.min + Math.random() * (config.speed.max - config.speed.min)
      : 50;
    const angle = config.angle?.min != null
      ? config.angle.min + Math.random() * (config.angle.max - config.angle.min)
      : Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.lifetime = config.lifetime?.min != null
      ? config.lifetime.min + Math.random() * (config.lifetime.max - config.lifetime.min)
      : 500;
    this.age = 0;
    this.color = Array.isArray(config.color)
      ? config.color[Math.floor(Math.random() * config.color.length)]
      : (config.color || '#fff');
    this.size = config.size?.min != null
      ? config.size.min + Math.random() * (config.size.max - config.size.min)
      : 4;
    this.gravity = config.gravity || 0;
    this.drag = config.drag || 0;
    this.fade = config.fade !== false;
    this.grow = config.grow || 0;
    this.alpha = 1;
  }

  update(dt) {
    const seconds = dt / 1000;
    this.age += dt;
    this.vy += this.gravity * seconds;
    const dragFactor = Math.max(0, 1 - this.drag * seconds);
    this.vx *= dragFactor;
    this.vy *= dragFactor;
    this.x += this.vx * seconds;
    this.y += this.vy * seconds;
    this.size += this.grow * seconds;

    const lifeRatio = this.age / this.lifetime;
    if (this.fade) {
      this.alpha = Math.max(0, 1 - lifeRatio);
    }
  }

  get alive() {
    return this.age < this.lifetime;
  }

  render(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0.5, this.size), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class ParticleSystem {
  constructor() {
    this._particles = [];
  }

  emit(config) {
    const count = config.count || 10;
    for (let i = 0; i < count; i++) {
      this._particles.push(new Particle(config));
    }
  }

  burst(x, y, options = {}) {
    this.emit({
      x, y,
      count: options.count || 20,
      speed: { min: options.minSpeed || 50, max: options.maxSpeed || 200 },
      angle: { min: 0, max: Math.PI * 2 },
      color: options.colors || ['#ff0', '#f80', '#f00'],
      size: { min: 2, max: 6 },
      lifetime: { min: 300, max: 800 },
      gravity: options.gravity || 0,
      fade: true,
    });
  }

  trail(x, y, options = {}) {
    this.emit({
      x, y,
      count: options.count || 3,
      speed: { min: 10, max: 40 },
      angle: { min: 0, max: Math.PI * 2 },
      color: options.colors || ['#aaa', '#fff'],
      size: { min: 1, max: 3 },
      lifetime: { min: 200, max: 400 },
      fade: true,
    });
  }

  fountain(x, y, options = {}) {
    this.emit({
      x, y,
      count: options.count || 5,
      speed: { min: options.minSpeed || 80, max: options.maxSpeed || 200 },
      angle: { min: -Math.PI, max: 0 },
      color: options.colors || ['#4fc3f7', '#29b6f6', '#0288d1'],
      size: { min: 2, max: 5 },
      lifetime: { min: 600, max: 1200 },
      gravity: options.gravity || 200,
      fade: true,
    });
  }

  confetti(x, y, options = {}) {
    this.emit({
      x, y,
      count: options.count || 50,
      speed: { min: 60, max: 250 },
      angle: { min: 0, max: Math.PI * 2 },
      color: options.colors || ['#e94560', '#0f3460', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4'],
      size: { min: 3, max: 8 },
      lifetime: { min: 1000, max: 3000 },
      gravity: options.gravity || 100,
      fade: true,
    });
  }

  update(dt) {
    for (let i = this._particles.length - 1; i >= 0; i--) {
      this._particles[i].update(dt);
      if (!this._particles[i].alive) {
        this._particles.splice(i, 1);
      }
    }
  }

  render(ctx) {
    for (const p of this._particles) {
      p.render(ctx);
    }
  }

  clear() {
    this._particles = [];
  }

  getCount() {
    return this._particles.length;
  }
}
