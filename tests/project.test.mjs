import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  ROOT,
  createStarter,
  projectToSrt,
  readProject,
  representativeFrames,
  totalFrames,
  totalSeconds,
  validateProject,
} from '../scripts/lib/project.mjs';

test('gerador de rascunho entende vertical, duração e tema científico', () => {
  const project = createStarter('Crie um vídeo vertical científico de 20 segundos sobre células.');
  assert.equal(project.video.width, 1080);
  assert.equal(project.video.height, 1920);
  assert.equal(project.theme, 'scientific');
  assert.equal(totalSeconds(project), 20);
  const result = validateProject(project);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('quadros representativos ficam dentro da composição', () => {
  const {project} = readProject(path.join(ROOT, 'examples', 'acceptance-b-membrane.json'));
  const frames = representativeFrames(project);
  assert.equal(frames.length, project.scenes.length * 3);
  assert.ok(frames.every((frame) => Number.isInteger(frame) && frame >= 0 && frame < totalFrames(project)));
  assert.deepEqual([...frames].sort((a, b) => a - b), frames);
});

test('SRT usa o tempo acumulado arredondado aos frames', () => {
  const {project} = readProject(path.join(ROOT, 'examples', 'acceptance-a-vertical.json'));
  const srt = projectToSrt(project);
  assert.match(srt, /00:00:00,000 --> 00:00:03,500/);
  assert.match(srt, /00:00:11,500 --> 00:00:15,000/);
  assert.equal((srt.match(/-->/g) ?? []).length, project.scenes.length);
});

