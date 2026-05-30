export class BinaryProtocol {
  static PACKET_SIZE = 17;

  static MESSAGE_TYPE = {
    ORIENTATION: 0x01,
  };

  static encodeOrientation(playerId, alpha, beta, gamma) {
    if (typeof playerId !== 'string' || !playerId) {
      return null;
    }
    if (typeof alpha !== 'number' || typeof beta !== 'number' || typeof gamma !== 'number') {
      return null;
    }
    if (!Number.isFinite(alpha) || !Number.isFinite(beta) || !Number.isFinite(gamma)) {
      return null;
    }

    const parts = playerId.split('_');
    const numId = parts.length > 1 ? parseInt(parts[1], 10) : 0;

    const buffer = new ArrayBuffer(this.PACKET_SIZE);
    const view = new DataView(buffer);

    view.setUint8(0, this.MESSAGE_TYPE.ORIENTATION);
    view.setUint32(1, numId || 0, true);
    view.setFloat32(5, alpha, true);
    view.setFloat32(9, beta, true);
    view.setFloat32(13, gamma, true);

    return buffer;
  }

  static decodeOrientation(buffer) {
    if (!buffer || buffer.byteLength < this.PACKET_SIZE) {
      return null;
    }

    const view = new DataView(buffer);

    const messageType = view.getUint8(0);
    if (messageType !== this.MESSAGE_TYPE.ORIENTATION) {
      return null;
    }

    const playerIdNum = view.getUint32(1, true);
    const alpha = view.getFloat32(5, true);
    const beta = view.getFloat32(9, true);
    const gamma = view.getFloat32(13, true);

    if (!Number.isFinite(alpha) || !Number.isFinite(beta) || !Number.isFinite(gamma)) {
      return null;
    }

    return {
      playerId: `player_${playerIdNum}`,
      alpha,
      beta,
      gamma,
    };
  }

  static isBinaryMessage(buffer) {
    if (!buffer || buffer.byteLength < 1) {
      return false;
    }
    const view = new DataView(buffer);
    const type = view.getUint8(0);
    return type === this.MESSAGE_TYPE.ORIENTATION;
  }
}
