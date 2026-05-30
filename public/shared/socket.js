let playerToken = localStorage.getItem('cp_token');
let playerId = localStorage.getItem('cp_playerId');
let playerName = localStorage.getItem('cp_playerName');
let playerColor = localStorage.getItem('cp_playerColor');
let playerRole = localStorage.getItem('cp_role');

let _socket = null;

function getSocket() {
  if (_socket && _socket.connected) return _socket;

  _socket = io({
    query: playerToken ? { token: playerToken } : {},
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  _socket.on('connect', () => {
    document.body.classList.add('connected');
    document.body.classList.remove('disconnected');
  });

  _socket.on('disconnect', () => {
    document.body.classList.add('disconnected');
    document.body.classList.remove('connected');
  });

  _socket.on('connect_error', () => {
    document.body.classList.add('disconnected');
    document.body.classList.remove('connected');
  });

  _socket.on('player:joined', ({ player, token }) => {
    playerToken = token;
    playerId = player.id;
    playerName = player.name;
    playerColor = player.color;
    localStorage.setItem('cp_token', token);
    localStorage.setItem('cp_playerId', player.id);
    localStorage.setItem('cp_playerName', player.name);
    localStorage.setItem('cp_playerColor', player.color);
  });

  _socket.on('player:reconnected', ({ player }) => {
    playerId = player.id;
    playerName = player.name;
    playerColor = player.color;
    localStorage.setItem('cp_playerId', player.id);
    localStorage.setItem('cp_playerName', player.name);
    localStorage.setItem('cp_playerColor', player.color);
  });

  _socket.on('game:start', (payload) => {
    if (payload.players) {
      localStorage.setItem('cp_gamePlayers', JSON.stringify(payload.players));
    }
    window.dispatchEvent(new CustomEvent('game:start', { detail: payload }));
    if (playerRole === 'controller') {
      window.location.href = payload.controllerUrl;
    } else {
      window.location.href = payload.globalScreenUrl;
    }
  });

  _socket.on('game:end', (results) => {
    window.dispatchEvent(new CustomEvent('game:end', { detail: results }));

    const delay = results && results.scores ? 3000 : 500;
    setTimeout(() => {
      if (playerRole === 'controller') {
        window.location.href = '/lobby/controller.html';
      } else {
        window.location.href = '/lobby/globalScreen.html';
      }
    }, delay);
  });

  return _socket;
}
