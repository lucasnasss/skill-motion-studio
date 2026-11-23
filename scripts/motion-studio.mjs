#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {
  ROOT,
  assertValidProject,
  createStarter,
  projectToSrt,
  readProject,
  representativeFrames,
  totalFrames,
  totalSeconds,
  validateProject,
} from './lib/project.mjs';
import {
  buildKeepRanges,
  createEditProject,
  importMedia,
  parseProbe,
  parseSilenceDetect,
  parseVolumeDetect,
} from './lib/editor.mjs';
import {parseBlackDetect, projectQuality, unexpectedBlackSegments} from './lib/quality.mjs';
import {instantiateScene, readSceneLibrary} from './lib/scene-library.mjs';
import {analyzePcm16Wav} from './lib/audio-quality.mjs';
import {normalizeNarrationText, readTtsConfig, resolveTtsSettings, synchronizeProjectToNarration} from './lib/tts.mjs';

const ENTRY = path.join(ROOT, 'src', 'index.ts');
const COMPOSITION = 'MotionStudio';

const parseArgs = (args) => {
  const positional = [];
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const [rawKey, inline] = token.slice(2).split(/=(.*)/s, 2);
    if (inline !== undefined) {
      options[rawKey] = inline;
    } else if (args[index + 1] && !args[index + 1].startsWith('--')) {
      options[rawKey] = args[index + 1];
      index += 1;
    } else {
      options[rawKey] = true;
    }
  }
  return {positional, options};
};

const ensureParent = (file) => fs.mkdirSync(path.dirname(path.resolve(file)), {recursive: true});

const cliScript = () => {
  const packageDir = path.join(ROOT, 'node_modules', '@remotion', 'cli');
  const packageFile = path.join(packageDir, 'package.json');
  if (!fs.existsSync(packageFile)) {
    throw new Error('Dependências ausentes. Execute `npm ci` na pasta motion-studio.');
  }
  const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  const relative = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.remotion;
  if (!relative) throw new Error('O pacote @remotion/cli não expõe o binário esperado.');
  return path.resolve(packageDir, relative);
};

const run = (command, args, {capture = false, quiet = false} = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: {...process.env, FORCE_COLOR: capture ? '0' : process.env.FORCE_COLOR},
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    if (capture) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
        if (!quiet) process.stdout.write(chunk);
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
        if (!quiet) process.stderr.write(chunk);
      });
    }
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve({stdout, stderr});
      else {
        const detail = capture ? `\n${(stderr || stdout).trim().slice(-1200)}` : '';
        reject(new Error(`Comando terminou com código ${code}: ${command} ${args.join(' ')}${detail}`));
      }
    });
  });

const runRemotion = (args, options) => run(process.execPath, [cliScript(), ...args], options);

const executableAvailable = (name) => new Promise((resolve) => {
  const locator = process.platform === 'win32' ? 'where.exe' : 'which';
  const child = spawn(locator, [name], {windowsHide: true, stdio: 'ignore'});
  child.on('error', () => resolve(false));
  child.on('exit', (code) => resolve(code === 0));
});

const runFfprobe = async (args, options = {}) => {
  try {
    return await runRemotion(['ffprobe', ...args], options);
  } catch (remotionError) {
    if (!(await executableAvailable('ffprobe'))) throw remotionError;
    if (!options.quiet) console.warn('AVISO: FFprobe do Remotion indisponível; usando o FFprobe instalado no sistema.');
    return run('ffprobe', args, options);
  }
};

const concurrencyArgs = (options) => (options.concurrency ? [`--concurrency=${options.concurrency}`] : []);

const commonRenderArgs = (projectFile, output, options) => [
  'render',
  ENTRY,
  COMPOSITION,
  path.resolve(output),
  `--props=${path.resolve(projectFile)}`,
  '--codec=h264',
  '--pixel-format=yuv420p',
  '--image-format=png',
  `--crf=${options.crf ?? 18}`,
  '--overwrite',
  ...concurrencyArgs(options),
];

const printValidation = (file, result) => {
  for (const warning of result.warnings) console.warn(`AVISO: ${warning}`);
  if (!result.valid) {
    console.error(`Projeto inválido: ${path.resolve(file)}`);
    for (const error of result.errors) console.error(`- ${error}`);
    return;
  }
  console.log(`Projeto válido: ${path.resolve(file)}`);
};

const validateCommand = (file) => {
  if (!file) throw new Error('Uso: validate <projeto.json>');
  const {project} = readProject(file);
  const result = validateProject(project);
  printValidation(file, result);
  if (!result.valid) throw new Error(`A validação encontrou ${result.errors.length} erro(s).`);
  console.log(`Cenas: ${project.scenes.length} | Frames: ${totalFrames(project)} | Duração: ${totalSeconds(project).toFixed(3)} s`);
  return {project, result};
};

const renderCommand = async (file, output, options, preview = false) => {
  const {project} = validateCommand(file);
  const target = output ?? path.join(ROOT, 'output', preview ? 'preview.mp4' : 'final.mp4');
  ensureParent(target);
  const args = commonRenderArgs(file, target, {...options, crf: options.crf ?? (preview ? 28 : 18)});
  if (preview) args.push('--scale=0.5');
  await runRemotion(args);
  if (!fs.existsSync(path.resolve(target)) || fs.statSync(path.resolve(target)).size < 1024) {
    throw new Error(`O render não produziu um arquivo MP4 válido em ${path.resolve(target)}.`);
  }
  console.log(`${preview ? 'Prévia' : 'Vídeo'} gerado: ${path.resolve(target)}`);
  return path.resolve(target);
};

