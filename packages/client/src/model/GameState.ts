import type {
  Connection,
  Edge,
  Node,
  OnEdgesChange,
  OnNodesChange,
  XYPosition,
} from '@xyflow/react';
import type { ScoreResult } from '@arcantect/scorer';
import type { Puzzle } from './Puzzle';

type DirectedEdgeData = {
  direction: 'directed';
};

type ApplyEdgeData = {
  direction: 'applies';
};

type HostsEdgeData = {
  direction: 'hosts';
};

export type DirectedEdge = Edge<DirectedEdgeData>;
export type ApplyEdge = Edge<ApplyEdgeData>;
export type HostsEdge = Edge<HostsEdgeData>;
export type ArcEdge = DirectedEdge | ApplyEdge | HostsEdge;

export type View = 'home' | 'playing' | 'results';

interface NavigationState {
  view: View;
  goHome: () => void;
  startPuzzle: (puzzle: Puzzle) => void;
  retryPuzzle: () => void;
  submitPuzzle: () => void;
}

interface PuzzleState {
  puzzle?: Puzzle | undefined;
  loadPuzzle: (puzzle: Puzzle) => void;
}

interface GraphState {
  nodes: Node[];
  edges: ArcEdge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  addNode: (type: string, position: XYPosition) => void;
}

interface ScoringState {
  scoreResult?: ScoreResult | undefined;
  /** Scores the current graph against the active puzzle rubric. No-op if no puzzle is loaded. */
  score: () => void;
}

export type GameState = NavigationState &
  PuzzleState &
  GraphState &
  ScoringState;
