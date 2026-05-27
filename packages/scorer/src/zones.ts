import type { Zone, ScorerNode, ScorerEdge } from './types.ts'
import { PUBLIC_TYPES, DMZ_TYPES, PRIVATE_TYPES, DATA_TYPES } from './normalize.ts'

// ---------------------------------------------------------------------------
// Zone ordering — higher index = more restrictive / inner
// ---------------------------------------------------------------------------

const ZONE_ORDER: Zone[] = ['public', 'dmz', 'private', 'data']

function zoneIndex(z: Zone): number {
  return ZONE_ORDER.indexOf(z)
}

function moreRestrictive(a: Zone, b: Zone): Zone {
  return zoneIndex(a) >= zoneIndex(b) ? a : b
}

function stepInward(z: Zone): Zone {
  const idx = zoneIndex(z)
  return ZONE_ORDER[Math.min(idx + 1, ZONE_ORDER.length - 1)]!
}

// ---------------------------------------------------------------------------
// Seed maps — which rune types get which zone as a starting assignment.
// Soft seeds (compute, serverless, auth) can be overridden by propagation from a
// more-restrictive upstream; hard seeds cannot.
// ---------------------------------------------------------------------------

const HARD_SEED_MAP: ReadonlyMap<string, Zone> = new Map([
  ['cdn', 'public'],
  ['load_balancer', 'public'],
  ['api_gateway', 'public'],
  ['waf', 'public'],
  ['dns', 'public'],
  ['internet', 'public'],
  ['certificate', 'public'],
  ['payment_processor', 'public'],
  ['cache', 'private'],
  ['queue', 'private'],
  ['private_network', 'private'],
  ['database', 'data'],
  ['object_storage', 'data'],
  ['nosql_database', 'data'],
  ['secrets_manager', 'data'],
])

const SOFT_SEED_MAP: ReadonlyMap<string, Zone> = new Map([
  ['compute', 'dmz'],
  ['serverless', 'dmz'],
  ['auth', 'dmz'],
])

// ---------------------------------------------------------------------------
// Public API: mutates node.zone in place
// ---------------------------------------------------------------------------

export function inferZones(nodes: ScorerNode[], edges: readonly ScorerEdge[]): void {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const hardSeeded = new Set<string>()
  const softSeeded = new Set<string>()

  // Phase 1 — seed from rune types
  for (const node of nodes) {
    const hardZone = HARD_SEED_MAP.get(node.runeType)
    if (hardZone !== undefined) {
      node.zone = hardZone
      hardSeeded.add(node.id)
      continue
    }
    const softZone = SOFT_SEED_MAP.get(node.runeType)
    if (softZone !== undefined) {
      node.zone = softZone
      softSeeded.add(node.id)
    }
  }

  // Phase 2 — BFS propagation, iterating until stable.
  // Hard-seeded nodes are immutable; soft-seeded nodes can be pushed inward.
  let changed = true
  while (changed) {
    changed = false
    for (const edge of edges) {
      const source = nodeMap.get(edge.source)
      const target = nodeMap.get(edge.target)
      if (!source?.zone || !target) continue
      if (hardSeeded.has(target.id)) continue

      const inferred = stepInward(source.zone)
      const current = target.zone

      if (current === undefined || zoneIndex(inferred) > zoneIndex(current)) {
        target.zone = moreRestrictive(inferred, current ?? inferred)
        changed = true
      }
    }
  }
}

// ---------------------------------------------------------------------------
// After zone inference: mark edges that cross zone boundaries
// ---------------------------------------------------------------------------

export function annotateEdgeCrossings(
  edges: ScorerEdge[],
  nodes: readonly ScorerNode[],
): void {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  for (const edge of edges) {
    const sourceZone = nodeMap.get(edge.source)?.zone
    const targetZone = nodeMap.get(edge.target)?.zone
    edge.crossesZone = sourceZone !== undefined && targetZone !== undefined && sourceZone !== targetZone
  }
}

// ---------------------------------------------------------------------------
// Utility: categorise a runeType into its expected zone
// (used by anti-pattern checks that don't rely on inferred zones)
// ---------------------------------------------------------------------------

export function expectedZone(runeType: string): Zone | undefined {
  if (PUBLIC_TYPES.has(runeType)) return 'public'
  if (DMZ_TYPES.has(runeType)) return 'dmz'
  if (PRIVATE_TYPES.has(runeType)) return 'private'
  if (DATA_TYPES.has(runeType)) return 'data'
  return undefined
}