const framesCommand = async (file, output, options) => {
  const {project} = validateCommand(file);
  const target = path.resolve(output ?? path.join(ROOT, 'output', 'frames'));
  fs.mkdirSync(target, {recursive: true});
  const frames = options.frames
    ? options.frames.split(',').map((value) => Number(value.trim())).filter(Number.isInteger)
    : representativeFrames(project);
  if (!frames.length) throw new Error('Nenhum quadro válido foi selecionado.');
  const maximum = totalFrames(project) - 1;
  if (frames.some((frame) => frame < 0 || frame > maximum)) throw new Error(`Quadros devem estar entre 0 e ${maximum}.`);
  await runRemotion([
    'render',
    ENTRY,
    COMPOSITION,
    target,
    `--props=${path.resolve(file)}`,
    '--sequence',
    '--image-format=png',
    '--image-sequence-pattern=frame-[frame].[ext]',
    `--frames=${[...new Set(frames)].sort((a, b) => a - b).join(',')}`,
    '--overwrite',
    ...concurrencyArgs(options),
  ]);
  const pngFiles = fs.readdirSync(target).filter((name) => name.toLowerCase().endsWith('.png')).sort();
  if (!pngFiles.length) throw new Error(`Nenhum PNG foi produzido em ${target}.`);
  const manifest = {
    generatedAt: new Date().toISOString(),
    project: path.resolve(file),
    requestedFrames: frames,
    files: pngFiles,
  };
  fs.writeFileSync(path.join(target, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Quadros de inspeção: ${target} (${pngFiles.length} arquivos)`);
  return target;
};

const parseRate = (rate) => {
  if (!rate) return NaN;
  const [numerator, denominator = '1'] = String(rate).split('/').map(Number);
  return denominator ? numerator / denominator : NaN;
};

const extractJson = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('FFprobe não retornou JSON reconhecível.');
  return JSON.parse(text.slice(start, end + 1));
};

const inspectMediaCommand = async (inputFile, options = {}) => {
  if (!inputFile) throw new Error('Uso: analyze <video> [--out relatorio.json]');
  const input = path.resolve(inputFile);
  if (!fs.existsSync(input)) throw new Error(`Vídeo não encontrado: ${input}`);
  const probeResult = await runFfprobe(
    ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', input],
    {capture: true, quiet: true},
  );
  const probe = extractJson(`${probeResult.stdout}\n${probeResult.stderr}`);
  const media = parseProbe(probe);
  const noiseDb = Number(options.noise ?? -35);
  const minimumSilence = Number(options.silence ?? 0.8);
  if (!Number.isFinite(noiseDb) || !Number.isFinite(minimumSilence) || minimumSilence <= 0) {
    throw new Error('--noise e --silence devem ser números válidos; silence deve ser maior que zero.');
  }
  let silences = [];
  let volume = {meanVolumeDb: null, peakVolumeDb: null};
  let volumeAnalysisAvailable = false;
  if (media.hasAudio) {
    const silenceFilter = `silencedetect=noise=${noiseDb}dB:d=${minimumSilence}`;
    const silenceResult = await runRemotion(
      ['ffmpeg', '-hide_banner', '-nostats', '-i', input, '-vn', '-af', silenceFilter, '-f', 'null', '-'],
      {capture: true, quiet: true},
    );
    const diagnostic = `${silenceResult.stdout}\n${silenceResult.stderr}`;
    silences = parseSilenceDetect(diagnostic, media.durationSeconds);
    try {
      const volumeResult = await runRemotion(
        ['ffmpeg', '-hide_banner', '-nostats', '-i', input, '-vn', '-af', 'volumedetect', '-f', 'null', '-'],
        {capture: true, quiet: true},
      );
      volume = parseVolumeDetect(`${volumeResult.stdout}\n${volumeResult.stderr}`);
      volumeAnalysisAvailable = true;
    } catch {
      console.warn('AVISO: este build do FFmpeg não inclui volumedetect; cortes por silêncio continuam disponíveis.');
    }
  }
  const report = {
    generatedAt: new Date().toISOString(),
    input,
    media,
    audioAnalysis: {
      available: media.hasAudio,
      volumeAnalysisAvailable,
      noiseThresholdDb: noiseDb,
      minimumSilenceSeconds: minimumSilence,
      ...volume,
      silences,
    },
    suggestedKeepRanges: {
      conservative: buildKeepRanges(media.durationSeconds, silences, 'conservative'),
      dynamic: buildKeepRanges(media.durationSeconds, silences, 'dynamic'),
      editorial: buildKeepRanges(media.durationSeconds, silences, 'editorial'),
    },
    limitations: [
      'Detecção de silêncio não identifica sozinha erros de fala, repetições ou intenção narrativa.',
      'Cortes devem ser revisados no projeto antes de publicação quando puderem alterar significado.',
    ],
  };
  if (options.out) {
    const target = path.resolve(String(options.out));
    ensureParent(target);
    fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Análise de mídia: ${target}`);
  } else if (!options.quiet) {
    console.log(JSON.stringify(report, null, 2));
  }
  return report;
};

