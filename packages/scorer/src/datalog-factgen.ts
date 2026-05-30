import type { Fact } from '@arcantect/datalog'
import type { ScorerNode, ScorerEdge } from './types.ts'

/**
 * Convert normalized scorer graph data into EDB facts for the Datalog interpreter.
 */
export function graphToFacts(
  nodes: ScorerNode[],
  edges: ScorerEdge[],
  tags: string[],
): Fact[] {
  const facts: Fact[] = []

  for (const node of nodes) {
    facts.push({ predicate: 'node', terms: [node.id, node.runeType] })

    for (const [key, value] of Object.entries(node.config)) {
      if (typeof value === 'string') {
        facts.push({ predicate: 'nodeConfig', terms: [node.id, key, value] })
      } else if (typeof value === 'boolean') {
        facts.push({ predicate: 'nodeConfig', terms: [node.id, key, String(value)] })
      }
    }

    for (const cap of node.capabilities) {
      facts.push({ predicate: 'capability', terms: [node.id, cap] })
    }
  }

  for (const edge of edges) {
    facts.push({ predicate: 'edge', terms: [edge.source, edge.target] })
    facts.push({ predicate: 'edgeById', terms: [edge.id, edge.source, edge.target] })

    if (edge.encrypted) {
      facts.push({ predicate: 'edgeMeta', terms: [edge.id, 'encrypted', 'true'] })
    }

    facts.push({ predicate: 'edgeMeta', terms: [edge.id, 'direction', edge.direction] })
    facts.push({ predicate: 'edgeMeta', terms: [edge.id, 'flowType', edge.flowType] })
  }

  for (const tag of tags) {
    facts.push({ predicate: 'puzzleTag', terms: [tag] })
  }

  return facts
}
