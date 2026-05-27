import { compileRubric } from '@arcantect/scorer';
import type { PuzzleJson } from '@arcantect/scorer';
import type { Puzzle } from '@model/Puzzle';
import spaPuzzle from './spa-puzzle.ts';
import midnightMarketPuzzle from './midnight-market-puzzle.ts';

function compilePuzzle(json: PuzzleJson): Puzzle {
  return {
    title: json.title,
    prompt: json.prompt,
    rubric: compileRubric(json.rubric),
    context: json.context,
    shortDescription: json.shortDescription,
    initialNodes: json.initialNodes?.map(n => ({
      id: n.id,
      type: 'rune',
      position: n.position,
      data: { nodeType: n.nodeType },
      deletable: n.deletable,
    })),
  };
}

export const PUZZLES: Puzzle[] = [
  compilePuzzle(spaPuzzle),
  compilePuzzle(midnightMarketPuzzle),
];
