import { Panel } from '@xyflow/react';
import { CATEGORIES, NODE_REGISTRY } from '@nodes/registry';

function onDragStart(event: React.DragEvent<HTMLDivElement>, nodeId: string) {
  event.dataTransfer.setData('application/reactflow', nodeId);
  event.dataTransfer.effectAllowed = 'move';
}

export function NodePanel() {
  const selectableCategories = CATEGORIES.filter(
    category => category !== 'Input',
  );

  return (
    <Panel position='top-right' className='node-panel'>
      <div className='node-panel__header'>
        <h2 className='node-panel__title'>Spellbook</h2>
      </div>

      {selectableCategories.map(category => {
        const nodes = Object.values(NODE_REGISTRY).filter(
          n => n.category === category,
        );
        return (
          <div key={category} className='node-panel__section'>
            <div className='node-panel__section-title'>{category}</div>
            <div className='node-panel__grid'>
              {nodes.map(node => (
                <div
                  key={node.id}
                  className='node-panel__item'
                  draggable
                  onDragStart={e => onDragStart(e, node.id)}
                >
                  <div className='node-panel__item-icon'>
                    <node.Icon color='#3d2008' strokeWidth={1} />
                  </div>
                  <div className='node-panel__item-label'>{node.label}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </Panel>
  );
}
