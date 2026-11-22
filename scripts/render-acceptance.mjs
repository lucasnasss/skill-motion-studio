#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'scripts', 'motion-studio.mjs');
const outputDir = path.join(root, 'output');
fs.mkdirSync(outputDir, {recursive: true});

const cases = [
  {id: 'A', slug: 'acceptance-a-vertical', project: 'acceptance-a-vertical.json'},
  {id: 'B', slug: 'acceptance-b-membrane', project: 'acceptance-b-membrane.json'},
  {id: 'C', slug: 'acceptance-c-chart', project: 'acceptance-c-chart.json'},
];

const startedAt = new Date().toISOString();
const results = [];

for (const testCase of cases) {
  const project = path.join(root, 'examples', testCase.project);
  const video = path.join(outputDir, `${testCase.slug}.mp4`);
  const parsed = path.parse(video);
  const base = path.join(parsed.dir, parsed.name);
  const preview = `${base}.preview.mp4`;
  const frames = `${base}-frames`;
  const args = [cli, 'pipeline', project, '--out', video];
  if (process.env.MOTION_STUDIO_SKIP_PREVIEW === '1' || fs.existsSync(preview)) args.push('--skip-preview');
  if (process.env.MOTION_STUDIO_CONCURRENCY) args.push('--concurrency', process.env.MOTION_STUDIO_CONCURRENCY);
  console.log(`\n=== Teste ${testCase.id}: ${testCase.project} ===`);
  const run = spawnSync(process.execPath, args, {cwd: root, stdio: 'inherit', env: process.env, windowsHide: true});
  const reportPath = `${video}.report.json`;
  const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : null;
  const frameManifest = fs.existsSync(path.join(frames, 'manifest.json'))
    ? JSON.parse(fs.readFileSync(path.join(frames, 'manifest.json'), 'utf8'))
    : null;
  results.push({
    id: testCase.id,
    project,
    video,
    preview,
    frames,
    exitCode: run.status,
    sourceEditable: fs.existsSync(project),
    previewGenerated: fs.existsSync(preview),
    representativeFramesGenerated: Boolean(frameManifest?.files?.length),
    mediaVerificationPassed: report?.pass === true,
    media: report?.actual ?? null,
    pass:
      run.status === 0 &&
      fs.existsSync(video) &&
      fs.existsSync(project) &&
      Boolean(frameManifest?.files?.length) &&
      report?.pass === true &&
      fs.existsSync(preview),
  });
  if (run.status !== 0) break;
}

const summary = {
  generatedAt: new Date().toISOString(),
  startedAt,
  environment: {node: process.version, platform: process.platform, arch: process.arch},
  pass: results.length === cases.length && results.every((result) => result.pass),
  note: 'A aprovação automatizada verifica execução, artefatos e metadados. A inspeção visual humana/assistida dos PNGs deve ser registrada separadamente.',
  results,
};
const summaryPath = path.join(outputDir, 'acceptance-report.json');
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(`\nRelatório consolidado: ${summaryPath}`);
if (!summary.pass) process.exitCode = 1;

