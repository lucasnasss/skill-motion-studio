import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');
export const SCHEMA_PATH = path.join(ROOT, 'references', 'project.schema.json');
const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
const ajv = new Ajv2020({allErrors: true, strict: false});
const validateSchema = ajv.compile(schema);

export const readProject = (file) => {
  const absolute = path.resolve(file);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  } catch (error) {
    throw new Error(`Não foi possível ler o JSON ${absolute}: ${error.message}`);
  }
  return {project: parsed, path: absolute};
};

const localAssetExists = (src) => {
  if (/^(https?:|data:)/i.test(src)) return true;
  const normalized = src.replaceAll('\\', '/').replace(/^\//, '');
  const publicRoot = path.resolve(ROOT, 'public');
  const candidate = path.resolve(publicRoot, normalized);
  if (candidate !== publicRoot && !candidate.startsWith(`${publicRoot}${path.sep}`)) return false;
  return fs.existsSync(candidate);
};

const formatSchemaError = (error) => {
  const where = error.instancePath || '/';
  if (error.keyword === 'oneOf') return null;
  return `${where}: ${error.message ?? 'valor inválido'}`;
};

export const validateProject = (project) => {
  const errors = [];
  const warnings = [];
  if (!validateSchema(project)) {
    const unique = new Set((validateSchema.errors ?? []).map(formatSchemaError).filter(Boolean));
    errors.push(...unique);
  }
  if (!project || typeof project !== 'object' || !Array.isArray(project.scenes)) {
    return {valid: false, errors, warnings};
  }
  if (project.version === '2.0') {
    if (!project.mode) errors.push('/mode: projetos 2.0 devem declarar create, edit ou hybrid.');
    if (!project.timeline) errors.push('/timeline: projetos 2.0 devem possuir uma timeline editável.');
  }
  const mediaIds = new Set();
  for (const asset of project.media ?? []) {
    if (mediaIds.has(asset.id)) errors.push(`/media: id duplicado: ${asset.id}`);
    mediaIds.add(asset.id);
    if (/^https?:/i.test(asset.src)) warnings.push(`Mídia remota ${asset.id}; registre licença e preserve uma cópia autorizada antes do render final.`);
    else if (!localAssetExists(asset.src)) errors.push(`Mídia ausente em public/: ${asset.src}`);
  }
  const trackIds = new Set();
  const clipIds = new Set();
  for (const track of project.timeline?.tracks ?? []) {
    if (trackIds.has(track.id)) errors.push(`/timeline/tracks: id duplicado: ${track.id}`);
    trackIds.add(track.id);
    for (const clip of track.clips ?? []) {
      if (clipIds.has(clip.id)) errors.push(`/timeline: id de clip duplicado: ${clip.id}`);
      clipIds.add(clip.id);
      if (clip.assetId && !mediaIds.has(clip.assetId)) errors.push(`/timeline/${clip.id}: asset inexistente: ${clip.assetId}`);
      if (clip.outPointSeconds !== undefined && clip.inPointSeconds !== undefined && clip.outPointSeconds <= clip.inPointSeconds) {
        errors.push(`/timeline/${clip.id}: outPointSeconds deve ser maior que inPointSeconds.`);
      }
      if (track.type === 'audio' && clip.playbackRate !== undefined && clip.playbackRate !== 1) {
        errors.push(`/timeline/${clip.id}: narração deve usar playbackRate 1.0; ajuste a duração da cena ao áudio.`);
      }
    }
  }
  const editRanges = project.edit?.keepRanges ?? [];
  for (let index = 0; index < editRanges.length; index += 1) {
    const range = editRanges[index];
    if (range.endSeconds <= range.startSeconds) errors.push(`/edit/keepRanges/${index}: intervalo inválido.`);
    if (index > 0 && range.startSeconds < editRanges[index - 1].endSeconds) errors.push(`/edit/keepRanges/${index}: intervalos devem estar ordenados e não podem se sobrepor.`);
  }
  if (project.edit?.sourceAssetId && !mediaIds.has(project.edit.sourceAssetId)) {
    errors.push(`/edit/sourceAssetId: asset inexistente: ${project.edit.sourceAssetId}`);
  }
  const sceneIds = new Set();
  const safe = project.video?.safeMarginPct ?? 0.07;
  for (const scene of project.scenes) {
    if (sceneIds.has(scene.id)) errors.push(`/scenes: id de cena duplicado: ${scene.id}`);
    sceneIds.add(scene.id);
    const elementIds = new Set();
    for (const element of scene.elements ?? []) {
      if (elementIds.has(element.id)) errors.push(`/scenes/${scene.id}: id de elemento duplicado: ${element.id}`);
      elementIds.add(element.id);
      if (
        element.type === 'text' &&
        (element.x < safe || element.y < safe || element.x + element.width > 1 - safe || element.y + element.height > 1 - safe)
      ) {
        warnings.push(`Texto ${scene.id}/${element.id} cruza a margem segura de ${(safe * 100).toFixed(0)}%.`);
      }
      if (element.type === 'image') {
        if (/^https?:/i.test(element.src)) warnings.push(`Imagem remota em ${scene.id}/${element.id}; prefira cópia local licenciada.`);
        else if (!localAssetExists(element.src)) errors.push(`Asset de imagem ausente em public/: ${element.src}`);
      }
      if (element.type === 'video') {
        if (/^https?:/i.test(element.src)) warnings.push(`Vídeo remoto em ${scene.id}/${element.id}; use uma cópia local autorizada no render final.`);
        else if (!localAssetExists(element.src)) errors.push(`Asset de vídeo ausente em public/: ${element.src}`);
        if (element.endAtSeconds !== undefined && element.startFromSeconds !== undefined && element.endAtSeconds <= element.startFromSeconds) {
          errors.push(`Vídeo ${scene.id}/${element.id}: endAtSeconds deve ser maior que startFromSeconds.`);
        }
      }
      if (element.type === 'three' && element.modelSrc) {
        if (/^https?:/i.test(element.modelSrc)) warnings.push(`Modelo 3D remoto em ${scene.id}/${element.id}; prefira GLB/GLTF local licenciado.`);
        else if (!localAssetExists(element.modelSrc)) errors.push(`Modelo 3D ausente em public/: ${element.modelSrc}`);
      }
      if (element.type === 'diagram') {
        const nodes = new Set(element.nodes.map((node) => node.id));
        for (const edge of element.edges) {
          if (!nodes.has(edge.from) || !nodes.has(edge.to)) {
            errors.push(`Diagrama ${scene.id}/${element.id}: aresta ${edge.from} → ${edge.to} referencia nó inexistente.`);
          }
        }
      }
      if (element.type === 'chart' && element.min !== undefined && element.max !== undefined && element.min >= element.max) {
        errors.push(`Gráfico ${scene.id}/${element.id}: min deve ser menor que max.`);
      }
    }
    for (const cue of scene.captions ?? []) {
      if (cue.endSeconds <= cue.startSeconds) errors.push(`Legenda ${scene.id}/${cue.id}: intervalo inválido.`);
      if (cue.endSeconds > scene.durationSeconds + 1 / (project.video?.fps ?? 30)) errors.push(`Legenda ${scene.id}/${cue.id}: ultrapassa a duração da cena.`);
      for (const word of cue.words ?? []) {
        if (word.endSeconds <= word.startSeconds || word.startSeconds < cue.startSeconds || word.endSeconds > cue.endSeconds) {
          errors.push(`Legenda ${scene.id}/${cue.id}: timing inválido para a palavra "${word.text}".`);
        }
      }
    }
    if (scene.audio && !localAssetExists(scene.audio.src)) errors.push(`Áudio ausente em public/: ${scene.audio.src}`);
    if (!scene.elements?.length) errors.push(`Cena ${scene.id} não contém elementos.`);
  }
  return {valid: errors.length === 0, errors, warnings};
};

export const assertValidProject = (project) => {
  const result = validateProject(project);
  if (!result.valid) {
    throw new Error(`Projeto inválido:\n- ${result.errors.join('\n- ')}`);
  }
  return result;
};

export const sceneFrames = (project) =>
  project.scenes.map((scene) => Math.max(1, Math.round(scene.durationSeconds * project.video.fps)));

export const totalFrames = (project) => sceneFrames(project).reduce((sum, frames) => sum + frames, 0);

export const totalSeconds = (project) => totalFrames(project) / project.video.fps;

export const representativeFrames = (project) => {
  const result = [];
  let start = 0;
  for (const frames of sceneFrames(project)) {
    const offsets = [0.12, 0.5, 0.88].map((ratio) => Math.min(frames - 1, Math.max(0, Math.round((frames - 1) * ratio))));
    result.push(...offsets.map((offset) => start + offset));
    start += frames;
  }
  return [...new Set(result)].sort((a, b) => a - b);
};

const srtTime = (seconds) => {
  const millis = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(millis / 3600000);
  const minutes = Math.floor((millis % 3600000) / 60000);
  const secs = Math.floor((millis % 60000) / 1000);
  const ms = millis % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};

export const projectToSrt = (project) => {
  let cursor = 0;
  let index = 1;
  const blocks = [];
  for (const scene of project.scenes) {
    const duration = Math.round(scene.durationSeconds * project.video.fps) / project.video.fps;
    if (scene.captions?.length) {
      for (const cue of scene.captions) {
        blocks.push(`${index}\n${srtTime(cursor + cue.startSeconds)} --> ${srtTime(cursor + cue.endSeconds)}\n${cue.text.trim()}`);
        index += 1;
      }
    } else if (scene.narration?.trim()) {
      blocks.push(`${index}\n${srtTime(cursor)} --> ${srtTime(cursor + duration)}\n${scene.narration.trim()}`);
      index += 1;
    }
    cursor += duration;
  }
  return blocks.length ? `${blocks.join('\n\n')}\n` : '';
};

const cleanTitle = (prompt) => {
  const trimmed = prompt.replace(/\s+/g, ' ').trim();
  const withoutPrefix = trimmed.replace(/^(crie|faça|produza|gere)\s+(um|uma)?\s*/i, '');
  return (withoutPrefix || 'Novo vídeo').slice(0, 72).replace(/[.!?]+$/, '');
};

export const createStarter = (prompt) => {
  const text = prompt.trim() || 'Vídeo animado sobre uma ideia importante';
  const durationMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(minutos?|min|segundos?|s)\b/i);
  const numericDuration = durationMatch ? Number(durationMatch[1].replace(',', '.')) : 15;
  const duration = durationMatch && /^min/i.test(durationMatch[2]) ? numericDuration * 60 : numericDuration;
  const vertical = /\b(vertical|9\s*:\s*16|reel|shorts?|tiktok)\b/i.test(text);
  const square = /\b(quadrado|1\s*:\s*1)\b/i.test(text);
  const scientific = /\b(cient[ií]fic[oa]s?|biologi[caos]*|f[ií]sic[oa]s?|qu[ií]mic[oa]s?|c[eé]lulas?|membranas?|mol[eé]culas?)\b/i.test(text);
  const infographic = /\b(gr[aá]fic|dados?|estat[ií]stic|infogr[aá]fic)\b/i.test(text);
  const editorial = /\b(editorial|reportagem|revista)\b/i.test(text);
  const theme = scientific ? 'scientific' : infographic ? 'infographic' : editorial ? 'editorial' : 'minimal';
  const title = cleanTitle(text);
  const parts = text.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean);
  const sceneText = [
    title,
    parts[1] ?? 'Apresente a ideia central com uma sequência visual clara.',
    parts[2] ?? 'Conclua com a mensagem que o público deve lembrar.',
  ];
  const durations = [0.28, 0.44, 0.28].map((ratio) => Math.max(0.3, Number((duration * ratio).toFixed(3))));
  const difference = duration - durations.reduce((sum, value) => sum + value, 0);
  durations[1] = Number((durations[1] + difference).toFixed(3));
  const width = square ? 1080 : vertical ? 1080 : 1920;
  const height = square ? 1080 : vertical ? 1920 : 1080;
  return {
    version: '1.0',
    title,
    prompt: text,
    objective: 'Transformar o pedido em uma explicação visual curta e memorável.',
    audience: 'Público geral',
    language: 'pt-BR',
    theme,
    video: {width, height, fps: 30, safeMarginPct: 0.08},
    captions: {enabled: true, burnIn: false, position: 'bottom'},
    assets: {attributions: []},
    scenes: sceneText.map((content, index) => ({
      id: `scene-${index + 1}`,
      title: content,
      durationSeconds: durations[index],
      transition: {type: index === 1 ? 'slide-left' : 'fade', durationSeconds: 0.55},
      narration: content,
      elements: [
        {
          id: `accent-${index + 1}`,
          type: 'shape',
          kind: index === 1 ? 'rounded' : 'circle',
          x: index === 1 ? 0.1 : 0.66,
          y: index === 1 ? 0.24 : 0.12,
          width: index === 1 ? 0.8 : 0.22,
          height: index === 1 ? 0.46 : 0.22,
          fill: index === 1 ? '#6D5EF922' : '#6D5EF9',
          opacity: index === 1 ? 1 : 0.2,
          enter: {preset: 'zoom', durationSeconds: 0.7, easing: 'spring'},
        },
        {
          id: `text-${index + 1}`,
          type: 'text',
          x: 0.1,
          y: index === 0 ? 0.28 : 0.31,
          width: 0.8,
          height: 0.36,
          text: content,
          role: index === 1 ? 'subtitle' : 'title',
          align: 'center',
          verticalAlign: 'center',
          maxLines: 5,
          enter: {preset: 'slide-up', delaySeconds: 0.12, durationSeconds: 0.7, easing: 'ease-out'},
          exit: {preset: 'fade', durationSeconds: 0.35},
        },
      ],
    })),
  };
};

