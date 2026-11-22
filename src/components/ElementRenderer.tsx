import React from 'react';
import {Img, OffthreadVideo, staticFile, useVideoConfig} from 'remotion';
import {useElementAnimation} from '../animation';
import type {
  Element,
  ImageElement,
  ProcessElement,
  ShapeElement,
  TextElement,
  ThemeTokens,
  VideoElement,
} from '../types';
import {Chart} from './Chart';
import {Diagram} from './Diagram';
import {Membrane} from './Membrane';
import {ThreeScene} from './ThreeScene';

type Props = {element: Element; tokens: ThemeTokens; sceneDurationFrames: number};

const roleSizes: Record<NonNullable<TextElement['role']>, number> = {
  eyebrow: 26,
  title: 100,
  subtitle: 56,
  body: 42,
  label: 31,
  number: 88,
  caption: 28,
};

const TextView: React.FC<{element: TextElement; tokens: ThemeTokens}> = ({element, tokens}) => {
  const {width, height} = useVideoConfig();
  const scale = Math.min(width / 1920, height / 1080);
  const role = element.role ?? 'body';
  const justify = element.verticalAlign === 'top' ? 'flex-start' : element.verticalAlign === 'bottom' ? 'flex-end' : 'center';
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: justify,
        justifyContent: element.align === 'left' ? 'flex-start' : element.align === 'right' ? 'flex-end' : 'center',
        textAlign: element.align ?? 'left',
        fontFamily: role === 'title' || role === 'subtitle' || role === 'number' ? tokens.titleFont : tokens.bodyFont,
        fontSize: element.fontSize ?? Math.round(roleSizes[role] * scale),
        fontWeight: element.fontWeight ?? (role === 'title' || role === 'subtitle' || role === 'number' ? tokens.titleWeight : tokens.bodyWeight),
        lineHeight: element.lineHeight ?? (role === 'title' ? 0.98 : 1.18),
        letterSpacing: element.letterSpacing ?? (role === 'eyebrow' ? 2.5 : -0.4),
        color: element.color ?? (role === 'eyebrow' ? tokens.primary : tokens.text),
        background: element.background,
        padding: element.padding ?? 0,
        borderRadius: element.borderRadius ?? 0,
        boxSizing: 'border-box',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
        textTransform: role === 'eyebrow' ? 'uppercase' : undefined,
      }}
    >
      <span
        style={
          element.maxLines
            ? {
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: element.maxLines,
                overflow: 'hidden',
              }
            : undefined
        }
      >
        {element.text}
      </span>
    </div>
  );
};

const ShapeView: React.FC<{element: ShapeElement; tokens: ThemeTokens; reveal: number}> = ({element, tokens, reveal}) => {
  const fill = element.fill ?? tokens.primary;
  const stroke = element.stroke ?? fill;
  const strokeWidth = element.strokeWidth ?? 8;
  if (element.kind === 'line' || element.kind === 'arrow') {
    const markerId = `shape-arrow-${element.id}`;
    const markerOpacity = Math.max(0, Math.min(1, reveal * 2 - 1));
    return (
      <svg width="100%" height="100%" viewBox="0 0 1000 200" preserveAspectRatio="none" style={{overflow: 'visible'}}>
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} opacity={markerOpacity} />
          </marker>
        </defs>
        <line x1="12" y1="100" x2="972" y2="100" stroke={stroke} strokeWidth={strokeWidth * 2} strokeLinecap="round" strokeDasharray="1000" strokeDashoffset={1000 * (1 - reveal)} markerEnd={element.kind === 'arrow' ? `url(#${markerId})` : undefined} />
      </svg>
    );
  }
  if (element.kind === 'ring') {
    return (
      <svg width="100%" height="100%" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={80} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={2 * Math.PI * 80} strokeDashoffset={2 * Math.PI * 80 * (1 - reveal)} strokeLinecap="round" transform="rotate(-90 100 100)" />
      </svg>
    );
  }
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: fill,
        border: element.stroke ? `${strokeWidth}px solid ${stroke}` : undefined,
        borderRadius: element.kind === 'circle' ? '50%' : element.kind === 'rounded' ? element.borderRadius ?? 32 : element.borderRadius ?? 0,
        boxSizing: 'border-box',
        boxShadow: element.shadow,
      }}
    />
  );
};

