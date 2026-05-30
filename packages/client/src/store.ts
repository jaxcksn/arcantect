import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
  type Edge,
  type Node,
} from '@xyflow/react';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { scoreGraph } from '@arcantect/scorer';
import type { RawNode } from '@arcantect/scorer';
import type { ArcEdge, ApplyEdge, DirectedEdge, HostsEdge, GameState } from '@model/GameState';
import type { Puzzle } from '@model/Puzzle';
import { NODE_REGISTRY } from '@nodes/registry';
import { PUZZLES } from '@puzzles';

export const directedEdgeDefaults = {
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#3d2008',
    width: 18,
    height: 18,
  },
  data: {
    direction: 'directed' as const,
  },
} satisfies Pick<DirectedEdge, 'markerEnd' | 'data'>;

export const applyEdgeDefaults = {
  type: 'apply',
  data: {
    direction: 'applies' as const,
  },
} satisfies Pick<ApplyEdge, 'type' | 'data'>;

export const hostsEdgeDefaults = {
  type: 'hosts',
  data: {
    direction: 'hosts' as const,
  },
} satisfies Pick<HostsEdge, 'type' | 'data'>;

function ensureEdgeDefaults(edge: Edge): ArcEdge {
  if (edge.data?.direction === 'applies') {
    return {
      ...edge,
      type: 'apply',
      data: { direction: 'applies' },
    } as ApplyEdge;
  }
  if (edge.data?.direction === 'hosts') {
    return {
      ...edge,
      type: 'hosts',
      data: { direction: 'hosts' },
    } as HostsEdge;
  }
  return {
    ...directedEdgeDefaults,
    ...edge,
    markerEnd: edge.markerEnd ?? directedEdgeDefaults.markerEnd,
    data: { direction: 'directed' },
  } as DirectedEdge;
}

function withNodeData(nodes: Node[]): RawNode[] {
  return nodes.map(n => ({
    ...n,
    capabilities: NODE_REGISTRY[n.data.nodeType as string]?.capabilities ?? [],
    tradeoffs: NODE_REGISTRY[n.data.nodeType as string]?.tradeoffs,
  }));
}

function scorePuzzle(puzzle: Puzzle, nodes: Node[], edges: ArcEdge[]) {
  return scoreGraph(withNodeData(nodes), edges, puzzle.rubric, puzzle.context);
}

const STORAGE_KEY = 'arcantect.session.v1';

type SavedSession = {
  view: GameState['view'];
  puzzleTitle?: string | undefined;
  nodes: Node[];
  edges: ArcEdge[];
};

function isSavedSession(value: unknown): value is SavedSession {
  if (!value || typeof value !== 'object') return false;

  const session = value as Partial<SavedSession>;
  const hasValidView =
    session.view === 'home' ||
    session.view === 'playing' ||
    session.view === 'results';

  return (
    hasValidView &&
    Array.isArray(session.nodes) &&
    Array.isArray(session.edges) &&
    (session.puzzleTitle === undefined ||
      typeof session.puzzleTitle === 'string')
  );
}

function loadSavedSession() {
  if (typeof localStorage === 'undefined') return {};

  try {
    const rawSession = localStorage.getItem(STORAGE_KEY);
    if (!rawSession) return {};

    const saved: unknown = JSON.parse(rawSession);
    if (!isSavedSession(saved) || !saved.puzzleTitle) return {};

    const puzzle = PUZZLES.find(p => p.title === saved.puzzleTitle);
    if (!puzzle) return {};

    const nodes = saved.nodes;
    const edges = saved.edges.map(ensureEdgeDefaults);

    return {
      view: saved.view === 'home' ? 'home' : saved.view,
      puzzle,
      nodes,
      edges,
      scoreResult: scorePuzzle(puzzle, nodes, edges),
    } satisfies Partial<GameState>;
  } catch {
    return {};
  }
}

