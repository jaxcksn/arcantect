import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { NODE_REGISTRY } from './registry';

export type RuneData = { nodeType: string; label?: string };
type RuneNodeType = Node<RuneData, 'rune'>;

const VARIANT_ICON_COLOR: Record<string, string> = {
  application: '#5a2d8a',
  data: '#6a5030',
};

export function RuneNode({ data, isConnectable }: NodeProps<RuneNodeType>) {
  const def = NODE_REGISTRY[data.nodeType];
  const Icon = def?.Icon;
  const variant = def?.variant;
  const iconColor = variant ? (VARIANT_ICON_COLOR[variant] ?? '#3d2008') : '#3d2008';
  const className = ['rune-node', variant ? `rune-node--${variant}` : ''].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <Handle
        id='top'
        type='source'
        position={Position.Top}
        isConnectable={isConnectable}
      />
      <Handle
        id='right'
        type='source'
        position={Position.Right}
        isConnectable={isConnectable}
      />
      <Handle
        id='bottom'
        type='source'
        position={Position.Bottom}
        isConnectable={isConnectable}
      />
      <Handle
        id='left'
        type='source'
        position={Position.Left}
        isConnectable={isConnectable}
      />

      <div className='rune-node__icon'>
        {Icon && <Icon color={iconColor} strokeWidth={1} />}
      </div>
      <div className='rune-node__label'>{data.label ?? def?.label ?? data.nodeType}</div>
    </div>
  );
}
