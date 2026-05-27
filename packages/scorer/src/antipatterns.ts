import type { AntiPattern, AnnotatedGraph, Violation } from './types.ts';
import {
  DATA_TYPES,
  INGRESS_TYPES,
  AUTH_TYPES,
  DATABASE_TYPES,
  QUEUE_TYPES,
} from './normalize.ts';
import { canReach, hasDirectEdge } from './graph.ts';

type Detector = AntiPattern['detect'];

// ---------------------------------------------------------------------------
// db-public-exposure
// A data-store node ended up in the public zone — directly reachable from
// the internet with no network boundary in front of it.
// ---------------------------------------------------------------------------

const dbPublicExposure: Detector = graph => {
  const exposed = graph.nodes.filter(
    n => DATA_TYPES.has(n.runeType) && n.zone === 'public',
  );
  return exposed.map(n => ({
    antipattern: 'db-public-exposure',
    message: `${n.label || n.runeType} is in the public zone — data stores must never be internet-accessible.`,
    nodeIds: [n.id],
  }));
};

// ---------------------------------------------------------------------------
// no-auth-before-data
// There exists a directed path from an ingress node to a data store that
// passes through no authentication node.  Detected by removing auth nodes
// from the graph and checking reachability from ingress to data.
// ---------------------------------------------------------------------------

const noAuthBeforeData: Detector = graph => {
  const ingressIds = new Set(
    graph.nodes.filter(n => INGRESS_TYPES.has(n.runeType)).map(n => n.id),
  );
  const dataIds = new Set(
    graph.nodes
      .filter(n => DATA_TYPES.has(n.runeType) && n.runeType !== 'object_storage')
      .map(n => n.id),
  );
  const authIds = new Set(
    graph.nodes.filter(n => AUTH_TYPES.has(n.runeType)).map(n => n.id),
  );

  if (ingressIds.size === 0 || dataIds.size === 0) return [];

  // BFS from ingress, skipping auth nodes — if a data node is reachable,
  // there is a path that bypasses authentication.
  const reachableWithoutAuth = canReach(
    ingressIds,
    dataIds,
    graph.edges,
    authIds,
  );

  if (!reachableWithoutAuth) return [];

  return [
    {
      antipattern: 'no-auth-before-data',
      message:
        'A path exists from your ingress to a data store without passing through an authentication layer.',
    },
  ];
};

// ---------------------------------------------------------------------------
// single-az-database
// A database-type node has neither a same-type sibling (replica) nor
// multiAz: true in its config.  Flagged once per isolated database type.
// ---------------------------------------------------------------------------

const singleAzDatabase: Detector = graph => {
  const dbNodes = graph.nodes.filter(n => DATABASE_TYPES.has(n.runeType));
  if (dbNodes.length === 0) return [];

  const violations: Violation[] = [];

  // Group by runeType — two database nodes are considered replicas of each other.
  const byType = new Map<string, typeof dbNodes>();
  for (const n of dbNodes) {
    const group = byType.get(n.runeType) ?? [];
    group.push(n);
    byType.set(n.runeType, group);
  }

  for (const [, group] of byType) {
    const hasReplica = group.length > 1;
    const hasMultiAz = group.some(n => n.config['multiAz'] === true);

    if (!hasReplica && !hasMultiAz) {
      const node = group[0]!;
      violations.push({
        antipattern: 'single-az-database',
        message: `${node.label || node.runeType} has no replica or Multi-AZ config — a single instance is a reliability risk.`,
        nodeIds: group.map(n => n.id),
      });
    }
  }

  return violations;
};

// ---------------------------------------------------------------------------
// unencrypted-cross-zone
// An edge that crosses zone boundaries carries unencrypted traffic.
// ---------------------------------------------------------------------------

const unencryptedCrossZone: Detector = graph => {
  const bad = graph.edges.filter(e => e.crossesZone && !e.encrypted);
  return bad.map(e => ({
    antipattern: 'unencrypted-cross-zone',
    message: 'An edge crosses a security zone boundary without encryption.',
    edgeIds: [e.id],
  }));
};

// ---------------------------------------------------------------------------
// synchronous-everything
// The puzzle is tagged `high-throughput` but contains no message queue —
// every call must be synchronous, creating a bottleneck.
// ---------------------------------------------------------------------------

const synchronousEverything: Detector = graph => {
  if (!graph.puzzle.tags.includes('high-throughput')) return [];
  const hasQueue = graph.nodes.some(n => QUEUE_TYPES.has(n.runeType));
  if (hasQueue) return [];
  return [
    {
      antipattern: 'synchronous-everything',
      message:
        'High-throughput workloads need async decoupling — add a message queue to avoid synchronous bottlenecks.',
    },
  ];
};

// ---------------------------------------------------------------------------
// cdn-to-database
// A CDN node has a direct edge to a database node.  CDNs should only talk
// to origin servers, never directly to data stores.
// ---------------------------------------------------------------------------

const cdnToDatabase: Detector = graph => {
  const cdnIds = new Set(
    graph.nodes.filter(n => n.runeType === 'cdn').map(n => n.id),
  );
  const dbIds = new Set(
    graph.nodes.filter(n => DATABASE_TYPES.has(n.runeType)).map(n => n.id),
  );

  if (!hasDirectEdge(cdnIds, dbIds, graph.edges)) return [];

  return [
    {
      antipattern: 'cdn-to-database',
      message:
        'CDN is directly connected to a data store — CDNs should route to origin servers, not databases.',
    },
  ];
};

// ---------------------------------------------------------------------------
// Reusable checks. Puzzles opt into these from their rubric instead of the
// scorer applying every anti-pattern globally.
// ---------------------------------------------------------------------------

export const antiPatterns = {
  dbPublicExposure: {
    id: 'db-public-exposure',
    detect: dbPublicExposure,
  },
  noAuthBeforeData: {
    id: 'no-auth-before-data',
    detect: noAuthBeforeData,
  },
  singleAzDatabase: {
    id: 'single-az-database',
    detect: singleAzDatabase,
  },
  unencryptedCrossZone: {
    id: 'unencrypted-cross-zone',
    detect: unencryptedCrossZone,
  },
  synchronousEverything: {
    id: 'synchronous-everything',
    detect: synchronousEverything,
  },
  cdnToDatabase: {
    id: 'cdn-to-database',
    detect: cdnToDatabase,
  },
} satisfies Record<string, AntiPattern>;

export const ANTI_PATTERN_DETECTORS: readonly AntiPattern[] = [
  antiPatterns.dbPublicExposure,
  antiPatterns.noAuthBeforeData,
  antiPatterns.singleAzDatabase,
  antiPatterns.unencryptedCrossZone,
  antiPatterns.synchronousEverything,
  antiPatterns.cdnToDatabase,
];

export function detectAntiPatterns(
  graph: AnnotatedGraph,
  selectedAntiPatterns: readonly AntiPattern[] = ANTI_PATTERN_DETECTORS,
): Violation[] {
  return selectedAntiPatterns.flatMap(antiPattern => antiPattern.detect(graph));
}
