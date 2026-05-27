import type { PuzzleContext, Rubric } from '@arcantect/scorer';
import type { Node } from '@xyflow/react';

export interface Puzzle {
  title: string;
  prompt: string;
  rubric: Rubric;
  context: PuzzleContext;
  shortDescription?: string;
  /** Nodes pre-placed on the canvas when the puzzle starts. */
  initialNodes?: Node[];
}
