import type { Fact } from '@arcantect/datalog'
import type { ScorerNode, ScorerEdge } from './types.ts'

/**
 * Ground facts that classify rune types into zone categories.
 * Puzzle rules can reference these predicates instead of hard-coding rune type strings.
 */
export const ZONE_SEED_RULES: string = `
publicZoneType("cdn"). publicZoneType("load_balancer"). publicZoneType("api_gateway").
publicZoneType("waf"). publicZoneType("dns"). publicZoneType("internet").
publicZoneType("certificate"). publicZoneType("payment_processor").
publicZoneType("firewall"). publicZoneType("vpn"). publicZoneType("application").
privateZoneType("cache"). privateZoneType("queue"). privateZoneType("private_network").
privateZoneType("event_bus"). privateZoneType("streaming"). privateZoneType("monitoring").
privateZoneType("log_aggregator"). privateZoneType("tracing"). privateZoneType("metrics"). privateZoneType("alerting").
dataZoneType("database"). dataZoneType("object_storage"). dataZoneType("nosql_database").
dataZoneType("secrets_manager"). dataZoneType("search"). dataZoneType("static_assets").
softDmzType("compute"). softDmzType("serverless"). softDmzType("container"). softDmzType("kubernetes").
softDmzType("auth"). softDmzType("orchestrator"). softDmzType("identity_provider").
softDmzType("foundation_model"). softDmzType("ml_platform").
`

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

    if (node.zone !== undefined) {
      facts.push({ predicate: 'zone', terms: [node.id, node.zone] })
    }

    for (const [key, value] of Object.entries(node.config)) {
      if (typeof value === 'string') {
        facts.push({ predicate: 'nodeConfig', terms: [node.id, key, value] })
      } else if (typeof value === 'boolean') {
        facts.push({ predicate: 'nodeConfig', terms: [node.id, key, String(value)] })
      }
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

    if (edge.crossesZone) {
      facts.push({ predicate: 'edgeMeta', terms: [edge.id, 'crossesZone', 'true'] })
    }
  }

  for (const tag of tags) {
    facts.push({ predicate: 'puzzleTag', terms: [tag] })
  }

  return facts
}
