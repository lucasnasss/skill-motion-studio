import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './project.mjs';

const configFile = path.join(ROOT, 'assets', 'tts-presets.json');

export const readTtsConfig = () => JSON.parse(fs.readFileSync(configFile, 'utf8'));

export const normalizeNarrationText = (input, pronunciation = {}) => {
  let text = String(input ?? '')
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '. ')
    .replace(/\.{2,}/g, '.')
    .trim();
  const builtIn = {
    'IA': 'I A', 'DNA': 'D N A', 'RNA': 'R N A', 'pH': 'pê agá',
    'km/h': 'quilômetros por hora', '°C': 'graus Celsius',
  };
  for (const [source, replacement] of Object.entries({...builtIn, ...pronunciation})) {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu'), replacement);
  }
  text = text.replace(/(\d)\s*%/g, '$1 por cento');
  text = text.replace(/\s+([,.;:!?])/g, '$1').replace(/([,;:!?])(?=\S)/g, '$1 ');
  if (text && !/[.!?…]$/.test(text)) text += '.';
  return text;
};

export const resolveTtsSettings = (options = {}, saved = {}) => {
  const config = readTtsConfig();
  const presetName = String(options.preset ?? saved.preset ?? config.defaults.preset);
  const preset = config.presets[presetName];
  if (!preset) throw new Error(`Preset TTS desconhecido: ${presetName}.`);
  const provider = String(options.provider ?? saved.provider ?? config.defaults.provider);
  if (!config.providers[provider]) throw new Error(`Provedor TTS desconhecido: ${provider}.`);
  const requestedSpeed = Number(options.speed ?? options.rate ?? saved.speed ?? preset.speed ?? 1);
  if (!Number.isFinite(requestedSpeed) || requestedSpeed < 0.7 || requestedSpeed > 1.2) {
    throw new Error('A velocidade TTS deve ficar entre 0.7 e 1.2; use 1.0 para ritmo natural.');
  }
  return {
    provider, preset: presetName,
    voice: String(options.voice ?? saved.voice ?? config.providers[provider].defaultVoice ?? ''),
    model: String(options.model ?? saved.model ?? config.providers[provider].defaultModel ?? ''),
    speed: requestedSpeed,
    style: Number(options.style ?? saved.style ?? preset.style ?? 0),
    stability: Number(options.stability ?? saved.stability ?? preset.stability ?? 0.65),
    similarityBoost: Number(options.similarity ?? saved.similarityBoost ?? preset.similarityBoost ?? 0.78),
  };
};

const roundToFrame = (seconds, fps) => Math.ceil(seconds * fps) / fps;

export const synchronizeProjectToNarration = (project, generated, options = {}) => {
  const updated = structuredClone(project);
  const padding = Math.max(0, Number(options.padding ?? 0.35));
  const fps = updated.video.fps;
  let cursor = 0;
  const timings = new Map();
  for (const scene of updated.scenes) {
    const audio = generated.get(scene.id);
    if (!audio) {
      timings.set(scene.id, {startSeconds: cursor, durationSeconds: scene.durationSeconds});
      cursor += scene.durationSeconds;
      continue;
    }
    const duration = roundToFrame(audio.durationSeconds + padding, fps);
    scene.durationSeconds = duration;
    scene.audio = {src: audio.src, volume: 1, playbackRate: 1};
    if (!scene.captions?.length && scene.narration?.trim()) {
      scene.captions = [{id: `${scene.id}-caption`, startSeconds: 0.1, endSeconds: Math.min(duration, audio.durationSeconds), text: scene.narration.trim()}];
    }
    if (scene.captions?.length === 1) {
      scene.captions[0].startSeconds = Math.min(scene.captions[0].startSeconds, 0.15);
      scene.captions[0].endSeconds = Math.min(duration, audio.durationSeconds);
    } else {
      for (const cue of scene.captions ?? []) cue.endSeconds = Math.min(cue.endSeconds, duration);
    }
    timings.set(scene.id, {startSeconds: cursor, durationSeconds: duration});
    cursor += duration;
  }
  if (options.targetDuration !== undefined && cursor > Number(options.targetDuration) + 1 / fps) {
    throw new Error(`A narração natural requer ${cursor.toFixed(2)} s, acima do limite de ${Number(options.targetDuration).toFixed(2)} s. Resuma ou reestruture o roteiro; a voz não será acelerada.`);
  }
  if (updated.version === '2.0' && updated.timeline) {
    updated.timeline.durationSeconds = cursor;
    for (const track of updated.timeline.tracks ?? []) {
      for (const clip of track.clips ?? []) {
        if (!clip.sceneId || !timings.has(clip.sceneId)) continue;
        const timing = timings.get(clip.sceneId);
        clip.startSeconds = timing.startSeconds;
        clip.durationSeconds = timing.durationSeconds;
        if (track.type === 'audio') clip.playbackRate = 1;
      }
    }
    let narrationTrack = updated.timeline.tracks.find((track) => track.id === 'narration');
    if (!narrationTrack) {
      narrationTrack = {id: 'narration', type: 'audio', clips: []};
      updated.timeline.tracks.push(narrationTrack);
    }
    narrationTrack.type = 'audio';
    narrationTrack.clips = updated.scenes.filter((scene) => scene.audio).map((scene, index) => {
      const timing = timings.get(scene.id);
      return {id: `narration-${String(index + 1).padStart(3, '0')}`, startSeconds: timing.startSeconds,
        durationSeconds: timing.durationSeconds, sceneId: scene.id, volume: 1, playbackRate: 1};
    });
  }
  updated.tts = {...(updated.tts ?? {}), ...options.settings, speed: options.settings?.speed ?? 1};
  return updated;
};