function saveSession(state: GameState) {
  if (typeof localStorage === 'undefined') return;

  try {
    if (!state.puzzle) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const session: SavedSession = {
      view: state.view,
      puzzleTitle: state.puzzle.title,
      nodes: state.nodes,
      edges: state.edges,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Persistence is best-effort; gameplay should continue if storage is full or blocked.
  }
}

const savedSession = loadSavedSession();

export const useGameStore = create<GameState>()(
  immer((set, get) => ({
    view: savedSession.view ?? 'home',
    puzzle: savedSession.puzzle,
    scoreResult: savedSession.scoreResult,
    nodes: savedSession.nodes ?? [],
    edges: savedSession.edges ?? [],

    goHome() {
      set(state => {
        state.view = 'home';
        state.puzzle = undefined;
        state.scoreResult = undefined;
        state.nodes = [];
        state.edges = [];
      });
    },

    startPuzzle(puzzle: Puzzle) {
      set(state => {
        state.view = 'playing';
        state.puzzle = puzzle;
        state.nodes = puzzle.initialNodes ? [...puzzle.initialNodes] : [];
        state.edges = [];
        state.scoreResult = scorePuzzle(puzzle, state.nodes as Node[], []);
      });
    },

    retryPuzzle() {
      set(state => {
        state.view = 'playing';
        if (state.puzzle) {
          state.scoreResult = scorePuzzle(
            state.puzzle,
            state.nodes as Node[],
            state.edges,
          );
        }
      });
    },

    submitPuzzle() {
      set(state => {
        state.view = 'results';
      });
    },

    loadPuzzle(puzzle: Puzzle) {
      set(state => {
        state.puzzle = puzzle;
        state.scoreResult = scorePuzzle(
          puzzle,
          state.nodes as Node[],
          state.edges,
        );
      });
    },

    onNodesChange(changes) {
      set(state => {
        state.nodes = applyNodeChanges(changes, state.nodes);
        if (state.puzzle) {
          state.scoreResult = scorePuzzle(
            state.puzzle,
            state.nodes as Node[],
            state.edges,
          );
        }
      });
    },

    onEdgesChange(changes) {
      set(state => {
        state.edges = applyEdgeChanges(changes, state.edges).map(
          ensureEdgeDefaults,
        );
        if (state.puzzle) {
          state.scoreResult = scorePuzzle(
            state.puzzle,
            state.nodes as Node[],
            state.edges,
          );
        }
      });
    },

    onConnect(connection) {
      set(state => {
        const sourceNode = (state.nodes as Node[]).find(
          n => n.id === connection.source,
        );
        const nodeType = sourceNode?.data?.nodeType as string | undefined;
        const def = nodeType ? NODE_REGISTRY[nodeType] : undefined;
        const defaults =
          def?.defaultEdgeType === 'applies' ? applyEdgeDefaults :
          def?.defaultEdgeType === 'hosts'   ? hostsEdgeDefaults :
          directedEdgeDefaults;

        state.edges = addEdge(
          { ...connection, ...defaults },
          state.edges,
        ).map(ensureEdgeDefaults);
        if (state.puzzle) {
          state.scoreResult = scorePuzzle(
            state.puzzle,
            state.nodes as Node[],
            state.edges,
          );
        }
      });
    },

    addNode(type, position) {
      set(state => {
        state.nodes.push({
          id: crypto.randomUUID(),
          type: 'rune',
          position,
          data: { nodeType: type },
        });
        if (state.puzzle) {
          state.scoreResult = scorePuzzle(
            state.puzzle,
            state.nodes as Node[],
            state.edges,
          );
        }
      });
    },

    score() {
      const { puzzle, nodes, edges } = get();
      if (!puzzle) return;
      const result = scoreGraph(withNodeData(nodes), edges, puzzle.rubric, puzzle.context);
      set(state => {
        state.scoreResult = result;
      });
    },
  })),
);

useGameStore.subscribe(saveSession);
