import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {CaptionCue, CaptionWord, MotionProject, Scene, ThemeTokens} from '../types';

type Props = {scene: Scene; project: MotionProject; tokens: ThemeTokens};

const fallbackCue = (scene: Scene): CaptionCue | null =>
  scene.narration?.trim()
    ? {id: `${scene.id}-narration`, startSeconds: 0, endSeconds: scene.durationSeconds, text: scene.narration.trim()}
    : null;

export const DynamicCaptions: React.FC<Props> = ({scene, project, tokens}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps;
  const cue = (scene.captions ?? []).find((candidate) => time >= candidate.startSeconds && time < candidate.endSeconds)
    ?? (scene.captions?.length ? null : fallbackCue(scene));
  if (!cue || !project.captions?.enabled || !project.captions.burnIn) return null;

  const style = project.captions.style ?? 'traditional';
  const safe = project.video.safeMarginPct ?? 0.07;
  const position = project.captions.position ?? 'bottom';
  const cueFrame = Math.max(0, frame - Math.round(cue.startSeconds * fps));
  const entrance = spring({frame: cueFrame, fps, config: {damping: 20, stiffness: 180, mass: 0.55}});
  const hasWordTimings = Boolean(cue.words?.length);
  const words: CaptionWord[] = cue.words?.length
    ? cue.words
    : cue.text.split(/\s+/).filter(Boolean).map((text) => ({text, startSeconds: cue.startSeconds, endSeconds: cue.endSeconds}));

  return (
    <div
      style={{
        position: 'absolute',
        left: `${safe * 100}%`,
        right: `${safe * 100}%`,
        top: position === 'top' ? `${safe * 100}%` : position === 'center' ? '45%' : undefined,
        bottom: position === 'bottom' ? `${safe * 100}%` : undefined,
        margin: 'auto',
        color: project.captions.color ?? '#FFFFFF',
        background: project.captions.background ?? 'rgba(0,0,0,0.72)',
        borderRadius: 18,
        padding: '15px 24px',
        textAlign: 'center',
        fontFamily: tokens.bodyFont,
        fontSize: project.captions.fontSize ?? Math.round(42 * Math.min(project.video.width / 1920, project.video.height / 1080)),
        fontWeight: 800,
        lineHeight: 1.18,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        columnGap: '0.28em',
        rowGap: '0.12em',
        boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
        zIndex: 100,
        opacity: entrance,
        transform: `translateY(${(1 - entrance) * 18}px) scale(${0.96 + entrance * 0.04})`,
      }}
    >
      {words.map((word, index) => {
        const current = time >= word.startSeconds && time < word.endSeconds;
        const completed = time >= word.endSeconds;
        const highlighted = style === 'highlight'
          ? current || Boolean(word.emphasis)
          : style === 'karaoke'
            ? current || completed
            : false;
        return (
          <React.Fragment key={`${word.text}-${index}`}>
            <span
              style={{
                color: highlighted ? project.captions?.highlightColor ?? tokens.accent : undefined,
                display: 'inline-block',
                transform: hasWordTimings && current && style !== 'traditional' ? 'scale(1.08)' : undefined,
                transition: 'none',
              }}
            >
              {word.text}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};
