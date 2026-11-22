import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {ChartElement, ThemeTokens} from '../types';

type Props = {element: ChartElement; tokens: ThemeTokens; reveal: number};

const VIEW_W = 1000;
const VIEW_H = 600;
const COLORS = ['#6D5EF9', '#39D2C0', '#FF6FAE', '#FFCB69', '#69A7FF', '#F05A47'];

const niceTicks = (min: number, max: number, count = 5) =>
  Array.from({length: count + 1}, (_, index) => min + ((max - min) * index) / count);

const formatValue = (value: number) =>
  Math.abs(value) >= 1000
    ? new Intl.NumberFormat('pt-BR', {notation: 'compact', maximumFractionDigits: 1}).format(value)
    : new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 1}).format(value);

export const Chart: React.FC<Props> = ({element, tokens, reveal}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const values = element.data.map((point) => point.value);
  const rawMin = element.min ?? Math.min(0, ...values);
  const rawMax = element.max ?? Math.max(0, ...values);
  const min = rawMin === rawMax ? rawMin - 1 : rawMin;
  const max = rawMin === rawMax ? rawMax + 1 : rawMax;
  const palette = element.data.map((point, index) => point.color ?? COLORS[index % COLORS.length]);

  if (element.chartType === 'donut') {
    const positive = element.data.map((point) => Math.max(0, point.value));
    const total = positive.reduce((sum, value) => sum + value, 0) || 1;
    const radius = 165;
    const circumference = 2 * Math.PI * radius;
    let cumulative = 0;
    const donutProgress = Math.min(
      1,
      reveal * spring({frame: Math.max(0, frame - Math.round(fps * 0.2)), fps, config: {damping: 18}}),
    );
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        {element.title ? (
          <text x="500" y="46" textAnchor="middle" fill={tokens.text} fontSize="34" fontWeight="700">
            {element.title}
          </text>
        ) : null}
        <circle cx="320" cy="300" r={radius} fill="none" stroke={tokens.surface} strokeWidth="92" opacity="0.75" />
        {positive.map((value, index) => {
          const length = (value / total) * circumference;
          const offset = -cumulative;
          cumulative += length;
          return (
            <circle
              key={element.data[index].label}
              cx="320"
              cy="300"
              r={radius}
              fill="none"
              stroke={palette[index]}
              strokeWidth="92"
              strokeLinecap="butt"
              strokeDasharray={`${length * donutProgress} ${circumference}`}
              strokeDashoffset={offset}
              transform="rotate(-90 320 300)"
            />
          );
        })}
        <text x="320" y="290" textAnchor="middle" fill={tokens.muted} fontSize="26">
          Total
        </text>
        <text x="320" y="340" textAnchor="middle" fill={tokens.text} fontSize="50" fontWeight="800">
          {formatValue(total)}
        </text>
        {element.showLegend !== false
          ? element.data.map((point, index) => (
              <g key={point.label} transform={`translate(600 ${160 + index * 62})`}>
                <rect width="26" height="26" rx="7" fill={palette[index]} />
                <text x="44" y="22" fill={tokens.text} fontSize="27" fontWeight="600">
                  {point.label}
                </text>
                <text x="950" y="22" textAnchor="end" fill={tokens.text} fontSize="27" fontWeight="800">
                  {formatValue(point.value)}
                </text>
              </g>
            ))
          : null}
      </svg>
    );
  }

  const plot = {left: 105, right: 955, top: 82, bottom: 505};
  const plotWidth = plot.right - plot.left;
  const plotHeight = plot.bottom - plot.top;
  const yFor = (value: number) => plot.bottom - ((value - min) / (max - min)) * plotHeight;
  const baseline = yFor(Math.max(min, Math.min(max, 0)));
  const ticks = niceTicks(min, max);

  if (element.chartType === 'line') {
    const points = element.data.map((point, index) => {
      const x = plot.left + (index / Math.max(1, element.data.length - 1)) * plotWidth;
      return {x, y: yFor(point.value), ...point};
    });
    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    const lineProgress = Math.min(
      1,
      reveal * interpolate(frame, [Math.round(fps * 0.25), Math.round(fps * 1.7)], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }),
    );
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        {element.title ? <text x="500" y="42" textAnchor="middle" fill={tokens.text} fontSize="34" fontWeight="700">{element.title}</text> : null}
        {element.grid !== false
          ? ticks.map((tick) => (
              <g key={tick}>
                <line x1={plot.left} y1={yFor(tick)} x2={plot.right} y2={yFor(tick)} stroke={tokens.muted} opacity="0.22" strokeWidth="2" />
                <text x={plot.left - 18} y={yFor(tick) + 8} textAnchor="end" fill={tokens.muted} fontSize="22">{formatValue(tick)}</text>
              </g>
            ))
          : null}
        <line x1={plot.left} y1={plot.bottom} x2={plot.right} y2={plot.bottom} stroke={tokens.muted} strokeWidth="3" />
        <line x1={plot.left} y1={plot.top} x2={plot.left} y2={plot.bottom} stroke={tokens.muted} strokeWidth="3" />
        <path d={path} fill="none" stroke={tokens.primary} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1800" strokeDashoffset={1800 * (1 - lineProgress)} />
        {points.map((point, index) => {
          const pointProgress = Math.max(0, Math.min(1, lineProgress * element.data.length - index));
          return (
            <g key={point.label} opacity={pointProgress}>
              <circle cx={point.x} cy={point.y} r={10 + pointProgress * 4} fill={palette[index]} stroke={tokens.surface} strokeWidth="5" />
              <text x={point.x} y={plot.bottom + 38} textAnchor="middle" fill={tokens.text} fontSize="22">{point.label}</text>
              {element.showValues !== false ? <text x={point.x} y={point.y - 24} textAnchor="middle" fill={tokens.text} fontSize="22" fontWeight="700">{formatValue(point.value)}</text> : null}
            </g>
          );
        })}
        {element.xLabel ? <text x="530" y="587" textAnchor="middle" fill={tokens.muted} fontSize="22">{element.xLabel}</text> : null}
        {element.yLabel ? <text x="28" y="300" textAnchor="middle" fill={tokens.muted} fontSize="22" transform="rotate(-90 28 300)">{element.yLabel}</text> : null}
      </svg>
    );
  }

  const slot = plotWidth / element.data.length;
  const barWidth = Math.min(110, slot * 0.6);
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
      {element.title ? <text x="500" y="42" textAnchor="middle" fill={tokens.text} fontSize="34" fontWeight="700">{element.title}</text> : null}
      {element.grid !== false
        ? ticks.map((tick) => (
            <g key={tick}>
              <line x1={plot.left} y1={yFor(tick)} x2={plot.right} y2={yFor(tick)} stroke={tokens.muted} opacity="0.22" strokeWidth="2" />
              <text x={plot.left - 18} y={yFor(tick) + 8} textAnchor="end" fill={tokens.muted} fontSize="22">{formatValue(tick)}</text>
            </g>
          ))
        : null}
      <line x1={plot.left} y1={baseline} x2={plot.right} y2={baseline} stroke={tokens.muted} strokeWidth="3" />
      <line x1={plot.left} y1={plot.top} x2={plot.left} y2={plot.bottom} stroke={tokens.muted} strokeWidth="3" />
      {element.data.map((point, index) => {
        const barProgress = Math.min(
          1,
          reveal * spring({frame: Math.max(0, frame - Math.round(fps * (0.2 + index * 0.12))), fps, config: {damping: 16, stiffness: 120}}),
        );
        const targetY = yFor(point.value);
        const height = Math.abs(baseline - targetY) * barProgress;
        const y = point.value >= 0 ? baseline - height : baseline;
        const x = plot.left + index * slot + (slot - barWidth) / 2;
        return (
          <g key={point.label}>
            <rect x={x} y={y} width={barWidth} height={Math.max(0.5, height)} rx="14" fill={palette[index]} />
            <text x={x + barWidth / 2} y={plot.bottom + 38} textAnchor="middle" fill={tokens.text} fontSize="22">{point.label}</text>
            {element.showValues !== false ? <text x={x + barWidth / 2} y={point.value >= 0 ? y - 18 : y + height + 30} textAnchor="middle" fill={tokens.text} fontSize="22" fontWeight="700">{formatValue(point.value)}</text> : null}
          </g>
        );
      })}
      {element.xLabel ? <text x="530" y="587" textAnchor="middle" fill={tokens.muted} fontSize="22">{element.xLabel}</text> : null}
      {element.yLabel ? <text x="28" y="300" textAnchor="middle" fill={tokens.muted} fontSize="22" transform="rotate(-90 28 300)">{element.yLabel}</text> : null}
    </svg>
  );
};

