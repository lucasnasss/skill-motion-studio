import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './project.mjs';

const libraryFile = path.join(ROOT, 'assets', 'scene-library.json');

export const readSceneLibrary = () => JSON.parse(fs.readFileSync(libraryFile, 'utf8'));

export const instantiateScene = (templateId, parameters = {}) => {
  const library = readSceneLibrary();
  const template = library.templates.find((candidate) => candidate.id === templateId);
  if (!template) throw new Error(`Template desconhecido: ${templateId}. Use \`scene-library\` para listar opções.`);
  const title = String(parameters.title ?? template.name);
  const subtitle = String(parameters.subtitle ?? 'Personalize este conteúdo no projeto.');
  const items = Array.isArray(parameters.items) ? parameters.items : String(parameters.items ?? 'Etapa 1|Etapa 2|Etapa 3').split('|');
  const color = String(parameters.color ?? '#6D5EF9');
  const accent = String(parameters.accentColor ?? '#54D6D0');
  const enter = {preset: String(parameters.animation ?? 'slide-up'), durationSeconds: 0.6};
  const elements = [
    {id: `${templateId}-accent`, type: 'shape', shape: 'rectangle', x: 0.07, y: 0.13, width: 0.08, height: 0.012, fill: accent, radius: 12},
    {id: `${templateId}-title`, type: 'text', x: 0.07, y: 0.18, width: 0.72, height: 0.2, text: title, role: 'title', color: '#FFFFFF', maxLines: 3, enter},
  ];
  if (['steps', 'split'].includes(template.layout)) {
    items.slice(0, 4).forEach((item, index) => elements.push({
      id: `${templateId}-item-${index + 1}`, type: 'text', x: 0.08 + (index % 2) * 0.45,
      y: 0.46 + Math.floor(index / 2) * 0.18, width: 0.38, height: 0.12,
      text: String(item), role: 'body', color: '#EAF0FF',
      enter: {preset: 'fade', delaySeconds: 0.18 * index, durationSeconds: 0.45},
    }));
  } else if (template.layout === 'product' || template.layout === 'science') {
    elements.push({id: `${templateId}-object`, type: 'three', x: 0.52, y: 0.16, width: 0.4, height: 0.62,
      primitive: template.layout === 'science' ? 'sphere' : 'box', style: template.layout === 'science' ? 'technical' : '3d-minimal',
      material: 'physical', color, accentColor: accent, rotationSpeed: [0.25, 0.6, 0.15], enter: {preset: 'zoom', durationSeconds: 0.7}});
    elements.push({id: `${templateId}-subtitle`, type: 'text', x: 0.07, y: 0.48, width: 0.38, height: 0.2, text: subtitle, role: 'body', color: '#C8D4EA', enter});
  } else {
    elements.push({id: `${templateId}-value`, type: 'text', x: 0.08, y: 0.47, width: 0.75, height: 0.2,
      text: String(parameters.value ?? subtitle), role: template.layout === 'number' ? 'number' : 'body', color: accent, enter: {preset: 'zoom', durationSeconds: 0.6}});
  }
  return {
    id: String(parameters.id ?? `${templateId}-scene`), title,
    durationSeconds: Number(parameters.durationSeconds ?? template.defaultDuration),
    transition: {type: 'fade', durationSeconds: 0.45},
    background: String(parameters.background ?? '#111936'), elements,
  };
};