const editPlanCommand = async (inputFile, output, options = {}) => {
  const report = await inspectMediaCommand(inputFile, {...options, out: undefined, quiet: true});
  const imported = importMedia(inputFile);
  const intensity = String(options.intensity ?? 'conservative');
  if (!['conservative', 'dynamic', 'editorial'].includes(intensity)) throw new Error('--intensity deve ser conservative, dynamic ou editorial.');
  const targetAspect = String(options.aspect ?? 'source');
  if (!['source', '16:9', '9:16', '1:1'].includes(targetAspect)) throw new Error('--aspect deve ser source, 16:9, 9:16 ou 1:1.');
  const project = createEditProject({
    inputFile,
    importedSrc: imported.relative,
    media: report.media,
    silences: report.audioAnalysis.silences,
    intensity,
    targetAspect,
    license: String(options.license ?? 'user-provided; authorization required'),
  });
  assertValidProject(project);
  const target = path.resolve(output ?? path.join(ROOT, 'projects', 'edit-project.json'));
  if (fs.existsSync(target) && !options.force) throw new Error(`O projeto já existe: ${target}. Use --force para substituí-lo.`);
  ensureParent(target);
  fs.writeFileSync(target, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
  console.log(`Projeto de edição criado: ${target}`);
  console.log(`Original preservado: ${path.resolve(inputFile)}`);
  console.log(`Trechos mantidos: ${project.edit.keepRanges.length} | Duração editada: ${totalSeconds(project).toFixed(3)} s`);
  return {project, projectFile: target, report};
};

const verifyCommand = async (projectFile, videoFile) => {
  if (!projectFile || !videoFile) throw new Error('Uso: verify <projeto.json> <video.mp4>');
  const {project} = validateCommand(projectFile);
  const video = path.resolve(videoFile);
  if (!fs.existsSync(video)) throw new Error(`Vídeo não encontrado: ${video}`);
  const probeResult = await runFfprobe(
    ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', video],
    {capture: true, quiet: true},
  );
  const probe = extractJson(`${probeResult.stdout}\n${probeResult.stderr}`);
  const stream = (probe.streams ?? []).find((candidate) => candidate.codec_type === 'video');
  if (!stream) throw new Error('FFprobe não encontrou stream de vídeo.');
  const expectedDuration = totalSeconds(project);
  const actualDuration = Number(stream.duration ?? probe.format?.duration);
  const actualFps = parseRate(stream.avg_frame_rate ?? stream.r_frame_rate);
  const size = fs.statSync(video).size;
  const tolerance = 1 / project.video.fps + 0.04;
  const checks = {
    nonEmptyFile: size > 1024,
    mp4Container: String(probe.format?.format_name ?? '').includes('mp4'),
    h264Codec: stream.codec_name === 'h264',
    yuv420pPixelFormat: stream.pix_fmt === 'yuv420p',
    width: Number(stream.width) === project.video.width,
    height: Number(stream.height) === project.video.height,
    fps: Number.isFinite(actualFps) && Math.abs(actualFps - project.video.fps) < 0.02,
    duration: Number.isFinite(actualDuration) && Math.abs(actualDuration - expectedDuration) <= tolerance,
  };
  const report = {
    generatedAt: new Date().toISOString(),
    pass: Object.values(checks).every(Boolean),
    project: path.resolve(projectFile),
    video,
    expected: {
      container: 'mp4',
      codec: 'h264',
      pixelFormat: 'yuv420p',
      width: project.video.width,
      height: project.video.height,
      fps: project.video.fps,
      frames: totalFrames(project),
      durationSeconds: expectedDuration,
    },
    actual: {
      format: probe.format?.format_name,
      codec: stream.codec_name,
      pixelFormat: stream.pix_fmt,
      width: stream.width,
      height: stream.height,
      fps: actualFps,
      durationSeconds: actualDuration,
      sizeBytes: size,
    },
    checks,
  };
  const reportFile = `${video}.report.json`;
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Relatório: ${reportFile}`);
  if (!report.pass) throw new Error(`O vídeo falhou na verificação: ${Object.entries(checks).filter(([, pass]) => !pass).map(([name]) => name).join(', ')}`);
  console.log('Verificação aprovada: MP4/H.264, resolução, FPS, duração e pixel format conferem.');
  return report;
};

const qualityCommand = async (projectFile, videoFile, options = {}) => {
  if (!projectFile || !videoFile) throw new Error('Uso: quality <projeto.json> <video.mp4> [--out relatorio.json]');
  const technical = await verifyCommand(projectFile, videoFile);
  const {project} = readProject(projectFile);
  const objective = projectQuality(project);
  let blackSegments = [];
  let blackDetectionAvailable = true;
  try {
    const blackResult = await runRemotion(
      ['ffmpeg', '-hide_banner', '-nostats', '-i', path.resolve(videoFile), '-vf', 'blackdetect=d=0.3:pix_th=0.10', '-an', '-f', 'null', '-'],
      {capture: true, quiet: true},
    );
    blackSegments = parseBlackDetect(`${blackResult.stdout}\n${blackResult.stderr}`);
  } catch {
    blackDetectionAvailable = false;
    console.warn('AVISO: este build do FFmpeg não inclui blackdetect; a inspeção por quadros continua obrigatória.');
  }
  const unexpected = unexpectedBlackSegments(blackSegments, technical.actual.durationSeconds);
  const report = {
    generatedAt: new Date().toISOString(),
    project: path.resolve(projectFile),
    video: path.resolve(videoFile),
    pass: technical.pass && objective.pass && unexpected.length === 0,
    technical: technical.checks,
    objectiveProjectChecks: objective,
    blackFrames: {available: blackDetectionAvailable, segments: blackSegments, unexpected},
    subjectiveReview: {
      performed: false,
      note: 'Coerência estética e narrativa exigem inspeção visual humana ou avaliação assistida explicitamente identificada como subjetiva.',
    },
  };
  const target = path.resolve(String(options.out ?? `${path.resolve(videoFile)}.quality.json`));
  ensureParent(target);
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Relatório de qualidade: ${target}`);
  if (!report.pass) throw new Error(`Qualidade objetiva reprovada: ${unexpected.length} trecho(s) preto(s) inesperado(s), ${objective.failures.length} falha(s) de projeto.`);
  console.log(`Qualidade objetiva aprovada com ${objective.warnings.length} aviso(s).`);
  return report;
};

