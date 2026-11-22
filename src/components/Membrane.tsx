import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import type {MembraneElement, ThemeTokens} from '../types';

type Props = {element: MembraneElement; tokens: ThemeTokens};

const smooth = (value: number) => 0.5 - Math.cos(Math.PI * value) / 2;

export const Membrane: React.FC<Props> = ({element, tokens}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const headColor = '#62D4CF';
  const tailColor = '#89A9C2';
  const particleColor = element.particleColor ?? (element.mode === 'osmosis' ? '#69A7FF' : '#FFCB69');
  const clusterColor = element.mode === 'osmosis' ? tokens.accent : particleColor;
  const highOutside = (element.highConcentration ?? 'outside') === 'outside';
  const hasChannel = element.mode === 'facilitated-diffusion' || element.mode === 'active-transport';
  const isStructure = element.mode === 'structure';
  const isAgainstGradient = element.mode === 'active-transport';
  const movesTowardHighSolute = element.mode === 'osmosis' || isAgainstGradient;
  const outsideIsStart = movesTowardHighSolute ? !highOutside : highOutside;
  const lipids = Array.from({length: 24}, (_, index) => 40 + index * 40);
  const cluster = (outside: boolean, count: number) =>
    Array.from({length: count}, (_, index) => ({
      x: 80 + ((index * 83 + (outside ? 23 : 47)) % 820),
      y: outside ? 80 + (index % 3) * 44 : 430 + (index % 3) * 44,
    }));
  const outsideCount = highOutside ? 11 : 4;
  const insideCount = highOutside ? 4 : 11;

  return (
    <svg width="100%" height="100%" viewBox="0 0 1000 600">
      <defs>
        <linearGradient id={`channel-${element.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={tokens.primary} />
          <stop offset="1" stopColor={tokens.secondary} />
        </linearGradient>
        <marker id={`motion-arrow-${element.id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={particleColor} />
        </marker>
      </defs>
      <rect x="20" y="20" width="960" height="560" rx="32" fill={tokens.surface} opacity="0.35" stroke={tokens.muted} strokeOpacity="0.28" strokeWidth="3" />
      <text x="48" y="55" fill={tokens.muted} fontSize="25" fontWeight="700">{element.outsideLabel ?? 'Meio extracelular'}</text>
      <text x="48" y="566" fill={tokens.muted} fontSize="25" fontWeight="700">{element.insideLabel ?? 'Citoplasma'}</text>

      {lipids.map((x) => (
        <g key={`top-${x}`}>
          <circle cx={x} cy="258" r="15" fill={headColor} stroke="#D9FFFF" strokeWidth="3" />
          <line x1={x - 5} y1="274" x2={x - 10} y2="300" stroke={tailColor} strokeWidth="6" strokeLinecap="round" />
          <line x1={x + 5} y1="274" x2={x + 10} y2="300" stroke={tailColor} strokeWidth="6" strokeLinecap="round" />
        </g>
      ))}
      {lipids.map((x) => (
        <g key={`bottom-${x}`}>
          <circle cx={x} cy="342" r="15" fill={headColor} stroke="#D9FFFF" strokeWidth="3" />
          <line x1={x - 5} y1="326" x2={x - 10} y2="300" stroke={tailColor} strokeWidth="6" strokeLinecap="round" />
          <line x1={x + 5} y1="326" x2={x + 10} y2="300" stroke={tailColor} strokeWidth="6" strokeLinecap="round" />
        </g>
      ))}

      {hasChannel ? (
        <g>
          <path d="M 440 225 C 408 250 416 350 448 375 L 492 355 C 474 330 474 270 492 245 Z" fill={`url(#channel-${element.id})`} stroke="#D7FFFF" strokeWidth="4" />
          <path d="M 560 225 C 592 250 584 350 552 375 L 508 355 C 526 330 526 270 508 245 Z" fill={`url(#channel-${element.id})`} stroke="#D7FFFF" strokeWidth="4" />
          <rect x="487" y="235" width="26" height="130" rx="13" fill={tokens.background} opacity="0.9" />
          <text x="500" y="408" textAnchor="middle" fill={tokens.text} fontSize="23" fontWeight="700">{element.channelLabel ?? (isAgainstGradient ? 'Bomba' : 'Proteína de canal')}</text>
        </g>
      ) : null}

      {!isStructure
        ? cluster(true, outsideCount).map((point, index) => <circle key={`out-${index}`} cx={point.x} cy={point.y} r={element.mode === 'osmosis' ? 10 : 12} fill={clusterColor} opacity="0.8" />)
        : null}
      {!isStructure
        ? cluster(false, insideCount).map((point, index) => <circle key={`in-${index}`} cx={point.x} cy={point.y} r={element.mode === 'osmosis' ? 10 : 12} fill={clusterColor} opacity="0.8" />)
        : null}

      {!isStructure
        ? Array.from({length: 5}, (_, index) => {
            const phase = ((frame / (fps * 2.25) + index * 0.19) % 1 + 1) % 1;
            const progress = smooth(phase);
            const startY = outsideIsStart ? 125 : 475;
            const endY = outsideIsStart ? 475 : 125;
            const baseX = hasChannel ? 500 + (index - 2) * 7 : 235 + index * 130;
            const x = baseX + Math.sin(phase * Math.PI * 2 + index) * (hasChannel ? 5 : 25);
            const y = startY + (endY - startY) * progress;
            return <circle key={`moving-${index}`} cx={x} cy={y} r={14} fill={particleColor} stroke="#FFFFFF" strokeWidth="4" />;
          })
        : null}

      {isStructure ? (
        <g>
          <line x1="760" y1="170" x2="760" y2="245" stroke={tokens.accent} strokeWidth="5" markerEnd={`url(#motion-arrow-${element.id})`} />
          <text x="760" y="145" textAnchor="middle" fill={tokens.text} fontSize="25" fontWeight="700">Cabeças hidrofílicas</text>
          <line x1="260" y1="410" x2="300" y2="320" stroke={tokens.accent} strokeWidth="5" markerEnd={`url(#motion-arrow-${element.id})`} />
          <text x="210" y="445" textAnchor="middle" fill={tokens.text} fontSize="25" fontWeight="700">Caudas hidrofóbicas</text>
          <text x="500" y="115" textAnchor="middle" fill={tokens.text} fontSize="34" fontWeight="800">Bicamada fosfolipídica</text>
        </g>
      ) : null}

      {!isStructure ? (
        <g>
          <text x="835" y="105" textAnchor="middle" fill={tokens.text} fontSize="23" fontWeight="700">{highOutside ? 'Alta concentração' : 'Baixa concentração'}</text>
          <text x="835" y="510" textAnchor="middle" fill={tokens.text} fontSize="23" fontWeight="700">{highOutside ? 'Baixa concentração' : 'Alta concentração'}</text>
          <text x="70" y="316" fill={tokens.text} fontSize="22" fontWeight="700">Membrana</text>
          <text x="500" y="92" textAnchor="middle" fill={particleColor} fontSize="25" fontWeight="800">{element.particleLabel ?? (element.mode === 'osmosis' ? 'Água (H₂O)' : 'Soluto')}</text>
          {element.mode === 'osmosis' ? <text x="155" y="210" fill={clusterColor} fontSize="21" fontWeight="700">Pontos laranja = soluto</text> : null}
        </g>
      ) : null}

      {isAgainstGradient ? (
        <g>
          <rect x="595" y="185" width="185" height="60" rx="20" fill={tokens.accent} />
          <text x="687" y="224" textAnchor="middle" fill="#17233C" fontSize="26" fontWeight="900">{element.energyLabel ?? 'ATP → ADP + Pi'}</text>
          <path d="M 610 250 C 580 275 570 295 555 305" fill="none" stroke={tokens.accent} strokeWidth="6" markerEnd={`url(#motion-arrow-${element.id})`} />
        </g>
      ) : null}
    </svg>
  );
};

