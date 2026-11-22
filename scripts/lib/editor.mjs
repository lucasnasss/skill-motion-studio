import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './project.mjs';

export const parseProbe = (probe) => {
  const video = (probe.streams ?? []).find((stream) => stream.codec_type === 'video');
  const audio = (probe.streams ?? []).find((stream) => stream.codec_type === 'audio');
  const durationSeconds = Number(probe.format?.duration ?? video?.duration ?? audio?.duration);
  if (!video || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('A mídia não contém um stream de vídeo com duração válida.');
  }
  return {
    durationSeconds,
    width: Number(video.width),
    height: Number(video.height),
    videoCodec: video.codec_name,
    pixelFormat: video.pix_fmt,
    audioCodec: audio?.codec_name ?? null,
    sampleRate: audio?.sample_rate ? Number(audio.sample_rate) : null,
    channels: audio?.channels ? Number(audio.channels) : null,
    hasAudio: Boolean(audio),
    format: probe.format?.format_name ?? null,
    sizeBytes: Number(probe.format?.size ?? 0),
  };
};

export const parseSilenceDetect = (text, durationSeconds) => {
  const events = [];
  const matcher = /silence_(start|end):\s*([0-9.]+)/g;
  for (const match of text.matchAll(matcher)) events.push({type: match[1], time: Number(match[2])});
  const silences = [];
  let start = null;
  for (const event of events) {
    if (event.type === 'start') start = Math.max(0, event.time);
    if (event.type === 'end' && start !== null) {
      silences.push({startSeconds: start, endSeconds: Math.min(durationSeconds, event.time)});
      start = null;
    }
  }
  if (start !== null) silences.push({startSeconds: start, endSeconds: durationSeconds});
  return silences.filter((range) => range.endSeconds > range.startSeconds);
};

export const parseVolumeDetect = (text) => {
  const mean = text.match(/mean_volume:\s*(-?[0-9.]+)\s*dB/i);
  const peak = text.match(/max_volume:\s*(-?[0-9.]+)\s*dB/i);
  return {
    meanVolumeDb: mean ? Number(mean[1]) : null,
    peakVolumeDb: peak ? Number(peak[1]) : null,
  };
};

export const buildKeepRanges = (durationSeconds, silences, intensity = 'conservative') => {
  const padding = intensity === 'editorial' ? 0.04 : intensity === 'dynamic' ? 0.08 : 0.18;
  const minimumClip = intensity === 'editorial' ? 0.12 : 0.2;
  const normalized = [...silences]
    .sort((a, b) => a.startSeconds - b.startSeconds)
    .map((silence) => ({
      startSeconds: Math.max(0, silence.startSeconds + padding),
      endSeconds: Math.min(durationSeconds, silence.endSeconds - padding),
    }))
    .filter((silence) => silence.endSeconds > silence.startSeconds);
  const ranges = [];
  let cursor = 0;
  for (const silence of normalized) {
    if (silence.startSeconds - cursor >= minimumClip) {
      ranges.push({startSeconds: cursor, endSeconds: silence.startSeconds, reason: 'fala ou conteúdo preservado'});
    }
    cursor = Math.max(cursor, silence.endSeconds);
  }
  if (durationSeconds - cursor >= minimumClip) {
    ranges.push({startSeconds: cursor, endSeconds: durationSeconds, reason: 'fala ou conteúdo preservado'});
  }
  return ranges.length ? ranges : [{startSeconds: 0, endSeconds: durationSeconds, reason: 'nenhuma pausa removível detectada'}];
};

const targetDimensions = (aspect, sourceWidth, sourceHeight) => {
  if (aspect === '9:16') return {width: 1080, height: 1920};
  if (aspect === '1:1') return {width: 1080, height: 1080};
  if (aspect === '16:9') return {width: 1920, height: 1080};
  const longEdge = Math.max(sourceWidth, sourceHeight) >= 1600 ? 1920 : 1080;
  const scale = longEdge / Math.max(sourceWidth, sourceHeight);
  const even = (value) => Math.max(320, Math.round(value / 2) * 2);
  return {width: even(sourceWidth * scale), height: even(sourceHeight * scale)};
};

