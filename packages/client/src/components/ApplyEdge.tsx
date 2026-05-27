import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

export function ApplyEdge({
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
        stroke: selected ? '#c4921a' : '#3d2008',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeDasharray: '6 4',
        opacity: 0.75,
        filter: 'url(#hand-drawn)',
        transition: 'stroke 0.15s ease',
      }}
    />
  );
}
