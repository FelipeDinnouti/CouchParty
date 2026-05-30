export class AudioManager {
  constructor() {
    this._sounds = new Map();
    this._volume = 1;
    this._muted = false;
    this._context = null;
    this._unlocked = false;
  }

  _ensureContext() {
    if (this._context) return;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      this._context = new Ctor();
    } catch {
      console.warn('AudioManager: AudioContext not available');
    }
  }

  _unlock() {
    if (this._unlocked) return;
    this._ensureContext();
    if (!this._context) return;
    if (this._context.state === 'suspended') {
      this._context.resume();
    }
    this._unlocked = true;
  }

  addSounds(manifest) {
    for (const [name, url] of Object.entries(manifest)) {
      if (this._sounds.has(name)) continue;
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = url;
      audio.load();
      this._sounds.set(name, audio);
    }
  }

  play(name) {
    this._unlock();
    const audio = this._sounds.get(name);
    if (!audio) {
      console.warn(`AudioManager: sound "${name}" not found`);
      return;
    }
    if (this._muted) return;
    const clone = audio.cloneNode();
    clone.volume = this._volume;
    clone.play().catch(() => {});
  }

  setVolume(value) {
    this._volume = Math.max(0, Math.min(1, value));
  }

  mute() {
    this._muted = true;
  }

  unmute() {
    this._muted = false;
  }

  toggleMute() {
    this._muted = !this._muted;
  }

  get isMuted() {
    return this._muted;
  }
}
