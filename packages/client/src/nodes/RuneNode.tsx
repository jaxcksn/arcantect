import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { NODE_REGISTRY } from './registry';

export type RuneData = { nodeType: string };
type RuneNodeType = Node<RuneData, 'rune'>;

export function RuneNode({ data, isConnectable }: NodeProps<RuneNodeType>) {
  const def = NODE_REGISTRY[data.nodeType];
  const Icon = def?.Icon;

  return (
    <div className='rune-node'>
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
        {Icon && <Icon color='#3d2008' strokeWidth={1} />}
      </div>
      <div className='rune-node__label'>{def?.label ?? data.nodeType}</div>
    </div>
  );
}