const srtCommand = (file, output) => {
  const {project} = validateCommand(file);
  const content = projectToSrt(project);
  if (!content) {
    console.log('O projeto não contém narração; nenhum SRT foi gerado.');
    return null;
  }
  const target = path.resolve(output ?? path.join(ROOT, 'output', 'captions.srt'));
  ensureParent(target);
  fs.writeFileSync(target, content, 'utf8');
  console.log(`Legendas SRT: ${target}`);
  return target;
};

const ttsDefaultsFile = path.join(ROOT, '.motion-studio', 'tts.json');
const savedTtsDefaults = () => fs.existsSync(ttsDefaultsFile) ? JSON.parse(fs.readFileSync(ttsDefaultsFile, 'utf8')) : {};

const audioDuration = async (file) => {
  const result = await runFfprobe(['-v', 'error', '-show_format', '-of', 'json', file], {capture: true, quiet: true});
  const duration = Number(extractJson(`${result.stdout}\n${result.stderr}`).format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Duração de áudio inválida: ${file}`);
  return duration;
};

const normalizeAudioFile = async (source, target, {loudness = false} = {}) => {
  ensureParent(target);
  const args = ['ffmpeg', '-y', '-hide_banner', '-i', source, '-vn'];
  if (loudness) args.push('-af', 'loudnorm=I=-16:TP=-1.5:LRA=11');
  args.push('-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', target);
  await runRemotion(args, {capture: true, quiet: true});
  if (!fs.existsSync(target) || fs.statSync(target).size < 1024) throw new Error(`Conversão PCM não produziu arquivo válido: ${target}`);
};

const synthesizeText = async (text, target, settings, options = {}) => {
  const temporary = `${target}.${settings.provider}.source${settings.provider === 'elevenlabs' ? '.mp3' : '.wav'}`;
  ensureParent(temporary);
  try {
    if (settings.provider === 'onecore') {
      if (process.platform !== 'win32') throw new Error('OneCore só está disponível no Windows.');
      const script = path.join(ROOT, 'scripts', 'tts', 'onecore.ps1');
      await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Text', text, '-Output', temporary, '-VoiceName', settings.voice, '-Speed', String(settings.speed)], {capture: true, quiet: true});
    } else if (settings.provider === 'kokoro') {
      const python = String(options.python ?? process.env.KOKORO_PYTHON ?? 'python');
      await run(python, [path.join(ROOT, 'scripts', 'tts', 'kokoro.py'), '--text', text, '--out', temporary, '--voice', settings.voice || 'pf_dora', '--speed', String(settings.speed), '--language', 'p'], {capture: true, quiet: true});
    } else if (settings.provider === 'elevenlabs') {
      const key = process.env.ELEVENLABS_API_KEY;
      if (!key) throw new Error('Defina ELEVENLABS_API_KEY no ambiente. A chave nunca é gravada no projeto ou nos logs.');
      if (!settings.voice) throw new Error('ElevenLabs requer --voice com o voice ID da sua biblioteca.');
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(settings.voice)}?output_format=mp3_44100_128`, {
        method: 'POST', headers: {'xi-api-key': key, 'content-type': 'application/json'},
        body: JSON.stringify({text, model_id: settings.model || 'eleven_multilingual_v2', apply_text_normalization: 'on', voice_settings: {
          stability: settings.stability, similarity_boost: settings.similarityBoost, style: settings.style,
          use_speaker_boost: true, speed: settings.speed,
        }}),
      });
      if (!response.ok) throw new Error(`ElevenLabs respondeu HTTP ${response.status}: ${(await response.text()).slice(0, 400)}`);
      fs.writeFileSync(temporary, Buffer.from(await response.arrayBuffer()));
    }
    if (options['preserve-source']) {
      const rawTarget = target.replace(/\.wav$/i, `.source${path.extname(temporary) || '.bin'}`);
      fs.copyFileSync(temporary, rawTarget);
    }
    await normalizeAudioFile(temporary, target, {loudness: options.normalize !== 'false'});
  } finally {
    fs.rmSync(temporary, {force: true});
  }
  const quality = analyzePcm16Wav(target);
  if (!quality.pass) throw new Error(`Áudio reprovado: clipping=${quality.clippingSamples}, salto máximo=${quality.maxAdjacentJump.toFixed(3)}.`);
  return quality;
};

