/**
 * Shared graph traversal utilities used by both zone inference and
 * anti-pattern detection.  All functions are pure and operate on
 * the minimal { source, target } edge shape so they work on both
 * ScorerEdge and any lightweight edge representation.
 */

export interface GraphEdge {
  source: string
  target: string
}

/**
 * BFS from startIds following directed edges.
 * Nodes in skipIds are never visited and block traversal past them.
 * Returns the set of all reachable node IDs (including start nodes).
 */
export function bfsReachable(
  startIds: Iterable<string>,
  edges: readonly GraphEdge[],
  skipIds?: ReadonlySet<string>,
): Set<string> {
  const visited = new Set<string>()
  const queue: string[] = []

  for (const id of startIds) {
    if (!skipIds?.has(id)) queue.push(id)
  }

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    for (const edge of edges) {
      if (edge.source === current && !visited.has(edge.target) && !skipIds?.has(edge.target)) {
        queue.push(edge.target)
      }
    }
  }

  return visited
}

/**
 * Returns true when any node in targetIds is reachable from any node
 * in startIds (optionally skipping a set of intermediate node IDs).
 */
export function canReach(
  startIds: Iterable<string>,
  targetIds: ReadonlySet<string>,
  edges: readonly GraphEdge[],
  skipIds?: ReadonlySet<string>,
): boolean {
  const reachable = bfsReachable(startIds, edges, skipIds)
  for (const id of targetIds) {
    if (reachable.has(id)) return true
  }
  return false
}

/**
 * Returns the direct outgoing neighbours of nodeId.
 */
export function directNeighbors(nodeId: string, edges: readonly GraphEdge[]): string[] {
  const result: string[] = []
  for (const edge of edges) {
    if (edge.source === nodeId) result.push(edge.target)
  }
  return result
}

/**
 * Builds a forward adjacency list keyed by source node ID.
 */
export function buildAdjList(edges: readonly GraphEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>()
  for (const edge of edges) {
    let neighbors = adj.get(edge.source)
    if (!neighbors) {
      neighbors = []
      adj.set(edge.source, neighbors)
    }
    neighbors.push(edge.target)
  }
  return adj
}

/**
 * Returns true when there is a direct edge from any source-type node
 * to any target-type node, identified by their IDs.
 */
export function hasDirectEdge(
  sourceIds: ReadonlySet<string>,
  targetIds: ReadonlySet<string>,
  edges: readonly GraphEdge[],
): boolean {
  for (const edge of edges) {
    if (sourceIds.has(edge.source) && targetIds.has(edge.target)) return true
  }
  return false
}
