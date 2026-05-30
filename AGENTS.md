# AGENTS.md — AI Agent Context for CouchParty

## Project Overview

CouchParty is a local network multiplayer party game platform. Players use their phones as controllers and a shared TV/laptop screen shows the game. No app downloads, no accounts — just a browser.

**Purpose:** A Wii-Sports-style party machine using only web tech and devices people already own.

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | Node.js 18+ | Fast, JS everywhere |
| HTTP | Express | Simple static serving + API |
| Real-time | Socket.IO | Rooms, binary, reconnection |
| State | In-memory | No DB needed for local parties |
| Rendering | Vanilla Canvas / Phaser / Pixi | Game chooses |
| Phone UI | Vanilla HTML/CSS/JS | No framework overhead |

**No build step** — raw ES modules and `<script>` tags served directly.

## Folder Structure

```
CouchParty/
├── server.js              ← Entry point (not yet built)
├── package.json
├── currently.md           ← Project status tracker
├── AGENTS.md              ← This file
├── src/                   ← Core framework (complete)
│   ├── GameBase.js        ← Base class all games extend
│   ├── PlayerManager.js   ← Player identity, scores, reconnection
│   ├── BinaryProtocol.js  ← Binary orientation encode/decode
│   └── GameLoader.js      ← Auto-discovers games
├── public/                ← Static files (not yet created)
│   ├── lobby/             ← Global screen + controller pages
│   ├── shared/            ← Shared client scripts
│   └── games/             ← Game plugin folders
└── docs/                  ← Documentation (Obsidian vault)
```

## Documentation-First Philosophy

Documentation is the **core** of this project, not an afterthought. Every design decision, API, and workflow must be documented in `docs/` before or alongside implementation. The docs are the source of truth — code follows docs, not the other way around.

- No feature is complete until its documentation is written and consistent
- Design choices must be documented to explain *why*, not just *what*
- When reading code, update docs if they're out of sync
- `docs/` is an Obsidian vault — use [[wiki links]] and tagging for cross-referencing

## Key Architectural Decisions

1. **Modular games** — Each game is a self-contained folder under `public/games/`. Add a folder, restart server. No code changes.
2. **Binary orientation protocol** — 17-byte packets vs 80+ bytes JSON for 60Hz motion data. Only enabled when a game opts in via `this.requireOrientation = true`.
3. **Global scoreboard** — Points persist across games within a session. Tournament-style play.
4. **Reconnection tokens** — Players get a token on first join; if they disconnect, they can rejoin their game session.
5. **Socket.IO rooms** — `lobby`, `game_{id}`, `game_{id}_globalScreen`, `player_{id}` for targeted messaging.

## Development Workflow

### 1. Development

- **Run the server:** `npm run dev` (uses `node --watch` for auto-restart)
- **Add a game:** Create `public/games/<name>/game.js` (extends `GameBase`), `globalScreen/index.html`, `controller/index.html`
- **Framework Test Harness** at `public/games/test-harness/` exercises every framework feature — use it to validate changes
- **All code is ES modules** — `import`/`export` syntax throughout
- **No bundler** — raw JS served directly from `public/`

### 2. Code Review Checklist

- Does the new game extend `GameBase` and implement required lifecycle hooks?
- Are all intervals/timeouts cleaned up in `onPlayerLeave`?
- Is `endGame()` called when the game finishes?
- Is input validated (don't trust client data)?
- Are binary packets used only when `requireOrientation = true`?
- Does the game handle min/max player counts properly?
- Are Socket.IO events namespaced correctly (`game:input`, `game:state`, etc.)?

### 3. Framework Test Harness

Before committing changes, run the Framework Test Harness (`public/games/test-harness/`) to validate framework features:

1. Start the server with `npm run dev`
2. Open the global screen, join with 1-4 controllers
3. Start the "Framework Test Harness" game
4. Run each test from the controller (onStart, onTick, onInput, communication, scores, orientation, endGame)
5. Verify all tests pass on the global screen
6. Run `node test/lobby.js` for integration tests

### 4. User-Assisted Testing

Before committing changes, verify manually:

1. Start the server with `npm run dev`
2. Open `http://localhost:3000` in a browser (simulates global screen)
3. Open additional browser tabs or phone browsers for controllers
4. Join with player names, verify they appear in the lobby
5. Start a game, verify:
   - Global screen shows game state
   - Controllers send input
   - Game ends correctly and returns to lobby
   - Global scores are updated
6. Test disconnection/reconnection (refresh a controller tab)
7. Test with minimum and maximum player counts

### 4. Documentation

- Keep `currently.md` up to date — update it after every step or change
- Documentation lives in `docs/` (an Obsidian vault)
- When adding a new game, update:
  - `docs/Games/<name>.md` if the game is a planned concept
  - `docs/Framework/game-plugin.md` if the plugin API changes
- When changing framework code, update the corresponding doc in `docs/Framework/`
- Whenever you modify any code or docs, check if `currently.md` needs updating

## Reading Order for New Contributors

1. `README.md` — Quick start
2. `docs/TheIdea.md` — What this project is about (2 min)
3. `docs/Architecture/overview.md` — How it works (5 min)
4. `docs/Framework/game-plugin.md` — How to make a game (10 min)
5. `src/GameBase.js` + `src/PlayerManager.js` — The actual code

## Integration Testing

Integration tests are in `test/lobby.js`. They spin up a real Socket.IO server, connect simulated browser clients, and verify the full message flow.

```bash
node test/lobby.js
```

Requires `socket.io-client` dev dependency (already installed). See `docs/Development/testing.md` for the testing guide and patterns for writing new tests.

---

## Documentation Reference

- **Full spec:** `docs/ProjectSpec.md`
- **Architecture:** `docs/Architecture/overview.md`
- **GameBase API:** `docs/Framework/lifecycle.md`
- **PlayerManager API:** `docs/Framework/player-manager.md`
- **Binary protocol:** `docs/Framework/binary-protocol.md`
- **Creating games:** `docs/Framework/game-plugin.md`
- **Terminology:** `docs/Architecture/terminology.md`
- **Implementation plan:** `docs/ImplementationPlan.md`
