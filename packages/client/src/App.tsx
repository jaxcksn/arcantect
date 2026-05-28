import '@xyflow/react/dist/style.css';
import './App.scss';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  Panel,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import { NodePanel } from '@components/NodePanel';
import { ApplyEdge } from '@components/ApplyEdge';
import { HostsEdge } from '@components/HostsEdge';
import { ScrollEdge } from '@components/ScrollEdge';
import { RuneNode } from '@nodes/RuneNode';
import { useGameStore } from '@store';
import { useCallback, useState } from 'react';

const edgeTypes = { default: ScrollEdge, apply: ApplyEdge, hosts: HostsEdge };
const nodeTypes = { rune: RuneNode };

function ScrollFilters() {
  return (
    <svg
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      aria-hidden='true'
    >
      <defs>
        <filter
          id='hand-drawn'
          x='-10000'
          y='-10000'
          width='20000'
          height='20000'
          filterUnits='userSpaceOnUse'
        >
          <feTurbulence
            type='fractalNoise'
            baseFrequency='0.035'
            numOctaves='4'
            seed='5'
            result='noise'
          />
          <feDisplacementMap
            in='SourceGraphic'
            in2='noise'
            scale='3.5'
            xChannelSelector='R'
            yChannelSelector='G'
          />
        </filter>
      </defs>
    </svg>
  );
}

function tagModifier(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

function App() {
  const nodes = useGameStore(s => s.nodes);
  const edges = useGameStore(s => s.edges);
  const onNodesChange = useGameStore(s => s.onNodesChange);
  const onEdgesChange = useGameStore(s => s.onEdgesChange);
  const onConnect = useGameStore(s => s.onConnect);
  const addNode = useGameStore(s => s.addNode);
  const scoreResult = useGameStore(s => s.scoreResult);
  const puzzle = useGameStore(s => s.puzzle);
  const submitPuzzle = useGameStore(s => s.submitPuzzle);
  const goHome = useGameStore(s => s.goHome);

  const [briefOpen, setBriefOpen] = useState(true);
  const [reqsOpen, setReqsOpen] = useState(true);
  const [violationsOpen, setViolationsOpen] = useState(true);

  const { screenToFlowPosition } = useReactFlow();

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData('application/reactflow');
      if (!nodeType) return;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      addNode(nodeType, position);
    },
    [addNode, screenToFlowPosition],
  );

  const metCount = scoreResult
    ? scoreResult.requirementResults.filter(r => r.passed).length
    : 0;
  const totalCount = scoreResult ? scoreResult.requirementResults.length : 0;
  const progressPct = totalCount > 0 ? (metCount / totalCount) * 100 : 0;
  const allRequirementsMet = totalCount > 0 && metCount === totalCount;

  return (
    <div className='canvas-wrapper'>
      <ScrollFilters />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        edgeTypes={edgeTypes}
        nodeTypes={nodeTypes}
        onDragOver={onDragOver}
        onDrop={onDrop}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={40}
        fitView
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1.5}
          color='rgba(74, 44, 10, 0.2)'
        />
        <Controls />
        <NodePanel />
        <Panel position='top-left' className='nav-panel'>
          <button className='nav-panel__home' onClick={goHome}>
            ← Home
          </button>
          <span className='nav-panel__title'>Arcantect</span>
          <div className='nav-panel__spacer' aria-hidden='true' />
          {scoreResult && (
            <button
              className={`nav-panel__submit${allRequirementsMet ? ' nav-panel__submit--complete' : ''}`}
              onClick={submitPuzzle}
            >
              <span>Consult the Council</span>
            </button>
          )}
        </Panel>
        <Panel position='top-left' className='score-panel'>
          {puzzle && (
            <div className='score-panel__content'>
              {/* Header: title + tags */}
              <div className='score-panel__summary'>
                <div className='score-panel__title-block'>
                  <span className='score-panel__score'>{puzzle.title}</span>
                  <div className='score-panel__tags'>
                    {puzzle.context.tags.map(tag => (
                      <span
                        key={tag}
                        className={`score-panel__tag score-panel__tag--${tagModifier(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {scoreResult && (
                <>
                  {/* Live requirements progress */}
                  <div className='score-panel__progress'>
                    <div className='score-panel__progress-header'>
                      <span className='score-panel__progress-label'>
                        Progress
                      </span>
                      <span className='score-panel__progress-count'>
                        <strong>{metCount}</strong> / {totalCount}
                      </span>
                    </div>
                    <div className='score-panel__progress-bar'>
                      <div
                        className='score-panel__progress-fill'
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Collapsible: Enchantment Brief */}
                  <button
                    className='score-panel__section-toggle'
                    onClick={() => setBriefOpen(o => !o)}
                    aria-expanded={briefOpen}
                  >
                    <span className='score-panel__heading'>
                      Enchantment Brief
                    </span>
                    <span
                      className='score-panel__toggle-icon'
                      aria-hidden='true'
                    >
                      {briefOpen ? '▾' : '▸'}
                    </span>
                  </button>
                  {briefOpen && (
                    <p className='score-panel__prompt-text'>{puzzle.prompt}</p>
                  )}

                  {/* Collapsible: Requirements checklist */}
                  <button
                    className='score-panel__section-toggle'
                    onClick={() => setReqsOpen(o => !o)}
                    aria-expanded={reqsOpen}
                  >
                    <span className='score-panel__heading'>Requirements</span>
                    <span
                      className='score-panel__toggle-icon'
                      aria-hidden='true'
                    >
                      {reqsOpen ? '▾' : '▸'}
                    </span>
                  </button>
                  {reqsOpen && (
                    <ul className='score-panel__checklist'>
                      {scoreResult.requirementResults.map(req => (
                        <li
                          key={req.id}
                          className={`score-panel__check-item${req.passed ? ' score-panel__check-item--met' : ''}`}
                        >
                          <span
                            className='score-panel__check-marker'
                            aria-hidden='true'
                          >
                            {req.passed ? '✦' : '○'}
                          </span>
                          <span className='score-panel__check-label'>
                            {req.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Collapsible: Violations */}
                  {scoreResult.violations.length > 0 && (
                    <>
                      <button
                        className='score-panel__section-toggle score-panel__section-toggle--violation'
                        onClick={() => setViolationsOpen(o => !o)}
                        aria-expanded={violationsOpen}
                      >
                        <span className='score-panel__heading'>
                          Violations ({scoreResult.violations.length})
                        </span>
                        <span
                          className='score-panel__toggle-icon'
                          aria-hidden='true'
                        >
                          {violationsOpen ? '▾' : '▸'}
                        </span>
                      </button>
                      {violationsOpen && (
                        <ul className='score-panel__list'>
                          {scoreResult.violations.map((violation, index) => (
                            <li
                              key={`${violation.antipattern}-${index}`}
                              className='score-panel__item score-panel__item--violation'
                            >
                              <span
                                className='score-panel__marker'
                                aria-hidden='true'
                              >
                                ✗
                              </span>
                              <span className='score-panel__hint'>
                                {violation.message}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </Panel>
      </ReactFlow>
    </div>
  );
}

export default App;
