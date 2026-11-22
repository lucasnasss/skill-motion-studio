#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const CLI = path.join(ROOT, 'scripts', 'motion-studio.mjs');

const parseArgs = (args) => {
  const positional = [];
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const [key, inline] = token.slice(2).split(/=(.*)/s, 2);
    if (inline !== undefined) options[key] = inline;
    else if (args[index + 1] && !args[index + 1].startsWith('--')) options[key] = args[++index];
    else options[key] = true;
  }
  return {positional, options};
};

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const resolveFrom = (base, value) => value ? path.resolve(base, value) : undefined;

const validateManifest = (manifest) => {
  if (!manifest || manifest.version !== '1.0' || !Array.isArray(manifest.jobs) || !manifest.jobs.length) {
    throw new Error('Manifesto batch inválido: use version 1.0 e uma lista jobs não vazia.');
  }
  const ids = new Set();
  for (const job of manifest.jobs) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(job.id ?? '')) throw new Error(`Job com id inválido: ${job.id}`);
    if (ids.has(job.id)) throw new Error(`Job duplicado: ${job.id}`);
    ids.add(job.id);
    if (!['validate', 'verify', 'quality', 'pipeline', 'analyze', 'edit-plan', 'edit'].includes(job.action)) {
      throw new Error(`Ação inválida em ${job.id}: ${job.action}`);
    }
  }
};

const writeState = (file, state) => {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  fs.copyFileSync(temporary, file);
  fs.rmSync(temporary, {force: true});
};

const jobArgs = (job, base) => {
  const args = [job.action];
  if (job.action === 'validate') args.push(resolveFrom(base, job.project));
  if (job.action === 'verify' || job.action === 'quality') args.push(resolveFrom(base, job.project), resolveFrom(base, job.video));
  if (job.action === 'pipeline') args.push(resolveFrom(base, job.project), '--out', resolveFrom(base, job.out));
  if (job.action === 'analyze' || job.action === 'edit-plan' || job.action === 'edit') {
    args.push(resolveFrom(base, job.input));
    if (job.out) args.push('--out', resolveFrom(base, job.out));
  }
  for (const [key, value] of Object.entries(job.options ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    args.push(value === true ? `--${key}` : `--${key}=${value}`);
  }
  return args;
};

const execute = (args, logFile) => new Promise((resolve) => {
  fs.mkdirSync(path.dirname(logFile), {recursive: true});
  const log = fs.createWriteStream(logFile, {flags: 'a'});
  log.write(`\n=== ${new Date().toISOString()} node ${CLI} ${args.join(' ')} ===\n`);
  const child = spawn(process.execPath, [CLI, ...args], {cwd: ROOT, windowsHide: true, env: process.env});
  child.stdout.on('data', (chunk) => log.write(chunk));
  child.stderr.on('data', (chunk) => log.write(chunk));
  child.on('error', (error) => {
    log.write(`\nERRO DE PROCESSO: ${error.message}\n`);
    log.end(() => resolve({code: -1, error: error.message}));
  });
  child.on('exit', (code) => log.end(() => resolve({code: code ?? -1})));
});

const statePaths = (manifestFile, options) => {
  const manifestDir = path.dirname(manifestFile);
  const outputDir = path.resolve(String(options['out-dir'] ?? path.join(manifestDir, 'batch-output')));
  return {outputDir, stateFile: path.join(outputDir, 'batch-state.json'), logsDir: path.join(outputDir, 'logs')};
};

const runBatch = async (manifestFile, options) => {
  const absoluteManifest = path.resolve(manifestFile);
  const manifest = readJson(absoluteManifest);
  validateManifest(manifest);
  const paths = statePaths(absoluteManifest, options);
  const previous = fs.existsSync(paths.stateFile) ? readJson(paths.stateFile) : null;
  const resume = Boolean(options.resume);
  const retries = Math.max(0, Math.min(5, Number(options.retries ?? manifest.retries ?? 1)));
  const concurrency = Math.max(1, Math.min(4, Number(options.concurrency ?? manifest.concurrency ?? 1)));
  const state = {
    version: '1.0',
    manifest: absoluteManifest,
    startedAt: previous?.startedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'running',
    cancelRequested: false,
    jobs: Object.fromEntries(manifest.jobs.map((job) => {
      const old = previous?.jobs?.[job.id];
      return [job.id, resume && old?.status === 'succeeded' ? old : {status: 'pending', attempts: 0}];
    })),
  };
  writeState(paths.stateFile, state);
  const queue = manifest.jobs.filter((job) => state.jobs[job.id].status !== 'succeeded');
  const base = path.dirname(absoluteManifest);

  const worker = async () => {
    while (queue.length) {
      const diskState = readJson(paths.stateFile);
      if (diskState.cancelRequested) {
        state.cancelRequested = true;
        return;
      }
      const job = queue.shift();
      const record = state.jobs[job.id];
      record.status = 'running';
      record.startedAt = new Date().toISOString();
      state.updatedAt = new Date().toISOString();
      writeState(paths.stateFile, state);
      let result;
      for (let attempt = record.attempts + 1; attempt <= retries + 1; attempt += 1) {
        record.attempts = attempt;
        result = await execute(jobArgs(job, base), path.join(paths.logsDir, `${job.id}.log`));
        if (result.code === 0) break;
      }
      record.finishedAt = new Date().toISOString();
      record.exitCode = result.code;
      record.status = result.code === 0 ? 'succeeded' : 'failed';
      state.updatedAt = new Date().toISOString();
      writeState(paths.stateFile, state);
    }
  };
  await Promise.all(Array.from({length: Math.min(concurrency, queue.length || 1)}, () => worker()));
  const records = Object.values(state.jobs);
  state.status = state.cancelRequested ? 'cancelled' : records.some((job) => job.status === 'failed') ? 'failed' : 'completed';
  state.finishedAt = new Date().toISOString();
  state.updatedAt = state.finishedAt;
  writeState(paths.stateFile, state);
  console.log(`Batch ${state.status}: ${paths.stateFile}`);
  if (state.status === 'failed') process.exitCode = 1;
};

const setCancellation = (manifestFile, options) => {
  const absoluteManifest = path.resolve(manifestFile);
  const {stateFile} = statePaths(absoluteManifest, options);
  if (!fs.existsSync(stateFile)) throw new Error(`Estado não encontrado: ${stateFile}`);
  const state = readJson(stateFile);
  state.cancelRequested = true;
  state.updatedAt = new Date().toISOString();
  writeState(stateFile, state);
  console.log(`Cancelamento solicitado: ${stateFile}`);
};

const showStatus = (manifestFile, options) => {
  const absoluteManifest = path.resolve(manifestFile);
  const {stateFile} = statePaths(absoluteManifest, options);
  if (!fs.existsSync(stateFile)) throw new Error(`Estado não encontrado: ${stateFile}`);
  console.log(fs.readFileSync(stateFile, 'utf8'));
};

const main = async () => {
  const [command = 'run', ...rest] = process.argv.slice(2);
  const {positional, options} = parseArgs(rest);
  const manifest = positional[0];
  if (!manifest) throw new Error('Uso: batch-manager.mjs run|status|cancel <manifest.json> [--out-dir pasta]');
  if (command === 'run') await runBatch(manifest, options);
  else if (command === 'status') showStatus(manifest, options);
  else if (command === 'cancel') setCancellation(manifest, options);
  else throw new Error(`Comando batch desconhecido: ${command}`);
};

main().catch((error) => {
  console.error(`ERRO: ${error.message}`);
  process.exitCode = 1;
});

