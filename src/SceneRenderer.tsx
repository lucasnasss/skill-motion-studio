import React from 'react';
import {AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ElementRenderer} from './components/ElementRenderer';
import {DynamicCaptions} from './components/DynamicCaptions';
import type {MotionProject, Scene, ThemeTokens} from './types';

type Props = {
  scene: Scene;
  project: MotionProject;
  tokens: ThemeTokens;
  durationInFrames: number;
};

const resolveMedia = (src: string) =>
  /^https?:\/\//i.test(src) || /^data:/i.test(src)
    ? src
    : staticFile(src.replaceAll('\\', '/').replace(/^\//, ''));

const Backdrop: React.FC<{tokens: ThemeTokens; theme: MotionProject['theme']}> = ({tokens, theme}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const drift = Math.sin((frame / fps) * 0.45) * 18;
  if (theme === 'editorial') {
    return (
      <AbsoluteFill style={{pointerEvents: 'none', opacity: 0.45}}>
        {Array.from({length: 8}, (_, index) => (
          <div key={index} style={{position: 'absolute', left: `${7 + index * 13}%`, top: 0, bottom: 0, width: 1, background: tokens.muted, opacity: 0.18}} />
        ))}
        <div style={{position: 'absolute', left: '7%', right: '7%', top: '13%', height: 3, background: tokens.secondary}} />
      </AbsoluteFill>
    );
  }
  if (theme === 'scientific') {
    return (
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          opacity: 0.28,
          backgroundImage: `linear-gradient(${tokens.muted}22 1px, transparent 1px), linear-gradient(90deg, ${tokens.muted}22 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          backgroundPosition: `${drift}px ${-drift}px`,
        }}
      />
    );
  }
  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
      <div style={{position: 'absolute', width: '42%', aspectRatio: '1', borderRadius: '50%', left: '-12%', top: '-18%', background: tokens.secondary, filter: 'blur(95px)', opacity: 0.14, transform: `translate(${drift}px, ${drift * 0.5}px)`}} />
      <div style={{position: 'absolute', width: '36%', aspectRatio: '1', borderRadius: '50%', right: '-8%', bottom: '-22%', background: tokens.accent, filter: 'blur(105px)', opacity: 0.12, transform: `translate(${-drift}px, ${drift * 0.4}px)`}} />
    </AbsoluteFill>
  );
};

export const SceneRenderer: React.FC<Props> = ({scene, project, tokens, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const transition = scene.transition?.type ?? 'fade';
  const transitionFrames = Math.min(
    Math.floor(durationInFrames / 3),
    Math.max(1, Math.round((scene.transition?.durationSeconds ?? 0.55) * fps)),
  );
  const enter = transition === 'cut'
    ? 1
    : interpolate(frame, [0, transitionFrames], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const exit = transition === 'cut'
    ? 0
    : interpolate(frame, [durationInFrames - transitionFrames - 1, durationInFrames - 1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  let translateX = 0;
  let translateY = 0;
  let scale = 1;
  if (transition === 'slide-left') translateX = (1 - enter) * 85 - exit * 55;
  if (transition === 'slide-up') translateY = (1 - enter) * 85 - exit * 55;
  if (transition === 'zoom') scale = 0.965 + enter * 0.035 - exit * 0.02;

  return (
    <AbsoluteFill
      style={{
        background: scene.background ?? tokens.gradient,
        color: tokens.text,
        overflow: 'hidden',
        opacity: transition === 'cut' ? 1 : enter * (1 - exit),
        transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
      }}
    >
      <Backdrop tokens={tokens} theme={project.theme} />
      {scene.elements.map((element) => (
        <ElementRenderer key={element.id} element={element} tokens={tokens} sceneDurationFrames={durationInFrames} />
      ))}
      {scene.audio ? <Audio src={resolveMedia(scene.audio.src)} volume={scene.audio.volume ?? 1} loop={scene.audio.loop ?? false} /> : null}
      <DynamicCaptions scene={scene} project={project} tokens={tokens} />
    </AbsoluteFill>
  );
};

