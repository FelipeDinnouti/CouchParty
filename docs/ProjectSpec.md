The following document is the specification of a clean, scalable architecture for this game project, covering tech stack, binary orientation data, game framework and global player and points system.

1. Tech Stack

Layer Choice Why
Runtime Node.js (v18+) Fast, JS everywhere, excellent package ecosystem.
HTTP + Static Express Simple to serve globalScreen/phone pages, assets, and API endpoints.
Real‑time comms Socket.IO (with built‑in binary) Rooms, automatic reconnection, fallback, and binary message support (ArrayBuffer) – perfect for your orientation data.
State management In‑memory in Node.js (for small group) No DB needed for a local party setup; maximum simplicity.
Game rendering (Global Screen) Each game can choose: vanilla Canvas, Phaser 3, PixiJS, or just HTML/CSS. The framework shouldn’t force a renderer; games bring their own.
Phone UI Vanilla web (HTML/CSS/JS) Lightweight, no framework overhead, works everywhere.

No build step required – the server serves raw ES modules or plain <script> tags. Games can be as simple as a few .js and .html files.

---

2. Folder Structure (the key to plug‑and‑play games)

```
party-games/
├── server.js                  ← Entry point: sets up Express + Socket.IO
├── package.json
├── public/                    ← Static root
│   ├── lobby/                 ← Common lobby globalScreen & controller pages
│   │   ├── globalScreen.html
│   │   └── controller.html
│   ├── shared/                ← Shared scripts & styles
│   │   ├── socket.js          ← Socket.IO client helper (connection, common messages)
│   │   ├── orientation.js     ← Gyro/accel helper (client‑side)
│   │   └── styles.css
│   └── games/
│       ├── pong/
│       │   ├── game.js        ← Server‑side game logic
│       │   ├── globalScreen/   ← Global screen page assets
│       │   │   ├── index.html
│       │   │   └── pong-globalScreen.js
│       │   └── controller/    ← Phone page assets
│       │       ├── index.html
│       │       └── pong-controller.js
│       ├── trivia/
│       │   ├── game.js
│       │   ├── globalScreen/
│       │   └── controller/
│       └── …more games…
└── src/                       ← Core framework
    ├── PlayerManager.js       ← Global player/rooms/scores
    ├── GameBase.js            ← Base class all games must extend
    ├── BinaryProtocol.js      ← Handling binary orientation packets
    └── GameLoader.js          ← Scans /games/*/game.js, loads them dynamically
```

New game? Create a folder games/my-new-game/ with a game.js (server logic) and front‑end folders. The server auto‑discovers it on restart. That’s it.

---

3. The Core Framework (GameBase Class)

Every game module exports a class extending GameBase. The framework calls these lifecycle hooks:

```javascript
// src/GameBase.js
class GameBase {
  constructor(id, name, description, minPlayers, maxPlayers) { … }

  // Called when the game is about to start, players is array of player objects
  async onStart({ players, globalScoreboard }) { }

  // Called when a player sends a game‑specific input (already parsed)
  onInput(playerId, data) { }

  // Called when a player disconnects mid‑game (return true if game can continue)
  onPlayerLeave(playerId) { }

  // Called ~60 times per second with delta time (ms)
  onTick(deltaMs) { }

  // Standard way to broadcast full state to global screen or to individual phones
  sendToGlobalScreen(event, payload) { }
  sendToPlayer(playerId, event, payload) { }

  // Must be called when the game finishes
  endGame(results) { }   // results could contain final scores
}
```

The framework provides sendToGlobalScreen / sendToPlayer which automatically target the correct Socket.IO rooms (room: game_{gameId}_globalScreen, player_{playerId}). Games never touch raw sockets directly.

Registration: The server’s GameLoader.js reads all game.js files, requires them, and builds a dictionary:

```javascript
const games = {
  'pong': { ...PongGameInstance, meta },
  'trivia': { ...TriviaGameInstance, meta },
};
```

On lobby selection, the server:

1. Instantiates the chosen game's class.
2. Tells all players to load GET /games/pong/globalScreen/index.html (global screen) or /games/pong/controller/index.html (phones).
3. Calls game.onStart({ players }).

The global screen and phone pages just contain the UI; they listen for official server events and send inputs like:

```javascript
socket.emit('game:input', { type: 'button', button: 'A' });
```

And the server’s GameBase routes that to game.onInput(playerId, data).

---

4. Global Player & Points System

PlayerManager runs independently of any game. It handles:

· Connections / disconnections (assigning playerId, persistent reconnection via token).
· Active players in the lobby.
· A global scoreboard that can survive across multiple games (for a tournament).

When a game ends via endGame({ winners, scores }), the framework automatically updates the global scoreboard. Games can also award points during play via:

```javascript
this.addPoints(playerId, points);   // available inside GameBase
```

The lobby global screen page shows the global leaderboard. This is all managed in PlayerManager, completely separate from individual game logic.

