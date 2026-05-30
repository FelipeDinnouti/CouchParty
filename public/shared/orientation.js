let _orientationHandler = null;
let _streaming = false;
let _lastValues = { alpha: 0, beta: 0, gamma: 0 };

export function isOrientationAvailable() {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
}

export function requestOrientationPermission() {
  return new Promise((resolve) => {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(state => resolve(state === 'granted'))
        .catch(() => resolve(false));
    } else {
      resolve(true);
    }
  });
}

export function startOrientationStream(socket, onUpdate) {
  if (_streaming) return;

  requestOrientationPermission().then(granted => {
    if (!granted) return;

    _streaming = true;
    _orientationHandler = (event) => {
      const alpha = event.alpha || 0;
      const beta = event.beta || 0;
      const gamma = event.gamma || 0;
      _lastValues = { alpha, beta, gamma };

      if (onUpdate) onUpdate(_lastValues);

      if (socket && socket.connected) {
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
        socket.emit('game:orientation', buf);
      }
    };

    window.addEventListener('deviceorientation', _orientationHandler);
  });
}

export function stopOrientationStream() {
  if (_orientationHandler) {
    window.removeEventListener('deviceorientation', _orientationHandler);
    _orientationHandler = null;
  }
  _streaming = false;
}

export function getCurrentOrientation() {
  return { ..._lastValues };
}
