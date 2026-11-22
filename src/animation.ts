import type {CSSProperties} from 'react';
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Animation, Placement} from './types';

const clamp = (value: number) => Math.max(0, Math.min(1, value));

const easingFunction = (name: Animation['easing']) => {
  switch (name) {
    case 'linear':
      return Easing.linear;
    case 'ease-in':
      return Easing.in(Easing.cubic);
    case 'ease-out':
      return Easing.out(Easing.cubic);
    case 'ease-in-out':
      return Easing.inOut(Easing.cubic);
    case 'ease':
    default:
      return Easing.bezier(0.22, 1, 0.36, 1);
  }
};

const animationProgress = (
  frame: number,
  fps: number,
  animation: Animation | undefined,
  defaultValue: number,
) => {
  if (!animation || animation.preset === 'none') return defaultValue;
  const delay = Math.round((animation.delaySeconds ?? 0) * fps);
  const duration = Math.max(1, Math.round((animation.durationSeconds ?? 0.6) * fps));
  if (animation.easing === 'spring') {
    return clamp(
      spring({
        frame: Math.max(0, frame - delay),
        fps,
        durationInFrames: duration,
        config: {damping: 18, stiffness: 150, mass: 0.8},
      }),
    );
  }
  return interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: easingFunction(animation.easing),
  });
};

const offsetFor = (preset: Animation['preset'], amount: number) => {
  switch (preset) {
    case 'slide-up':
      return {x: 0, y: amount};
    case 'slide-down':
      return {x: 0, y: -amount};
    case 'slide-left':
      return {x: amount, y: 0};
    case 'slide-right':
      return {x: -amount, y: 0};
    default:
      return {x: 0, y: 0};
  }
};

export const useElementAnimation = (element: Placement, sceneDurationFrames: number) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enterProgress = animationProgress(frame, fps, element.enter, 1);
  const exitDuration = Math.max(1, Math.round((element.exit?.durationSeconds ?? 0.5) * fps));
  const exitDelay = Math.round((element.exit?.delaySeconds ?? 0) * fps);
  const exitStart = sceneDurationFrames - exitDuration - exitDelay;
  const exitProgress = element.exit
    ? animationProgress(frame - exitStart, fps, {...element.exit, delaySeconds: 0}, 0)
    : 0;

  const enterOffset = offsetFor(element.enter?.preset, 54 * (1 - enterProgress));
  const exitOffset = offsetFor(element.exit?.preset, -54 * exitProgress);
  const pop = element.enter?.preset === 'pop';
  const zoom = element.enter?.preset === 'zoom' || pop;
  const exitZoom = element.exit?.preset === 'zoom' || element.exit?.preset === 'pop';
  const scaleIn = zoom ? 0.78 + enterProgress * 0.22 : 1;
  const scaleOut = exitZoom ? 1 - exitProgress * 0.18 : 1;
  const shouldFadeIn = element.enter?.preset !== 'none' && element.enter?.preset !== 'draw';
  const shouldFadeOut = element.exit?.preset !== 'none' && element.exit?.preset !== 'draw';
  const baseOpacity = element.opacity ?? 1;
  const opacity =
    baseOpacity *
    (shouldFadeIn && element.enter ? enterProgress : 1) *
    (shouldFadeOut && element.exit ? 1 - exitProgress : 1);
  const wipe = element.enter?.preset === 'wipe' ? (1 - enterProgress) * 100 : 0;

  const style: CSSProperties = {
    opacity,
    transform: `translate3d(${enterOffset.x + exitOffset.x}px, ${enterOffset.y + exitOffset.y}px, 0) scale(${scaleIn * scaleOut}) rotate(${element.rotation ?? 0}deg)`,
    clipPath: element.enter?.preset === 'wipe' ? `inset(0 ${wipe}% 0 0)` : undefined,
  };

  return {style, enterProgress, exitProgress};
};

