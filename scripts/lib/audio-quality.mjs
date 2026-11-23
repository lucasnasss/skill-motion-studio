import fs from 'node:fs';

const db = (value) => value > 0 ? 20 * Math.log10(value) : -Infinity;

export const readPcm16Wav = (file) => {
  const buffer = fs.readFileSync(file);
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Esperado WAV RIFF.');
  let offset = 12; let format; let data;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ') format = {codec: buffer.readUInt16LE(start), channels: buffer.readUInt16LE(start + 2), sampleRate: buffer.readUInt32LE(start + 4), bits: buffer.readUInt16LE(start + 14)};
    if (id === 'data') data = buffer.subarray(start, start + size);
    offset = start + size + (size % 2);
  }
  if (!format || !data || format.codec !== 1 || format.bits !== 16) throw new Error('O analisador requer WAV PCM signed 16-bit.');
  const frames = Math.floor(data.length / (2 * format.channels));
  const samples = new Float64Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < format.channels; channel += 1) sum += data.readInt16LE((frame * format.channels + channel) * 2) / 32768;
    samples[frame] = sum / format.channels;
  }
  return {...format, samples, durationSeconds: frames / format.sampleRate};
};

export const analyzeSamples = (samples, sampleRate, options = {}) => {
  const windowSeconds = Number(options.windowSeconds ?? 0.1);
  const windowSize = Math.max(1, Math.round(sampleRate * windowSeconds));
  const silenceDb = Number(options.silenceDb ?? -45);
  let peak = 0; let sumSquares = 0; let clippingSamples = 0; let maxJump = 0;
  const windows = [];
  for (let index = 0; index < samples.length; index += 1) {
    const absolute = Math.abs(samples[index]); peak = Math.max(peak, absolute); sumSquares += samples[index] ** 2;
    if (absolute >= 0.999) clippingSamples += 1;
    if (index) maxJump = Math.max(maxJump, Math.abs(samples[index] - samples[index - 1]));
  }
  for (let start = 0; start < samples.length; start += windowSize) {
    const end = Math.min(samples.length, start + windowSize); let energy = 0;
    for (let index = start; index < end; index += 1) energy += samples[index] ** 2;
    windows.push({startSeconds: start / sampleRate, endSeconds: end / sampleRate, rmsDb: db(Math.sqrt(energy / Math.max(1, end - start)))});
  }
  const silences = []; let active = null;
  for (const window of windows) {
    if (window.rmsDb <= silenceDb && !active) active = {startSeconds: window.startSeconds, endSeconds: window.endSeconds};
    else if (window.rmsDb <= silenceDb) active.endSeconds = window.endSeconds;
    else if (active) { if (active.endSeconds - active.startSeconds >= 0.5) silences.push(active); active = null; }
  }
  if (active && active.endSeconds - active.startSeconds >= 0.5) silences.push(active);
  const interiorSilences = silences.filter((item) => item.startSeconds > 0.25 && item.endSeconds < samples.length / sampleRate - 0.25);
  const voiced = windows.filter((item) => item.rmsDb > silenceDb);
  let maxWindowDeltaDb = 0;
  for (let index = 1; index < voiced.length; index += 1) maxWindowDeltaDb = Math.max(maxWindowDeltaDb, Math.abs(voiced[index].rmsDb - voiced[index - 1].rmsDb));
  return {
    durationSeconds: samples.length / sampleRate,
    peakDbfs: db(peak), rmsDbfs: db(Math.sqrt(sumSquares / Math.max(1, samples.length))),
    clippingSamples, clippingRatio: clippingSamples / Math.max(1, samples.length),
    maxAdjacentJump: maxJump, maxWindowDeltaDb, silences, interiorSilences,
    pass: clippingSamples === 0 && maxJump < 1.8,
  };
};

export const analyzePcm16Wav = (file, options) => {
  const wav = readPcm16Wav(file);
  return {file, sampleRate: wav.sampleRate, channels: wav.channels, bits: wav.bits, ...analyzeSamples(wav.samples, wav.sampleRate, options)};
};
