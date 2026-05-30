import fs from 'fs';
import path from 'path';
import { GameBase } from './GameBase.js';

export class GameLoader {
  constructor(gamesPath) {
    this.gamesPath = gamesPath;
    this.games = new Map();
  }

  async loadGames() {
    if (!fs.existsSync(this.gamesPath)) {
      console.warn(`Games directory not found: ${this.gamesPath}`);
      return;
    }

    const entries = fs.readdirSync(this.gamesPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const gameDir = path.join(this.gamesPath, entry.name);
      const gameFile = path.join(gameDir, 'game.js');

      if (!fs.existsSync(gameFile)) {
        continue;
      }

      try {
        const gameModule = await import(`file://${gameFile}`);
        const GameClass = gameModule.default || gameModule.Game;

        if (!GameClass) {
          console.warn(`No export found in ${gameFile}`);
          continue;
        }

        const instance = new GameClass();
        if (!(instance instanceof GameBase)) {
          console.warn(`${entry.name} does not extend GameBase`);
          continue;
        }
        if (!instance.id || !instance.name) {
          console.warn(`${entry.name} is missing required GameBase fields (id, name)`);
          continue;
        }

        this.games.set(instance.id, {
          GameClass,
          meta: {
            id: instance.id,
            name: instance.name,
            description: instance.description,
            minPlayers: instance.minPlayers,
            maxPlayers: instance.maxPlayers,
          },
        });

        console.log(`Loaded game: ${instance.name} (${entry.name})`);
      } catch (err) {
        console.error(`Failed to load game ${entry.name}:`, err.message);
      }
    }
  }

  getGameList() {
    return Array.from(this.games.values()).map(g => g.meta);
  }

  getGame(gameId) {
    const entry = this.games.get(gameId);
    if (!entry) {
      return null;
    }

    return new entry.GameClass();
  }

  hasGame(gameId) {
    return this.games.has(gameId);
  }
}
