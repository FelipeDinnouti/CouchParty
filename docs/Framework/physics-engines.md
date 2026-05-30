# Physics Engines

CouchParty ships with a lightweight `Physics.js` module (pure functions for AABB/circle/rect collision and vector math) that covers most party game needs. Games that require complex physics — platform fighters, physics puzzles, stacking, joints — can optionally import [Matter.js](https://github.com/liabru/matter-js) instead.

---

## When to Use Which

| Physics.js (built-in) | Matter.js (optional) |
|-----------------------|----------------------|
| 50 lines, zero dependencies | ~400KB, full rigid-body engine |
| AABB/circle/rect overlap tests | Concave polygon collision |
| `distance`, `lerp`, `clamp`, `normalize` | Constraints, joints, springs |
| No body simulation | Gravity, friction, restitution, velocity |
| Same code runs server-side | Server-side limited (see below) |

**Physics.js is enough for:** Pong, Racing (simple wall collisions), Wood Cutting (hitbox overlap), Cook-Off (drag-and-drop).

**Matter.js is useful for:** Platform fighters (Friend Bombs), physics puzzles, breakout clones, any game with stacking, bouncing, or complex body shapes.

---

## Using Matter.js

### 1. Add the dependency

Place the Matter.js bundle in `public/shared/`:

```bash
curl -L https://github.com/liabru/matter-js/releases/download/0.19.0/matter.min.js \
  -o public/shared/matter.min.js
```

### 2. Import in a game page

```html
<!-- public/games/mygame/globalScreen/index.html -->
<script src="/shared/matter.min.js"></script>
```

The global `Matter` object is then available:

```javascript
const { Engine, Render, Runner, Bodies, World } = Matter;

const engine = Engine.create();
const world = engine.world;

const box = Bodies.rectangle(400, 200, 80, 80, {
  restitution: 0.8,
  friction: 0.1,
});

World.add(world, [box]);

// In your game loop:
Engine.update(engine, deltaMs);
```

### 3. Import in server-side game.js (optional)

Games that run physics on the server can use Matter.js in Node.js too. It must be installed as a project dependency:

```bash
npm install matter-js
```

Then in `game.js`:

```javascript
import Matter from 'matter-js';

const { Engine, Bodies, World } = Matter;
```

Server-side Matter.js usage should avoid the `Render` module (no canvas in Node). Run `Engine.update(engine, delta)` in `onTick` and broadcast the resulting body positions to the global screen.

---

## Shared Physics.js + Matter.js

Some games use both — `Physics.js` for simple client-side checks (e.g., UI hit testing) and Matter.js for the core simulation. Both can coexist since `Physics.js` is just stateless functions.

## Limitations

- **No server-side canvas** — Matter.js `Render` module doesn't work in Node.js. Game server logic should use `Engine.update` and `Bodies` only; rendering happens on the client via `game:state` broadcasts.
- **Determinism** — Matter.js uses iterative solvers; results may vary slightly by frame rate. For deterministic multiplayer, consider fixed timesteps.
- **Mobile performance** — Matter.js is CPU-bound on phones for complex scenes (20+ bodies). Profile on target devices before committing to heavy simulations.

---

## Summary

| | Physics.js | Matter.js |
|---|---|---|
| Included | Yes (built-in) | No (opt-in) |
| Size | ~1 KB | ~400 KB |
| Best for | Simple 2D party games | Physics-heavy games |
| Server-safe | Yes (pure functions) | Yes (no Render module) |
