export class ControllerClient {
  constructor() {
    this.socket = null;
    this.input = { x: 0, y: 0, buttons: {}, tilt: null };
    this._joystick = null;
    this._buttons = new Map();
    this._orientationEnabled = false;
    this._orientationHandler = null;
  }

  setSocket(socket) {
    this.socket = socket;
    socket.on('enableOrientation', () => this.enableOrientation());
    socket.on('disableOrientation', () => this.disableOrientation());
  }

  createJoystick(zoneId, options = {}) {
    if (typeof nipplejs === 'undefined') {
      console.warn('ControllerClient: nipplejs not loaded');
      return null;
    }

    const zone = document.getElementById(zoneId);
    if (!zone) {
      console.warn(`ControllerClient: zone "${zoneId}" not found`);
      return null;
    }

    this._joystick = nipplejs.create({
      zone,
      mode: 'static',
      position: options.position || { left: '50%', top: '50%' },
      color: options.color || '#e94560',
      size: options.size || 100,
      ...options.nippleOptions,
    });

    this._joystick.on('move', (evt, data) => {
      const x = data.vector ? data.vector.x : 0;
      const y = data.vector ? data.vector.y : 0;
      this.input.x = x;
      this.input.y = y;
      this.sendInput({ type: 'joystick', x, y });
    });

    this._joystick.on('end', () => {
      this.input.x = 0;
      this.input.y = 0;
      this.sendInput({ type: 'joystick', x: 0, y: 0 });
    });

    return this._joystick;
  }

  createButton(id, element, options = {}) {
    const el = typeof element === 'string' ? document.getElementById(element) : element;
    if (!el) {
      console.warn(`ControllerClient: button element for "${id}" not found`);
      return;
    }

    const button = { id, element: el, pressed: false };

    const onStart = (e) => {
      e.preventDefault();
      button.pressed = true;
      this.input.buttons[id] = true;
      this.sendInput({ type: 'button', button: id, pressed: true });
      if (options.onPress) options.onPress();
    };

    const onEnd = (e) => {
      e.preventDefault();
      button.pressed = false;
      this.input.buttons[id] = false;
      this.sendInput({ type: 'button', button: id, pressed: false });
      if (options.onRelease) options.onRelease();
    };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: false });
    el.addEventListener('touchcancel', onEnd, { passive: false });
    el.addEventListener('mousedown', onStart);
    el.addEventListener('mouseup', onEnd);
    el.addEventListener('mouseleave', onEnd);

    button.destroy = () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      el.removeEventListener('mousedown', onStart);
      el.removeEventListener('mouseup', onEnd);
      el.removeEventListener('mouseleave', onEnd);
    };

    this._buttons.set(id, button);
    return button;
  }

  enableOrientation() {
    if (this._orientationEnabled) return;
    this._orientationEnabled = true;

    const requestPermission = () => {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(state => {
            if (state === 'granted') this._startListening();
          })
          .catch(() => {});
      } else {
        this._startListening();
      }
    };

    if (document.readyState === 'complete') {
      requestPermission();
    } else {
      window.addEventListener('load', requestPermission, { once: true });
    }
  }

  _startListening() {
    if (this._orientationHandler) return;

    this._orientationHandler = (event) => {
      const alpha = event.alpha || 0;
      const beta = event.beta || 0;
      const gamma = event.gamma || 0;
      this.input.tilt = { alpha, beta, gamma };
      this._sendOrientation(alpha, beta, gamma);
    };

    window.addEventListener('deviceorientation', this._orientationHandler);
  }

  _sendOrientation(alpha, beta, gamma) {
    if (!this.socket) return;

    const playerId = localStorage.getItem('cp_playerId') || '';
    const parts = playerId.split('_');
    const numId = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    const buf = new ArrayBuffer(17);
    const view = new DataView(buf);
    view.setUint8(0, 0x01);
    view.setUint32(1, numId || 0, true);
    view.setFloat32(5, alpha, true);
    view.setFloat32(9, beta, true);
    view.setFloat32(13, gamma, true);
    this.socket.emit('game:orientation', buf);
  }

  disableOrientation() {
    if (this._orientationHandler) {
      window.removeEventListener('deviceorientation', this._orientationHandler);
      this._orientationHandler = null;
    }
    this._orientationEnabled = false;
    this.input.tilt = null;
  }

  vibrate(duration) {
    if (navigator.vibrate) {
      navigator.vibrate(duration);
    }
  }

  sendInput(data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('game:input', data);
    }
  }

  destroy() {
    this.disableOrientation();
    if (this._joystick) {
      this._joystick.destroy();
      this._joystick = null;
    }
    for (const button of this._buttons.values()) {
      if (button.destroy) button.destroy();
    }
    this._buttons.clear();
    if (this.socket) {
      this.socket.off('enableOrientation');
      this.socket.off('disableOrientation');
    }
  }
}