const ttsPreviewCommand = async (options = {}) => {
  const text = String(options.text ?? '').trim();
  if (!text) throw new Error('Use tts-preview --text "frase para comparar" --provider onecore|kokoro|elevenlabs.');
  const settings = resolveTtsSettings(options, savedTtsDefaults());
  const normalized = normalizeNarrationText(text, options.pronunciation ? JSON.parse(fs.readFileSync(path.resolve(String(options.pronunciation)), 'utf8')) : {});
  const target = path.resolve(String(options.out ?? path.join(ROOT, 'output', 'voice-previews', `${settings.provider}-${settings.voice || 'voice'}-${settings.preset}.wav`.replace(/[^a-z0-9._-]+/gi, '-'))));
  const quality = await synthesizeText(normalized, target, settings, options);
  fs.writeFileSync(`${target}.quality.json`, `${JSON.stringify({settings: {...settings, apiKey: undefined}, normalizedText: normalized, quality}, null, 2)}\n`, 'utf8');
  console.log(`Amostra de voz: ${target}`);
  console.log(`Duração ${quality.durationSeconds.toFixed(2)} s | pico ${quality.peakDbfs.toFixed(1)} dBFS | RMS ${quality.rmsDbfs.toFixed(1)} dBFS`);
  return target;
};

