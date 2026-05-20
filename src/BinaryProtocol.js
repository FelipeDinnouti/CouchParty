export class BinaryProtocol {
  static MESSAGE_TYPE = {
    ORIENTATION: 0x01,
  };

  static encodeOrientation(playerId, alpha, beta, gamma) {
    const buffer = new ArrayBuffer(17);
    const view = new DataView(buffer);

    view.setUint8(0, this.MESSAGE_TYPE.ORIENTATION);
    view.setUint32(1, parseInt(playerId.split('_')[1]) || 0, true);
    view.setFloat32(5, alpha, true);
    view.setFloat32(9, beta, true);
    view.setFloat32(13, gamma, true);

    return buffer;
  }

  static decodeOrientation(buffer) {
    if (!buffer || buffer.byteLength < 17) {
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