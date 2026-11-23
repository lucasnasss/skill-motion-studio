import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {buildKeepRanges, createEditProject, parseSilenceDetect, parseVolumeDetect} from '../scripts/lib/editor.mjs';
import {projectQuality} from '../scripts/lib/quality.mjs';
import {ROOT, projectToSrt, validateProject} from '../scripts/lib/project.mjs';
import {analyzeSamples} from '../scripts/lib/audio-quality.mjs';
import {normalizeNarrationText, resolveTtsSettings, synchronizeProjectToNarration} from '../scripts/lib/tts.mjs';

test('detecção de silêncio converte eventos do FFmpeg em intervalos', () => {
  const diagnostic = '[silencedetect] silence_start: 1.2\n[silencedetect] silence_end: 2.4 | silence_duration: 1.2\n[silencedetect] silence_start: 7.5';
  assert.deepEqual(parseSilenceDetect(diagnostic, 10), [
    {startSeconds: 1.2, endSeconds: 2.4},
    {startSeconds: 7.5, endSeconds: 10},
  ]);
});

test('intensidades de edição preservam conteúdo e alteram padding', () => {
  const silences = [{startSeconds: 2, endSeconds: 4}];
  const conservative = buildKeepRanges(8, silences, 'conservative');
  const dynamic = buildKeepRanges(8, silences, 'dynamic');
  assert.ok(conservative[0].endSeconds > dynamic[0].endSeconds);
  assert.ok(conservative[1].startSeconds < dynamic[1].startSeconds);
});

test('análise de volume reconhece média e pico', () => {
  assert.deepEqual(parseVolumeDetect('mean_volume: -21.4 dB\nmax_volume: -2.1 dB'), {
    meanVolumeDb: -21.4,
    peakVolumeDb: -2.1,
  });
});

test('projeto EDIT 2.0 gera timeline e preserva in/out points', () => {
  const fixture = path.join(ROOT, 'public', 'test-edit-fixture.mp4');
  fs.writeFileSync(fixture, 'fixture');
  try {
    const project = createEditProject({
      inputFile: fixture,
      importedSrc: 'test-edit-fixture.mp4',
      media: {durationSeconds: 8, width: 1920, height: 1080},
      silences: [{startSeconds: 2, endSeconds: 4}],
      intensity: 'dynamic',
      targetAspect: '9:16',
    });
    const result = validateProject(project);
    assert.equal(result.valid, true, result.errors.join('\n'));
    assert.equal(project.version, '2.0');
    assert.equal(project.mode, 'edit');
    assert.equal(project.video.width, 1080);
    assert.equal(project.video.height, 1920);
    assert.equal(project.timeline.tracks[0].clips.length, 2);
    assert.equal(project.scenes[0].elements[0].type, 'video');
  } finally {
    fs.rmSync(fixture, {force: true});
  }
});

test('schema 2.0 aceita cena 3D determinística e rejeita traversal de assets', () => {
  const project = {
    version: '2.0', mode: 'create', style: '3d-modern', title: '3D', objective: 'Teste', audience: 'Geral', language: 'pt-BR', theme: 'modern',
    video: {width: 1920, height: 1080, fps: 30}, timeline: {tracks: []},
    scenes: [{id: 'scene-3d', durationSeconds: 3, elements: [{id: 'cube', type: 'three', x: 0.1, y: 0.1, width: 0.8, height: 0.8, primitive: 'box'}]}],
  };
  assert.equal(validateProject(project).valid, true);
  const broken = structuredClone(project);
  broken.scenes[0].elements = [{id: 'escape', type: 'image', x: 0.1, y: 0.1, width: 0.8, height: 0.8, src: '../package.json'}];
  assert.equal(validateProject(broken).valid, false);
});

test('SRT usa cues temporizados e Quality Inspector detecta colisão de textos', () => {
  const project = {
    version: '2.0', mode: 'create', title: 'Legenda', objective: 'Teste', audience: 'Geral', language: 'pt-BR', theme: 'minimal',
    video: {width: 1080, height: 1920, fps: 30}, timeline: {tracks: []},
    scenes: [{
      id: 'scene', durationSeconds: 3,
      captions: [{id: 'cue', startSeconds: 0.5, endSeconds: 2, text: 'Olá mundo'}],
      elements: [
        {id: 'a', type: 'text', x: 0.1, y: 0.2, width: 0.8, height: 0.2, text: 'A'},
        {id: 'b', type: 'text', x: 0.15, y: 0.22, width: 0.7, height: 0.2, text: 'B'},
      ],
    }],
  };
  assert.match(projectToSrt(project), /00:00:00,500 --> 00:00:02,000/);
  assert.equal(projectQuality(project).textOverlaps.length, 1);
});

test('normalização TTS preserva pontuação e prepara termos pt-BR', () => {
  assert.equal(normalizeNarrationText('A IA mede 25% a 30 °C'), 'A I A mede 25 por cento a 30 graus Celsius.');
  assert.equal(normalizeNarrationText('DNA e pH', {DNA: 'dê ene á'}), 'dê ene á e pê agá.');
});

test('presets TTS mantêm velocidade moderada e intercambiam provedores', () => {
  const educational = resolveTtsSettings({provider: 'onecore', preset: 'educational'});
  const documentary = resolveTtsSettings({provider: 'kokoro', preset: 'documentary', voice: 'pf_dora'});
  assert.ok(educational.speed <= 1);
  assert.equal(documentary.provider, 'kokoro');
  assert.equal(documentary.voice, 'pf_dora');
  assert.throws(() => resolveTtsSettings({speed: 1.5}), /entre 0.7 e 1.2/);
});

test('sincronização faz cenas seguirem áudio sem acelerar narração', () => {
  const project = {
    version: '2.0', mode: 'create', title: 'Voz', objective: 'Teste', audience: 'Geral', language: 'pt-BR', theme: 'minimal',
    video: {width: 1920, height: 1080, fps: 30},
    timeline: {durationSeconds: 2, tracks: [{id: 'visual', type: 'overlay', clips: [{id: 'visual-1', startSeconds: 0, durationSeconds: 2, sceneId: 'scene'}]}]},
    scenes: [{id: 'scene', durationSeconds: 2, narration: 'Texto claro.', elements: [{id: 'text', type: 'text', x: 0.1, y: 0.1, width: 0.8, height: 0.2, text: 'Texto'}]}],
  };
  const generated = new Map([['scene', {src: 'audio/test.wav', durationSeconds: 3.21}]]);
  const result = synchronizeProjectToNarration(project, generated, {padding: 0.3, settings: {provider: 'onecore', preset: 'educational', speed: 1}});
  assert.equal(result.scenes[0].durationSeconds, 3.533333333333333);
  assert.equal(result.scenes[0].audio.playbackRate, 1);
  assert.equal(result.timeline.tracks[0].clips[0].durationSeconds, result.scenes[0].durationSeconds);
  assert.equal(result.timeline.tracks.find((track) => track.id === 'narration').clips[0].playbackRate, 1);
  assert.throws(() => synchronizeProjectToNarration(project, generated, {targetDuration: 2}), /não será acelerada/);
});

test('analisador PCM detecta clipping sem depender de filtros FFmpeg opcionais', () => {
  const clean = Float64Array.from({length: 4800}, (_, index) => Math.sin(index / 12) * 0.25);
  const clipped = clean.slice(); clipped[100] = 1;
  assert.equal(analyzeSamples(clean, 48000).pass, true);
  assert.equal(analyzeSamples(clipped, 48000).clippingSamples, 1);
});