export const importMedia = (inputFile) => {
  const absolute = path.resolve(inputFile);
  if (!fs.existsSync(absolute)) throw new Error(`Mídia não encontrada: ${absolute}`);
  const stat = fs.statSync(absolute);
  if (!stat.isFile()) throw new Error(`O caminho não é um arquivo: ${absolute}`);
  const extension = path.extname(absolute).toLowerCase();
  const supported = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v']);
  if (!supported.has(extension)) throw new Error(`Formato não suportado para edição: ${extension || '(sem extensão)'}`);
  const safeStem = path.basename(absolute, extension).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'video';
  const fingerprint = crypto.createHash('sha256').update(`${absolute}:${stat.size}:${stat.mtimeMs}`).digest('hex').slice(0, 10);
  const relative = `imports/${safeStem}-${fingerprint}${extension}`;
  const destination = path.join(ROOT, 'public', ...relative.split('/'));
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  if (!fs.existsSync(destination)) fs.copyFileSync(absolute, destination);
  return {absolute, relative, destination};
};

export const createEditProject = ({inputFile, importedSrc, media, silences, intensity = 'conservative', targetAspect = 'source', license = 'user-provided; authorization required'}) => {
  const keepRanges = buildKeepRanges(media.durationSeconds, silences, intensity);
  const dimensions = targetDimensions(targetAspect, media.width, media.height);
  const title = `Edição de ${path.basename(inputFile)}`;
  let timelineCursor = 0;
  const clips = keepRanges.map((range, index) => {
    const durationSeconds = Number((range.endSeconds - range.startSeconds).toFixed(6));
    const clip = {
      id: `clip-${String(index + 1).padStart(3, '0')}`,
      assetId: 'source-video',
      startSeconds: timelineCursor,
      durationSeconds,
      inPointSeconds: range.startSeconds,
      outPointSeconds: range.endSeconds,
    };
    timelineCursor += durationSeconds;
    return clip;
  });
  const scenes = clips.map((clip, index) => ({
    id: `edit-${String(index + 1).padStart(3, '0')}`,
    title: `Trecho ${index + 1}`,
    durationSeconds: clip.durationSeconds,
    background: '#000000',
    transition: {type: 'cut', durationSeconds: 0},
    elements: [{
      id: `video-${String(index + 1).padStart(3, '0')}`,
      type: 'video',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      src: importedSrc,
      fit: 'cover',
      startFromSeconds: clip.inPointSeconds,
      endAtSeconds: clip.outPointSeconds,
      volume: 1,
    }],
  }));
  return {
    version: '2.0',
    mode: 'edit',
    style: 'talking-head',
    title,
    prompt: `Editar ${path.basename(inputFile)} com intensidade ${intensity}.`,
    objective: 'Remover pausas detectadas preservando o significado e mantendo o projeto editável.',
    audience: 'Público de redes sociais',
    language: 'pt-BR',
    theme: 'modern',
    video: {...dimensions, fps: 30, safeMarginPct: 0.08},
    captions: {enabled: true, burnIn: false, position: 'bottom', style: 'highlight', highlightColor: '#FFCB69', maxWordsPerLine: 7},
    assets: {attributions: [{file: importedSrc, source: path.resolve(inputFile), license}]},
    media: [{id: 'source-video', type: 'video', src: importedSrc, license, durationSeconds: media.durationSeconds}],
    timeline: {durationSeconds: timelineCursor, tracks: [{id: 'video-main', type: 'video', clips}]},
    edit: {intensity, sourceAssetId: 'source-video', keepRanges, normalizeAudio: true, targetAspect},
    scenes,
  };
};