---

5. Binary Orientation Packages – On‑Demand

You want high‑frequency gyro data, but only if a game needs it (e.g., motion‑controlled bowling). Sending full JSON at 60 Hz per player is wasteful; binary is ideal.

Protocol overview:

1. Game declares during onStart that it wants orientation data:
      this.requireOrientation = true;
2. The server sends a message to each player’s phone: 'enableOrientation'.
3. The phone’s orientation.js helper asks for permission (iOS), then starts a deviceorientation listener. It captures { alpha, beta, gamma } as three 32‑bit floats.
4. Instead of JSON, it sends a binary WebSocket message:
   ```
   Byte 0: 0x01  (message type = orientation)
   Bytes 1-4: playerId  (Uint32, big‑endian)
   Bytes 5-8: alpha (Float32)
   Bytes 9-12: beta (Float32)
   Bytes 13-16: gamma (Float32)
   ```
   (If you need timestamp or accelerometer, extend the packet.)
5. The server receives this binary ArrayBuffer, decodes it in BinaryProtocol.js, and calls game.onOrientation(playerId, alpha, beta, gamma).
6. When the game ends (or a player pauses), the server sends 'disableOrientation', and the phone stops streaming.

Benefits:

· Only active when needed.
· ~17 byte payload vs. >80 bytes JSON → lower latency and CPU usage.
· Socket.IO handles binary transparently (socket.binary(...) or sending a Buffer).

The framework provides a helper to enable/disable on all players with a single call.

---

6. How the Game Plugin and Global Screen/Phone Pages Interact

The global screen page for a game is dumb: it only renders the visual state and maybe handles "start game" from a remote or host device. It receives state snapshots from the server (e.g., paddle positions, scores) via Socket.IO room game_{id}_globalScreen. It never sends inputs except maybe a "pause" or "back to lobby".

The phone controller page:

· Shows buttons, joysticks, or a "tilt active" indicator.
· Sends game:input messages (JSON) for discrete actions.
· If orientation is enabled, stops sending JSON for motion and switches to binary packets.
· Receives private feedback (vibrate, flash, sound) over the socket.

The game server logic (Node.js) runs a fixed‑timestep or variable‑timestep loop (using setInterval or requestAnimationFrame on server side via a timer) that calls onTick(delta). Inside onTick, the game updates physics/state, then broadcasts to global screen and (optionally) phones.

---

7. Lobby Flow & Game Session Lifecycle

1. Global screen opens http://192.168.1.10:3000/lobby/globalScreen.html → shows a "Join with your phone" screen + a QR code.
2. Phones open http://192.168.1.10:3000/lobby/controller.html → enter a name, join → appear in lobby.
3. Host device (remote or phone) browses the list of available games (fetched from server). Selects one.
4. Server:
   · Creates a new game session with all connected players.
   · Moves players from lobby room to game room.
   · Tells all devices to navigate to the respective game URLs.
   · Instantiates GameClass and calls onStart.
5. Game plays.
6. On game end, scores are reported, devices are moved back to the lobby, and global points updated.

The framework ensures no game has to implement any of this network choreography.

---

8. Practical Implementation Steps (Starting Point)

· skeleton server: server.js initializes Express, Socket.IO, PlayerManager, GameLoader.
· Lobby pages: simple enough that they can be reused for all games.
· Example game – “Pong”:
  · Server: PongGame extends GameBase, tracks ball/paddles, uses orientation for paddle position.
  · Global Screen: renders game field, updates from server state.
  · Phone: shows “tilt to move” hint; sends binary orientation.
· Binary helper: small module that handles encoding/decoding and permission prompts.

---

9. Addressing Edge Cases & Limits

· Wi‑Fi latency: local network is fine; but if you send orientation at 60 Hz, use binary.
· iOS motion permissions: the orientation.js helper wraps the pop‑up flow gracefully.
· Reconnection: players get a token stored in localStorage; if they reconnect, they’re placed back into their game session. The base game’s onPlayerReconnect can restore phone UI state.
· Full‑screen on TV Stick: the global screen page can use the Fullscreen API on first touch; on Xiaomi, it may need a user click. Provide a big “Go Fullscreen” button.

---

10. Next Level: Zero‑latency Peer‑to‑Peer?

For games that need immediate feedback (like a driving game where the phone screen shows a wheel and the global screen shows the road), you could eventually bypass the server for some messages using WebRTC data channels directly between phone and TV, but for a first version, the client‑server model is more than enough and far simpler.

---

In summary: The “framework” is essentially a set of base classes and a loader that makes network plumbing, lobby management, and binary orientation a one‑line opt‑in for each game. You get a fully modular system where each game folder is self‑contained, and you can add as many minigames as you like without touching the core server.

I can provide a minimal working code example of the GameBase, PlayerManager, and binary orientation helper if you’d like to start building immediately.