import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export function ScrollEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
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
      markerEnd={markerEnd}
      style={{
        stroke: selected ? '#c4921a' : '#3d2008',
        strokeWidth: 2.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        filter: isSafari ? undefined : 'url(#hand-drawn)',
        transition: 'stroke 0.15s ease',
      }}
    />
  );
}
