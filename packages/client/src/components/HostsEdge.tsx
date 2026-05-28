import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export function HostsEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: selected ? '#c4921a' : '#7a3db5',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        filter: isSafari ? undefined : 'url(#hand-drawn)',
        transition: 'stroke 0.15s ease',
      }}
    />
  );
}