const ImageView: React.FC<{element: ImageElement}> = ({element}) => {
  const isRemote = /^https?:\/\//i.test(element.src) || /^data:/i.test(element.src);
  const source = isRemote ? element.src : staticFile(element.src.replaceAll('\\', '/').replace(/^\//, ''));
  return (
    <Img
      src={source}
      alt={element.alt ?? ''}
      style={{width: '100%', height: '100%', objectFit: element.fit ?? 'contain', borderRadius: element.borderRadius ?? 0}}
    />
  );
};

const VideoView: React.FC<{element: VideoElement}> = ({element}) => {
  const {fps} = useVideoConfig();
  const isRemote = /^https?:\/\//i.test(element.src) || /^data:/i.test(element.src);
  const source = isRemote ? element.src : staticFile(element.src.replaceAll('\\', '/').replace(/^\//, ''));
  const trimBefore = element.startFromSeconds === undefined ? undefined : Math.round(element.startFromSeconds * fps);
  const durationInFrames = element.endAtSeconds === undefined
    ? undefined
    : Math.max(1, Math.round((element.endAtSeconds - (element.startFromSeconds ?? 0)) * fps));
  return (
    <OffthreadVideo
      src={source}
      trimBefore={trimBefore}
      durationInFrames={durationInFrames}
      playbackRate={element.playbackRate ?? 1}
      volume={element.muted ? 0 : element.volume ?? 1}
      muted={element.muted ?? false}
      style={{width: '100%', height: '100%', objectFit: element.fit ?? 'cover', borderRadius: element.borderRadius ?? 0}}
    />
  );
};

const ProcessView: React.FC<{element: ProcessElement; tokens: ThemeTokens; reveal: number}> = ({element, tokens, reveal}) => {
  const horizontal = (element.orientation ?? 'horizontal') === 'horizontal';
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        gap: horizontal ? 22 : 16,
        fontFamily: tokens.bodyFont,
      }}
    >
      {element.steps.map((step, index) => {
        const progress = Math.max(0, Math.min(1, reveal * 1.7 - index * 0.13));
        const active = element.activeStep === undefined || index <= element.activeStep;
        return (
          <React.Fragment key={`${step.label}-${index}`}>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                background: step.color ?? (active ? tokens.primary : tokens.surface),
                color: active ? tokens.background : tokens.text,
                borderRadius: 26,
                padding: horizontal ? '24px 22px' : '18px 24px',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                alignItems: horizontal ? 'center' : 'flex-start',
                justifyContent: 'center',
                textAlign: horizontal ? 'center' : 'left',
                boxShadow: '0 15px 35px rgba(0,0,0,0.14)',
                opacity: progress,
                transform: `translate${horizontal ? 'Y' : 'X'}(${(1 - progress) * 30}px) scale(${0.9 + progress * 0.1})`,
              }}
            >
              <div style={{fontSize: 22, fontWeight: 900, opacity: 0.78, marginBottom: 8}}>{String(index + 1).padStart(2, '0')}</div>
              <div style={{fontSize: horizontal ? 30 : 28, fontWeight: 800, lineHeight: 1.08}}>{step.label}</div>
              {step.detail ? <div style={{fontSize: 21, fontWeight: 500, lineHeight: 1.25, marginTop: 10, opacity: 0.86}}>{step.detail}</div> : null}
            </div>
            {index < element.steps.length - 1 ? (
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.accent, fontSize: 42, fontWeight: 900, opacity: progress}}>
                {horizontal ? '→' : '↓'}
              </div>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const ElementRenderer: React.FC<Props> = ({element, tokens, sceneDurationFrames}) => {
  const {style, enterProgress} = useElementAnimation(element, sceneDurationFrames);
  const wrapper: React.CSSProperties = {
    position: 'absolute',
    left: `${element.x * 100}%`,
    top: `${element.y * 100}%`,
    width: `${element.width * 100}%`,
    height: `${element.height * 100}%`,
    zIndex: element.z ?? 0,
    pointerEvents: 'none',
    transformOrigin: 'center center',
    ...style,
  };

  let content: React.ReactNode;
  switch (element.type) {
    case 'text':
      content = <TextView element={element} tokens={tokens} />;
      break;
    case 'shape':
      content = <ShapeView element={element} tokens={tokens} reveal={enterProgress} />;
      break;
    case 'image':
      content = <ImageView element={element} />;
      break;
    case 'video':
      content = <VideoView element={element} />;
      break;
    case 'three':
      content = <ThreeScene element={element} tokens={tokens} />;
      break;
    case 'diagram':
      content = <Diagram element={element} tokens={tokens} reveal={enterProgress} />;
      break;
    case 'chart':
      content = <Chart element={element} tokens={tokens} reveal={enterProgress} />;
      break;
    case 'process':
      content = <ProcessView element={element} tokens={tokens} reveal={enterProgress} />;
      break;
    case 'membrane':
      content = <Membrane element={element} tokens={tokens} />;
      break;
    default:
      content = null;
  }
  return <div style={wrapper}>{content}</div>;
};

