
import type { AnnotatedGraph } from './types.ts'
import { canReach, hasDirectEdge } from './graph.ts'

/** True when the graph contains at least one node with the given runeType. */
export function hasNodeOfType(graph: AnnotatedGraph, runeType: string): boolean {
  return graph.nodes.some(n => n.runeType === runeType)
}

/** Count nodes with the given runeType. */
export function countNodesOfType(graph: AnnotatedGraph, runeType: string): number {
  return graph.nodes.filter(n => n.runeType === runeType).length
}

/**
 * True when there is at least one direct edge from a node of sourceType
 * to a node of targetType. Edges are directed, so reversing the connection
 * does not satisfy this helper.
 */
export function hasEdgeBetweenTypes(
  graph: AnnotatedGraph,
  sourceType: string,
  targetType: string,
): boolean {
  const sourceIds = new Set(graph.nodes.filter(n => n.runeType === sourceType).map(n => n.id))
  const targetIds = new Set(graph.nodes.filter(n => n.runeType === targetType).map(n => n.id))
  return hasDirectEdge(sourceIds, targetIds, graph.edges)
}

/**
 * True when any node of sourceType can reach any node of targetType via
 * directed edges (direct or multi-hop).
 * Pass `skipTypes` to block traversal through those rune types — useful for
 * checking reachability that avoids an intermediary (e.g. "can internet reach
 * storage without going through cdn?").
 */
export function hasDirectPath(
  graph: AnnotatedGraph,
  sourceType: string,
  targetType: string,
  skipTypes?: ReadonlySet<string>,
): boolean {
  const sourceIds = new Set(graph.nodes.filter(n => n.runeType === sourceType).map(n => n.id))
  const targetIds = new Set(graph.nodes.filter(n => n.runeType === targetType).map(n => n.id))

  let skipIds: ReadonlySet<string> | undefined
  if (skipTypes && skipTypes.size > 0) {
    skipIds = new Set(graph.nodes.filter(n => skipTypes.has(n.runeType)).map(n => n.id))
  }

  const flowEdges = graph.edges.filter(e => e.direction === 'directed')
  return canReach(sourceIds, targetIds, flowEdges, skipIds)
}

/**
 * True when the puzzle carries the given tag.
 */
export function puzzleHasTag(graph: AnnotatedGraph, tag: string): boolean {
  return graph.puzzle.tags.includes(tag)
}
