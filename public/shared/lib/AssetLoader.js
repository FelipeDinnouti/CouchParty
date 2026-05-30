export class AssetLoader {
  constructor() {
    this.images = new Map();
    this.audio = new Map();
    this._loadedCount = 0;
    this._totalCount = 0;
    this._onProgress = null;
  }

  onProgress(callback) {
    this._onProgress = callback;
  }

  loadImages(manifest) {
    const entries = Object.entries(manifest);
    if (entries.length === 0) return Promise.resolve();
    this._totalCount += entries.length;

    return Promise.all(
      entries.map(([name, url]) => {
        if (this.images.has(name)) {
          this._loadedCount++;
          return Promise.resolve(this.images.get(name));
        }
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            this.images.set(name, img);
            this._loadedCount++;
            if (this._onProgress) this._onProgress(this._loadedCount, this._totalCount);
            resolve(img);
          };
          img.onerror = () => {
            console.warn(`AssetLoader: failed to load image "${name}" from ${url}`);
            this._loadedCount++;
            if (this._onProgress) this._onProgress(this._loadedCount, this._totalCount);
            resolve(null);
          };
          img.src = url;
        });
      })
    );
  }

  loadAudio(manifest) {
    const entries = Object.entries(manifest);
    if (entries.length === 0) return Promise.resolve();
    this._totalCount += entries.length;

    return Promise.all(
      entries.map(([name, url]) => {
        if (this.audio.has(name)) {
          this._loadedCount++;
          return Promise.resolve(this.audio.get(name));
        }
        return new Promise((resolve) => {
          const audio = new Audio();
          audio.preload = 'auto';
          audio.oncanplaythrough = () => {
            this.audio.set(name, audio);
            this._loadedCount++;
            if (this._onProgress) this._onProgress(this._loadedCount, this._totalCount);
            resolve(audio);
          };
          audio.onerror = () => {
            console.warn(`AssetLoader: failed to load audio "${name}" from ${url}`);
            this._loadedCount++;
            if (this._onProgress) this._onProgress(this._loadedCount, this._totalCount);
            resolve(null);
          };
          audio.src = url;
          audio.load();
        });
      })
    );
  }

  get progress() {
    if (this._totalCount === 0) return 1;
    return this._loadedCount / this._totalCount;
  }

  reset() {
    this.images.clear();
    this.audio.clear();
    this._loadedCount = 0;
    this._totalCount = 0;
    this._onProgress = null;
  }
}
