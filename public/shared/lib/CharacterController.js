import { clamp, lerp, distance } from './Physics.js';

const STATES = { IDLE: 'idle', RUNNING: 'running', JUMPING: 'jumping', FALLING: 'falling', STUNNED: 'stunned' };

export class CharacterController {
  constructor(options = {}) {
    this.mode = options.mode || 'platformer';
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.vx = 0;
    this.vy = 0;
    this.width = options.width || 32;
    this.height = options.height || 48;
    this.state = STATES.IDLE;
    this.facing = 'right';
    this.isOnGround = false;
    this._stunTimer = 0;

    if (this.mode === 'platformer') {
      this.maxSpeed = options.maxSpeed || 300;
      this.acceleration = options.acceleration || 800;
      this.friction = options.friction || 600;
      this.jumpVelocity = options.jumpVelocity || -400;
      this.gravity = options.gravity || 1200;
      this._jumpHeld = false;
      this._jumpTimer = 0;
      this._variableJumpWindow = 150;
    } else {
      this.maxSpeed = options.maxSpeed || 250;
      this.acceleration = options.acceleration || 600;
      this.friction = options.friction || 8;
      this.turnRadius = options.turnRadius || 0;
      this._currentAngle = 0;
    }
  }

  update(dt, input = {}) {
    const seconds = dt / 1000;

    if (this.state === STATES.STUNNED) {
      this._stunTimer -= dt;
      if (this._stunTimer <= 0) {
        this.state = STATES.IDLE;
      }
      this._applyGravity(seconds);
      this._applyPhysics(seconds);
      return;
    }

    if (this.mode === 'platformer') {
      this._updatePlatformer(seconds, input);
    } else {
      this._updateTopDown(seconds, input);
    }

    this._applyPhysics(seconds);
    this._updateFacing(input);
  }

  _updatePlatformer(seconds, input) {
    const moveX = input.x || 0;

    if (moveX !== 0) {
      this.vx += moveX * this.acceleration * seconds;
      this.vx = clamp(this.vx, -this.maxSpeed, this.maxSpeed);
    } else {
      if (Math.abs(this.vx) > 0) {
        const frictionForce = this.friction * seconds;
        if (Math.abs(this.vx) <= frictionForce) {
          this.vx = 0;
        } else {
          this.vx -= Math.sign(this.vx) * frictionForce;
        }
      }
    }

    if (input.jump && this.isOnGround) {
      this.vy = this.jumpVelocity;
      this.isOnGround = false;
      this.state = STATES.JUMPING;
      this._jumpHeld = true;
      this._jumpTimer = 0;
    }

    if (this._jumpHeld && !input.jump && this.vy < 0) {
      if (this._jumpTimer < this._variableJumpWindow) {
        this.vy *= 0.5;
      }
      this._jumpHeld = false;
    }

    if (this._jumpHeld) {
      this._jumpTimer += seconds * 1000;
    }

    this._applyGravity(seconds);
  }

  _updateTopDown(seconds, input) {
    const moveX = input.x || 0;
    const moveY = input.y || 0;

    if (moveX !== 0 || moveY !== 0) {
      const targetAngle = Math.atan2(moveY, moveX);
      if (this.turnRadius > 0) {
        this._currentAngle = lerp(this._currentAngle, targetAngle, this.turnRadius * seconds);
      } else {
        this._currentAngle = targetAngle;
      }

      this.vx = Math.cos(this._currentAngle) * this.maxSpeed;
      this.vy = Math.sin(this._currentAngle) * this.maxSpeed;
    } else {
      const frictionT = clamp(this.friction * seconds, 0, 1);
      this.vx = lerp(this.vx, 0, frictionT);
      this.vy = lerp(this.vy, 0, frictionT);
    }
  }

  _applyGravity(seconds) {
    if (!this.isOnGround) {
      this.vy += this.gravity * seconds;
    }
  }

  _applyPhysics(seconds) {
    this.x += this.vx * seconds;
    this.y += this.vy * seconds;

    if (this.mode === 'platformer') {
      if (this.isOnGround) {
        this.state = Math.abs(this.vx) > 10 ? STATES.RUNNING : STATES.IDLE;
      } else if (this.vy < 0) {
        this.state = STATES.JUMPING;
      } else {
        this.state = STATES.FALLING;
      }
    }
  }

  _updateFacing(input) {
    if (input.x < 0) this.facing = 'left';
    else if (input.x > 0) this.facing = 'right';
  }

  landOnGround(y) {
    this.y = y;
    this.vy = 0;
    this.isOnGround = true;
    if (this.state === STATES.JUMPING || this.state === STATES.FALLING) {
      this.state = Math.abs(this.vx) > 10 ? STATES.RUNNING : STATES.IDLE;
    }
  }

  applyKnockback(angle, force) {
    this.vx = Math.cos(angle) * force;
    this.vy = Math.sin(angle) * force;
    this.isOnGround = false;
  }

  stun(duration) {
    this.state = STATES.STUNNED;
    this._stunTimer = duration;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  getBounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  getState() {
    return {
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      state: this.state,
      facing: this.facing,
      isOnGround: this.isOnGround,
    };
  }

  resolveCollision(overlap, normal) {
    this.x += normal.x * overlap;
    this.y += normal.y * overlap;
  }
}
