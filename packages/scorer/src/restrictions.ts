import type { Restriction, AnnotatedGraph, Violation } from './types.ts';
import {
  DATA_TYPES,
  INGRESS_TYPES,
  AUTH_TYPES,
  DATABASE_TYPES,
  QUEUE_TYPES,
} from './normalize.ts';
import { canReach, hasDirectEdge } from './graph.ts';

type Detector = Restriction['detect'];

// ---------------------------------------------------------------------------
// no-auth-before-data
// ---------------------------------------------------------------------------

const noAuthBeforeDataDetect: Detector = graph => {
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

  const reachableWithoutAuth = canReach(
    ingressIds,
    dataIds,
    graph.edges,
    authIds,
  );

  if (!reachableWithoutAuth) return [];

  return [
    {
      restriction: 'no-auth-before-data',
      message:
        'A path exists from your ingress to a data store without passing through an authentication layer.',
    },
  ];
};

// ---------------------------------------------------------------------------
// single-az-database
// ---------------------------------------------------------------------------

const singleAzDatabaseDetect: Detector = graph => {
  const dbNodes = graph.nodes.filter(n => DATABASE_TYPES.has(n.runeType));
  if (dbNodes.length === 0) return [];

  const violations: Violation[] = [];

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
        restriction: 'single-az-database',
        message: `${node.label || node.runeType} has no replica or Multi-AZ config — a single instance is a reliability risk.`,
        nodeIds: group.map(n => n.id),
      });
    }
  }

  return violations;
};

// ---------------------------------------------------------------------------
// synchronous-everything
// ---------------------------------------------------------------------------

const synchronousEverythingDetect: Detector = graph => {
  if (!graph.puzzle.tags.includes('high-throughput')) return [];
  const hasQueue = graph.nodes.some(n => QUEUE_TYPES.has(n.runeType));
  if (hasQueue) return [];
  return [
    {
      restriction: 'synchronous-everything',
      message:
        'High-throughput workloads need async decoupling — add a message queue to avoid synchronous bottlenecks.',
    },
  ];
};

// ---------------------------------------------------------------------------
// cdn-to-database
// ---------------------------------------------------------------------------

const cdnToDatabaseDetect: Detector = graph => {
  const cdnIds = new Set(
    graph.nodes.filter(n => n.runeType === 'cdn').map(n => n.id),
  );
  const dbIds = new Set(
    graph.nodes.filter(n => DATABASE_TYPES.has(n.runeType)).map(n => n.id),
  );

  if (!hasDirectEdge(cdnIds, dbIds, graph.edges)) return [];

  return [
    {
      restriction: 'cdn-to-database',
      message:
        'CDN is directly connected to a data store — CDNs should route to origin servers, not databases.',
    },
  ];
};

// ---------------------------------------------------------------------------
// Built-in restrictions — opt-in per puzzle rubric.
// ---------------------------------------------------------------------------

export const restrictions = {
  noAuthBeforeData: {
    id: 'no-auth-before-data',
    label: 'All paths to data stores must pass through authentication.',
    hint: 'Add an Auth Service between your ingress and any database.',
    detect: noAuthBeforeDataDetect,
  },
  singleAzDatabase: {
    id: 'single-az-database',
    label: 'Databases must be replicated or configured for multi-AZ.',
    hint: 'Add a replica database node or enable multiAz in the database config.',
    detect: singleAzDatabaseDetect,
  },
  synchronousEverything: {
    id: 'synchronous-everything',
    label: 'High-throughput systems must use asynchronous decoupling.',
    hint: 'Add a message queue to handle traffic spikes without blocking synchronous calls.',
    detect: synchronousEverythingDetect,
  },
  cdnToDatabase: {
    id: 'cdn-to-database',
    label: 'CDNs must not connect directly to databases.',
    hint: 'Route CDN traffic to an origin server — never directly to a data store.',
    detect: cdnToDatabaseDetect,
  },
} satisfies Record<string, Restriction>;

export const RESTRICTION_DETECTORS: readonly Restriction[] = [
  restrictions.noAuthBeforeData,
  restrictions.singleAzDatabase,
  restrictions.synchronousEverything,
  restrictions.cdnToDatabase,
];

export function detectRestrictions(
  graph: AnnotatedGraph,
  selectedRestrictions: readonly Restriction[] = RESTRICTION_DETECTORS,
): Violation[] {
  return selectedRestrictions.flatMap(r => r.detect(graph));
}
