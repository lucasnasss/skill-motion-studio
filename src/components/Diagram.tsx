import React from 'react';
import type {DiagramElement, ThemeTokens} from '../types';

type Props = {element: DiagramElement; tokens: ThemeTokens; reveal: number};

export const Diagram: React.FC<Props> = ({element, tokens, reveal}) => {
  const nodeMap = new Map(element.nodes.map((node) => [node.id, node]));
  const markerId = `arrow-${element.id}`;
  return (
    <div style={{position: 'relative', width: '100%', height: '100%', fontFamily: tokens.bodyFont}}>
      <svg width="100%" height="100%" viewBox="0 0 1000 600" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={tokens.muted} />
          </marker>
        </defs>
        {element.edges.map((edge, index) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const x1 = (from.x + (from.width ?? 0.22) / 2) * 1000;
          const y1 = (from.y + (from.height ?? 0.18) / 2) * 600;
          const x2 = (to.x + (to.width ?? 0.22) / 2) * 1000;
          const y2 = (to.y + (to.height ?? 0.18) / 2) * 600;
          const progress = Math.max(0, Math.min(1, reveal * 1.5 - index * 0.1));
          const color = edge.color ?? tokens.muted;
          return (
            <g key={`${edge.from}-${edge.to}-${index}`} opacity={progress}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray="1200" strokeDashoffset={1200 * (1 - progress)} markerEnd={edge.directed === false ? undefined : `url(#${markerId})`} />
              {edge.label ? <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 14} textAnchor="middle" fill={tokens.text} fontSize="24" fontWeight="600" stroke={tokens.background} strokeWidth="8" paintOrder="stroke">{edge.label}</text> : null}
            </g>
          );
        })}
      </svg>
      {element.nodes.map((node, index) => {
        const progress = Math.max(0, Math.min(1, reveal * 1.6 - index * 0.1));
        return (
          <div
            key={node.id}
            style={{
              position: 'absolute',
              left: `${node.x * 100}%`,
              top: `${node.y * 100}%`,
              width: `${(node.width ?? 0.22) * 100}%`,
              height: `${(node.height ?? 0.18) * 100}%`,
              borderRadius: 24,
              background: node.color ?? tokens.surface,
              color: node.textColor ?? tokens.text,
              boxShadow: '0 14px 34px rgba(0,0,0,0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              fontSize: 30,
              fontWeight: 700,
              padding: 18,
              boxSizing: 'border-box',
              opacity: progress,
              transform: `scale(${0.82 + progress * 0.18})`,
            }}
          >
            {node.label}
          </div>
        );
      })}
    </div>
  );
};