const ttsCompareCommand = async (options = {}) => {
  const text = String(options.text ?? '').trim();
  const candidates = String(options.candidates ?? 'onecore:Microsoft Maria,kokoro:pf_dora').split(',').map((value) => value.trim()).filter(Boolean);
  if (!text || !candidates.length) throw new Error('Use tts-compare --text "..." --candidates "onecore:Microsoft Maria,kokoro:pf_dora,elevenlabs:VOICE_ID".');
  const directory = path.resolve(String(options.out ?? path.join(ROOT, 'output', 'voice-comparison')));
  fs.mkdirSync(directory, {recursive: true});
  const results = [];
  for (const candidate of candidates) {
    const separator = candidate.indexOf(':');
    const provider = separator < 0 ? candidate : candidate.slice(0, separator);
    const voice = separator < 0 ? '' : candidate.slice(separator + 1);
    const out = path.join(directory, `${provider}-${voice || 'default'}-${options.preset ?? 'educational'}.wav`.replace(/[^a-z0-9._-]+/gi, '-'));
    try {
      await ttsPreviewCommand({...options, provider, voice, out});
      results.push({provider, voice, status: 'generated', file: out});
    } catch (error) {
      results.push({provider, voice, status: 'unavailable', error: error.message});
      console.warn(`AVISO: ${provider}/${voice || 'default'} indisponível: ${error.message}`);
    }
  }
  const manifest = {generatedAt: new Date().toISOString(), text, preset: options.preset ?? 'educational', results,
    note: 'A escolha de naturalidade exige comparação auditiva humana.'};
  fs.writeFileSync(path.join(directory, 'comparison.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  if (!results.some((result) => result.status === 'generated')) throw new Error('Nenhuma amostra pôde ser gerada.');
  console.log(`Comparação de vozes: ${directory}`);
  return manifest;
};

const ttsCommand = async (file, output, options = {}) => {
  const {project} = validateCommand(file);
  const settings = resolveTtsSettings(options, savedTtsDefaults());
  const prefix = String(options.prefix ?? `tts-${path.basename(file, path.extname(file)).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
  const pronunciation = options.pronunciation ? JSON.parse(fs.readFileSync(path.resolve(String(options.pronunciation)), 'utf8')) : {};
  const generated = new Map();
  for (const scene of project.scenes) {
    if (!scene.narration?.trim()) continue;
    const normalizedText = normalizeNarrationText(scene.narration, pronunciation);
    const absoluteAudio = path.join(ROOT, 'public', 'audio', `${prefix}-${scene.id}.wav`);
    const quality = await synthesizeText(normalizedText, absoluteAudio, settings, options);
    generated.set(scene.id, {file: absoluteAudio, src: path.relative(path.join(ROOT, 'public'), absoluteAudio).replaceAll('\\', '/'), durationSeconds: quality.durationSeconds, quality, normalizedText});
    console.log(`${scene.id}: ${quality.durationSeconds.toFixed(2)} s | ${quality.peakDbfs.toFixed(1)} dBFS peak`);
  }
  if (!generated.size) throw new Error('Nenhuma cena com narração foi encontrada.');
  const updated = synchronizeProjectToNarration(project, generated, {
    padding: options.padding ?? 0.35,
    targetDuration: options['target-duration'], settings,
  });
  assertValidProject(updated);
  const target = path.resolve(output ?? `${path.resolve(file)}.tts.json`);
  if (fs.existsSync(target) && !options.force) throw new Error(`O arquivo já existe: ${target}. Use --force para substituí-lo.`);
  ensureParent(target);
  fs.writeFileSync(target, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
  const report = {generatedAt: new Date().toISOString(), provider: settings.provider, settings, sourceProject: path.resolve(file), outputProject: target,
    rule: 'As cenas seguem a duração real da narração; playbackRate permanece 1.0.', scenes: Object.fromEntries([...generated].map(([id, value]) => [id, {src: value.src, normalizedText: value.normalizedText, quality: value.quality}]))};
  fs.writeFileSync(`${target}.audio-report.json`, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (options['save-default']) {
    ensureParent(ttsDefaultsFile); fs.writeFileSync(ttsDefaultsFile, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
    console.log(`Preferência salva sem chave de API: ${ttsDefaultsFile}`);
  }
  console.log(`Projeto sincronizado à narração: ${target} (${totalSeconds(updated).toFixed(2)} s)`);
  console.log('Faça avaliação auditiva da naturalidade antes de publicar.');
  return target;
};

const ttsVoicesCommand = async (options = {}) => {
  const provider = String(options.provider ?? 'onecore');
  if (provider === 'onecore') {
    const result = await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'scripts', 'tts', 'onecore.ps1'), '-Text', 'x', '-Output', path.join(ROOT, '.render-temp', 'unused.wav'), '-ListVoices'], {capture: true, quiet: true});
    console.log(result.stdout.trim()); return;
  }
  if (provider === 'kokoro') { console.log('pf_dora\tpt-BR\tfemale\npm_alex\tpt-BR\tmale\npm_santa\tpt-BR\tmale'); return; }
  if (provider === 'elevenlabs') {
    const key = process.env.ELEVENLABS_API_KEY; if (!key) throw new Error('Defina ELEVENLABS_API_KEY no ambiente.');
    const response = await fetch('https://api.elevenlabs.io/v2/voices?page_size=100', {headers: {'xi-api-key': key}});
    if (!response.ok) throw new Error(`ElevenLabs respondeu HTTP ${response.status}.`);
    const body = await response.json(); for (const voice of body.voices ?? []) console.log(`${voice.voice_id}\t${voice.name}`); return;
  }
  throw new Error(`Provedor desconhecido: ${provider}`);
};

const audioInspectCommand = async (inputFile, options = {}) => {
  if (!inputFile) throw new Error('Uso: audio-inspect <audio-ou-video> [--out relatorio.json --preserve-pcm]');
  const input = path.resolve(inputFile);
  if (!fs.existsSync(input)) throw new Error(`Arquivo não encontrado: ${input}`);
  const pcm = path.resolve(String(options.pcm ?? path.join(ROOT, '.render-temp', `audio-inspect-${Date.now()}.wav`)));
  await normalizeAudioFile(input, pcm, {loudness: false});
  const quality = analyzePcm16Wav(pcm);
  const report = {generatedAt: new Date().toISOString(), input, standardizedPcm: options['preserve-pcm'] ? pcm : null, quality};
  const target = path.resolve(String(options.out ?? `${input}.audio-quality.json`));
  ensureParent(target); fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (!options['preserve-pcm']) fs.rmSync(pcm, {force: true});
  console.log(`Relatório de áudio: ${target}`);
  console.log(`Duração ${quality.durationSeconds.toFixed(2)} s | pico ${quality.peakDbfs.toFixed(1)} dBFS | clipping ${quality.clippingSamples}`);
  return report;
};

const audioCompareCommand = async (projectFile, videoFile, options = {}) => {
  if (!projectFile || !videoFile) throw new Error('Uso: audio-compare <projeto.json> <video.mp4> [--out relatorio.json]');
  const {project} = validateCommand(projectFile);
  const videoReport = await audioInspectCommand(videoFile, {out: path.join(ROOT, '.render-temp', `embedded-${Date.now()}.json`)});
  const scenes = [];
  for (const scene of project.scenes) {
    if (!scene.audio) continue;
    const source = path.resolve(ROOT, 'public', scene.audio.src.replaceAll('/', path.sep));
    const duration = await audioDuration(source);
    let sourceQuality = null;
    try { sourceQuality = analyzePcm16Wav(source); } catch { /* formatos externos permanecem verificáveis por FFprobe */ }
    scenes.push({id: scene.id, source: scene.audio.src, sourceDurationSeconds: duration, sceneDurationSeconds: scene.durationSeconds,
      sourceQuality, truncationRisk: duration > scene.durationSeconds + 1 / project.video.fps});
  }
  const playbackRates = (project.timeline?.tracks ?? []).filter((track) => track.type === 'audio').flatMap((track) => track.clips.map((clip) => clip.playbackRate ?? 1));
  const report = {
    generatedAt: new Date().toISOString(), project: path.resolve(projectFile), video: path.resolve(videoFile),
    rule: 'A narração deve permanecer em playbackRate 1.0; cenas seguem a duração do WAV.', scenes,
    embedded: videoReport.quality, playbackRates,
    pass: scenes.every((scene) => !scene.truncationRisk && (scene.sourceQuality?.clippingSamples ?? 0) === 0)
      && playbackRates.every((rate) => rate === 1) && videoReport.quality.clippingSamples === 0,
  };
  const target = path.resolve(String(options.out ?? `${path.resolve(videoFile)}.audio-compare.json`));
  ensureParent(target); fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Comparação de áudio: ${target} | ${report.pass ? 'aprovada' : 'reprovada'}`);
  return report;
};

const pipelineCommand = async (file, output, options) => {
  const target = path.resolve(output ?? path.join(ROOT, 'output', 'final.mp4'));
  const parsed = path.parse(target);
  const base = path.join(parsed.dir, parsed.name);
  validateCommand(file);
  if (!options['skip-preview']) await renderCommand(file, `${base}.preview.mp4`, {...options, crf: options['preview-crf'] ?? 28}, true);
  await framesCommand(file, `${base}-frames`, options);
  await renderCommand(file, target, options, false);
  srtCommand(file, `${base}.srt`);
  return options['skip-quality'] ? verifyCommand(file, target) : qualityCommand(file, target, {out: `${base}.quality.json`});
};

const normalizeAudioCommand = async (projectFile, videoFile) => {
  const target = path.resolve(videoFile);
  const temporary = `${target}.normalized.tmp.mp4`;
  await runRemotion([
    'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', target,
    '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-af', 'loudnorm=I=-16:LRA=11:TP=-1.5', temporary,
  ]);
  await verifyCommand(projectFile, temporary);
  fs.rmSync(target, {force: true});
  fs.renameSync(temporary, target);
  fs.rmSync(`${temporary}.report.json`, {force: true});
  console.log(`Áudio normalizado: ${target}`);
  return verifyCommand(projectFile, target);
};

const editCommand = async (inputFile, output, options = {}) => {
  if (!output) throw new Error('Uso: edit <video> --out editado.mp4 [--project projeto.json]');
  const target = path.resolve(output);
  const projectFile = path.resolve(String(options.project ?? `${target}.project.json`));
  const planned = await editPlanCommand(inputFile, projectFile, {...options, force: options.force ?? true});
  await pipelineCommand(projectFile, target, options);
  if (planned.report.media.hasAudio && options.normalize !== 'false') {
    await normalizeAudioCommand(projectFile, target);
  }
  return {projectFile, video: target};
};

const doctorCommand = async () => {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 18) throw new Error(`Node ${process.versions.node} incompatível; use Node 18+.`);
  const packageFiles = ['remotion', '@remotion/cli', '@remotion/three', '@react-three/fiber', 'three'].map((name) => {
    const file = path.join(ROOT, 'node_modules', ...name.split('/'), 'package.json');
    if (!fs.existsSync(file)) throw new Error(`Dependência ausente: ${name}. Execute npm ci.`);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  });
  const template = readProject(path.join(ROOT, 'assets', 'project-template.json')).project;
  assertValidProject(template);
  const ffmpeg = await runRemotion(['ffmpeg', '-version'], {capture: true, quiet: true});
  const ffprobe = await runFfprobe(['-version'], {capture: true, quiet: true});
  console.log(`Node: ${process.versions.node}`);
  console.log(`Remotion: ${packageFiles[0].version} | CLI: ${packageFiles[1].version}`);
  console.log(`3D: @remotion/three ${packageFiles[2].version} | R3F ${packageFiles[3].version} | Three.js ${packageFiles[4].version}`);
  console.log((ffmpeg.stdout || ffmpeg.stderr).split(/\r?\n/)[0]);
  console.log((ffprobe.stdout || ffprobe.stderr).split(/\r?\n/)[0]);
  const optional = {
    python: await executableAvailable(process.platform === 'win32' ? 'python.exe' : 'python3'),
    blender: await executableAvailable(process.platform === 'win32' ? 'blender.exe' : 'blender'),
    autoEditor: await executableAvailable(process.platform === 'win32' ? 'auto-editor.exe' : 'auto-editor'),
    fasterWhisper: await executableAvailable(process.platform === 'win32' ? 'faster-whisper.exe' : 'faster-whisper'),
    espeakNg: await executableAvailable(process.platform === 'win32' ? 'espeak-ng.exe' : 'espeak-ng'),
  };
  console.log(`Opcionais: Python=${optional.python ? 'disponível' : 'ausente'} | Blender=${optional.blender ? 'disponível' : 'ausente'} | Auto-Editor=${optional.autoEditor ? 'disponível' : 'ausente'} | faster-whisper CLI=${optional.fasterWhisper ? 'disponível' : 'ausente'}`);
  console.log(`TTS: OneCore=${process.platform === 'win32' ? 'disponível' : 'ausente'} | Kokoro runtime=${optional.python && optional.espeakNg ? 'pré-requisitos encontrados' : 'incompleto (requer Python 3.10–3.13 + espeak-ng)'} | ElevenLabs=${process.env.ELEVENLABS_API_KEY ? 'chave configurada' : 'sem chave'}`);
  console.log('Ambiente básico aprovado. Ausências opcionais não bloqueiam CREATE/EDIT/3D integrado. O navegador será verificado no primeiro render.');
};

const sceneLibraryCommand = (templateId, options = {}) => {
  if (!templateId) {
    const library = readSceneLibrary();
    console.log(JSON.stringify(library, null, 2));
    return library;
  }
  const parameters = options.params
    ? JSON.parse(fs.readFileSync(path.resolve(String(options.params)), 'utf8'))
    : {
        title: options.title,
        subtitle: options.subtitle,
        items: options.items,
        value: options.value,
        color: options.color,
        accentColor: options.accent,
        durationSeconds: options.duration,
        animation: options.animation,
      };
  const scene = instantiateScene(templateId, parameters);
  if (options.out) {
    const target = path.resolve(String(options.out));
    ensureParent(target);
    fs.writeFileSync(target, `${JSON.stringify(scene, null, 2)}\n`, 'utf8');
    console.log(`Cena parametrizada: ${target}`);
  } else console.log(JSON.stringify(scene, null, 2));
  return scene;
};

const help = () => console.log(`Motion Studio Pro 2.1.0

Uso:
  motion-studio.mjs doctor
  motion-studio.mjs new --prompt "descrição" --out projeto.json
  motion-studio.mjs validate <projeto.json>
  motion-studio.mjs preview <projeto.json> --out preview.mp4
  motion-studio.mjs frames <projeto.json> --out frames/ [--frames 0,150,300]
  motion-studio.mjs render <projeto.json> --out final.mp4
  motion-studio.mjs verify <projeto.json> <final.mp4>
  motion-studio.mjs quality <projeto.json> <final.mp4> [--out qualidade.json]
  motion-studio.mjs srt <projeto.json> --out legendas.srt
  motion-studio.mjs tts <projeto.json> --out projeto-com-voz.json [--provider onecore|kokoro|elevenlabs --preset educational --voice ID]
  motion-studio.mjs tts-preview --text "..." [--provider onecore|kokoro|elevenlabs --voice ID --out amostra.wav]
  motion-studio.mjs tts-compare --text "..." --candidates "onecore:Microsoft Maria,kokoro:pf_dora,elevenlabs:VOICE_ID"
  motion-studio.mjs tts-voices [--provider onecore|kokoro|elevenlabs]
  motion-studio.mjs audio-inspect <audio-ou-video> [--out relatorio.json --preserve-pcm]
  motion-studio.mjs audio-compare <projeto.json> <video.mp4> [--out relatorio.json]
  motion-studio.mjs pipeline <projeto.json> --out final.mp4 [--skip-preview]
  motion-studio.mjs analyze <video> --out analise.json [--noise -35 --silence 0.8]
  motion-studio.mjs edit-plan <video> --out projeto.json [--intensity conservative|dynamic|editorial --aspect 9:16]
  motion-studio.mjs edit <video> --out editado.mp4 [--project projeto.json --intensity dynamic --aspect 9:16]
  motion-studio.mjs scene-library [template-id] [--title "..." --items "A|B|C" --out cena.json]
`);

const main = async () => {
  const [command = 'help', ...rest] = process.argv.slice(2);
  const {positional, options} = parseArgs(rest);
  switch (command) {
    case 'doctor':
      await doctorCommand();
      break;
    case 'new': {
      const prompt = String(options.prompt ?? positional.join(' ')).trim();
      if (!prompt) throw new Error('Informe --prompt "descrição do vídeo".');
      const output = path.resolve(String(options.out ?? 'motion-project.json'));
      if (fs.existsSync(output) && !options.force) throw new Error(`O arquivo já existe: ${output}. Use --force para substituí-lo.`);
      ensureParent(output);
      const project = createStarter(prompt);
      assertValidProject(project);
      fs.writeFileSync(output, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
      console.log(`Rascunho criado: ${output}`);
      break;
    }
    case 'validate':
      validateCommand(positional[0]);
      break;
    case 'preview':
      await renderCommand(positional[0], options.out, options, true);
      break;
    case 'frames':
      await framesCommand(positional[0], options.out, options);
      break;
    case 'render':
      await renderCommand(positional[0], options.out, options, false);
      break;
    case 'verify':
      await verifyCommand(positional[0], positional[1] ?? options.video);
      break;
    case 'quality':
      await qualityCommand(positional[0], positional[1] ?? options.video, options);
      break;
    case 'srt':
      srtCommand(positional[0], options.out);
      break;
    case 'tts':
      await ttsCommand(positional[0], options.out, options);
      break;
    case 'tts-preview':
      await ttsPreviewCommand(options);
      break;
    case 'tts-compare':
      await ttsCompareCommand(options);
      break;
    case 'tts-voices':
      await ttsVoicesCommand(options);
      break;
    case 'audio-inspect':
      await audioInspectCommand(positional[0], options);
      break;
    case 'audio-compare':
      await audioCompareCommand(positional[0], positional[1], options);
      break;
    case 'pipeline':
      await pipelineCommand(positional[0], options.out, options);
      break;
    case 'analyze':
      await inspectMediaCommand(positional[0], options);
      break;
    case 'edit-plan':
      await editPlanCommand(positional[0], options.out, options);
      break;
    case 'edit':
      await editCommand(positional[0], options.out, options);
      break;
    case 'scene-library':
      sceneLibraryCommand(positional[0], options);
      break;
    case 'help':
    case '--help':
    case '-h':
      help();
      break;
    default:
      help();
      throw new Error(`Comando desconhecido: ${command}`);
  }
};

main().catch((error) => {
  console.error(`ERRO: ${error.message}`);
  process.exitCode = 1;
});

