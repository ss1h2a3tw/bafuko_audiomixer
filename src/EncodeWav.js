const BIT_DEPTH = 16;

export function encodeWAV(audioBuffer) {
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;
  const dataLength = (length * numberOfChannels * BIT_DEPTH) / 8;
  let buffer = new ArrayBuffer(44 + dataLength);
  let view = new DataView(buffer);
  let idx = 0;
  let addUint8 = (val) => {
    view.setUint8(idx, val, true);
    idx += 1;
  };
  let addUint16 = (val) => {
    view.setUint16(idx, val, true);
    idx += 2;
  };
  let addUint32 = (val) => {
    view.setUint32(idx, val, true);
    idx += 4;
  };
  let addInt16 = (val) => {
    view.setInt16(idx, val, true);
    idx += 2;
  };
  let addInt32 = (val) => {
    view.setInt32(idx, val, true);
    idx += 4;
  };
  let addString = (str) => {
    for (let idx in str) {
      addUint8(str.charCodeAt(idx));
    }
  };
  addString('RIFF');
  addUint32(36 + dataLength);
  addString('WAVE');
  // PCM metadata
  addString('fmt ');
  addUint32(16);
  addUint16(1);
  addUint16(numberOfChannels);
  addUint32(sampleRate);
  addUint32((sampleRate * numberOfChannels * BIT_DEPTH) / 8);
  addUint16((numberOfChannels * BIT_DEPTH) / 8);
  addUint16(BIT_DEPTH);
  // data
  addString('data');
  addUint32(dataLength);
  let toPCMInt = (val) => {
    const mul = 1 << (BIT_DEPTH - 1);
    const max = mul - 1;
    const min = -mul;
    val = Math.round(val * mul);
    val = Math.min(max, val);
    val = Math.max(min, val);
    return val;
  };
  let addData = undefined;
  if (BIT_DEPTH === 16) {
    addData = addInt16;
  } else {
    addData = addInt32;
  }
  let data = [];
  for (let i = 0; i < numberOfChannels; i++) {
    data.push(audioBuffer.getChannelData(i));
  }
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < numberOfChannels; j++) {
      addData(toPCMInt(data[j][i]));
    }
  }
  return buffer;
}
