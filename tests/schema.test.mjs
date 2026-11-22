import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, readProject, totalSeconds, validateProject} from '../scripts/lib/project.mjs';

const cases = [
  ['acceptance-a-vertical.json', 15],
  ['acceptance-b-membrane.json', 45],
  ['acceptance-c-chart.json', 18],
];

for (const [file, duration] of cases) {
  test(`${file} segue o esquema e tem duração exata`, () => {
    const {project} = readProject(path.join(ROOT, 'examples', file));
    const result = validateProject(project);
    assert.deepEqual(result.errors, []);
    assert.equal(result.valid, true);
    assert.equal(totalSeconds(project), duration);
    assert.equal(result.warnings.length, 0);
  });
}

test('template distribuído segue o esquema', () => {
  const template = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'project-template.json'), 'utf8'));
  const result = validateProject(template);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('validação semântica rejeita ids duplicados', () => {
  const {project} = readProject(path.join(ROOT, 'examples', 'acceptance-a-vertical.json'));
  const broken = structuredClone(project);
  broken.scenes[0].elements[1].id = broken.scenes[0].elements[0].id;
  const result = validateProject(broken);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('duplicado')));
});

test('validação rejeita aresta para nó inexistente', () => {
  const {project} = readProject(path.join(ROOT, 'examples', 'acceptance-a-vertical.json'));
  const broken = structuredClone(project);
  broken.scenes[0].elements = [
    {
      id: 'bad-diagram',
      type: 'diagram',
      x: 0.1,
      y: 0.1,
      width: 0.8,
      height: 0.8,
      nodes: [{id: 'a', label: 'A', x: 0.1, y: 0.1}],
      edges: [{from: 'a', to: 'missing'}],
    },
  ];
  const result = validateProject(broken);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('nó inexistente')));
});

