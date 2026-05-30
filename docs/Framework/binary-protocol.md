# Binary Protocol

The Binary Protocol handles compact encoding of motion sensor data (gyroscope/accelerometer) to minimize bandwidth at 60Hz update rates.

---

## Why Binary?

Sending motion data as JSON at 60Hz per player would be wasteful:

| Format | Typical Size |
|--------|--------------|
| JSON | 80-120 bytes |
| Binary | 17 bytes |

For 4 players at 60 FPS, binary saves ~150KB/s of bandwidth.

---

## Packet Structure

Orientation packets are **17 bytes** (little-endian):

```
Offset  Size  Type      Description
------  ----  --------  -----------
0       1     uint8     Message type (0x01 = orientation)
1       4     uint32    Player ID number
5       4     float32   Alpha (rotation around Z-axis)
9       4     float32   Beta (rotation around X-axis)
13      4     float32   Gamma (rotation around Y-axis)
```

### Field Descriptions

| Field | Range | Description |
|-------|-------|-------------|
| Alpha | 0-360 | Rotation around Z-axis (compass direction) |
| Beta | -180 to 180 | Front-to-back tilt |
| Gamma | -90 to 90 | Left-to-right tilt |

---

## Encoding (Client Side)

### In orientation.js (shared)

```javascript
import { BinaryProtocol } from './BinaryProtocol.js';

function sendOrientation(playerId, alpha, beta, gamma) {
  const buffer = BinaryProtocol.encodeOrientation(playerId, alpha, beta, gamma);
  socket.binary(true).emit('game:orientation', buffer);
}
```

---

## Decoding (Server Side)

### In server.js

```javascript
import { BinaryProtocol } from './src/BinaryProtocol.js';

io.on('connection', (socket) => {
  socket.on('game:orientation', (buffer) => {
    // Check if it's a binary message
    if (BinaryProtocol.isBinaryMessage(buffer)) {
      const data = BinaryProtocol.decodeOrientation(buffer);
      if (data && currentGame) {
        currentGame.onOrientation(data.playerId, data.alpha, data.beta, data.gamma);
      }
    }
  });
});
```

---

## API Reference

### BinaryProtocol.encodeOrientation(playerId, alpha, beta, gamma)

Encodes orientation data into an ArrayBuffer.

```javascript
const buffer = BinaryProtocol.encodeOrientation('player_1', 45.0, 30.0, 15.0);
// Returns: ArrayBuffer(17)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| playerId | string | Player identifier (e.g., "player_1") |
| alpha | number | Z-axis rotation |
| beta | number | X-axis rotation |
| gamma | number | Y-axis rotation |

**Returns:** `ArrayBuffer` (17 bytes)

---

### BinaryProtocol.decodeOrientation(buffer)

Decodes an orientation packet from ArrayBuffer.

```javascript
const data = BinaryProtocol.decodeOrientation(buffer);
// Returns: { playerId, alpha, beta, gamma } or null
```

| Parameter | Type | Description |
|-----------|------|-------------|
| buffer | ArrayBuffer | Binary data to decode |

**Returns:** `{ playerId: string, alpha: number, beta: number, gamma: number }` or `null` if invalid

---

### BinaryProtocol.isBinaryMessage(buffer)

Checks if a buffer is a valid binary message.

```javascript
if (BinaryProtocol.isBinaryMessage(buffer)) {
  // Process as orientation data
}
```

---

## Enabling Motion Controls

The game must explicitly enable motion controls:

```javascript
// In game.js - onStart
async onStart({ players }) {
  this.requireOrientation = true;
  this.enableOrientation();  // Sends 'enableOrientation' to all controllers
}
```

### On the Controller (client)

```javascript
// In orientation.js
socket.on('enableOrientation', async () => {
  // Request iOS 13+ permission
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    const response = await DeviceOrientationEvent.requestPermission();
    if (response !== 'granted') return;
  }

  window.addEventListener('deviceorientation', (e) => {
    sendOrientation(playerId, e.alpha, e.beta, e.gamma);
  });
});

socket.on('disableOrientation', () => {
  window.removeEventListener('deviceorientation', handler);
});
```

---

## Protocol Extension

To add more data (e.g., accelerometer), extend the packet:

```
Offset  Size  Type      Description
------  ----  --------  -----------
0       1     uint8     Message type (0x02 = orientation+accel)
1       4     uint32    Player ID
5       4     float32   Alpha
9       4     float32   Beta
13      4     float32   Gamma
17      4     float32   Accelerometer X
21      4     float32   Accelerometer Y
25      4     float32   Accelerometer Z
```

Add new message type constants:

```javascript
static MESSAGE_TYPE = {
  ORIENTATION: 0x01,
  ORIENTATION_ACCEL: 0x02,
};
```

---

## Troubleshooting

### iOS Permission Denied
- User must tap to allow motion access
- Show clear UI prompting for permission
- Provide fallback to touch controls

### Null decoded data
- Check buffer size (must be >= 17 bytes)
- Verify message type byte is 0x01

### High latency
- Ensure binary flag is set on socket.emit
- Check local network latency (Wi-Fi quality)