import type { PuzzleJson } from '@arcantect/scorer';

const spaPuzzle: PuzzleJson = {
  id: 'spa',
  title: 'An Enchanted Signboard for the Village Theater',
  shortDescription: 'Model a CDN-fronted object-storage-hosted SPA.',
  prompt:
    "Festival week approaches, and the village theater needs an enchanted signboard to announce its performances. Visitors will come from castles, cottages, ships, and distant roads, so the signboard must be easy to find by a name they can remember. It is made only of painted notices and tiny charms that awaken in each visitor's looking glass, and those notices change rarely. But festival crowds are large. Thousands may read the same notices at once, and the theater does not want every visitor fetching them from the storehouse of originals. Build a signboard whose trusted copies can be found quickly across the kingdoms.",
  context: { tags: ['easy'] },
  initialNodes: [
    {
      id: 'preplaced-internet',
      nodeType: 'internet',
      position: { x: -320, y: 160 },
      deletable: false,
    },
    {
      id: 'preplaced-static-assets',
      nodeType: 'static_assets',
      position: { x: -320, y: -20 },
      deletable: false,
    },
  ],
  rubric: {
    hardConstraints: [
      {
        id: 'starts-from-internet',
        label:
          'Visitors should find the signboard by a name they can remember.',
        hint: 'Connect the Internet node to a DNS node.',
      },
      {
        id: 'static-files-distributed',
        label: 'Something needs to distribute the scrolls.',
        hint: 'Connect a path from Internet to Static Assets that passes through a static-origin node, such as Object Storage.',
      },
    ],
    capabilityGoals: [
      {
        id: 'edge-delivery-present',
        label:
          'Festival crowds should read nearby copies, not crowd the storehouse.',
        hint: 'Add a node with edge-delivery capability (e.g., a CDN) reachable from the internet.',
      },
      {
        id: 'storage-at-origin',
        label:
          "The scrolls must rest in a proper storehouse, not a living servant's hands.",
        hint: 'Use Object Storage (not a compute node) as the origin — compute has both static-origin and compute-layer capabilities.',
      },
      {
        id: 'dns-routes-to-delivery',
        label:
          'The remembered name should lead visitors to the fastest entrance.',
        hint: 'DNS must reach a node with edge-delivery capability (e.g., a CDN).',
      },
    ],
    tradeoffWeights: {
      latency: 2,
      cost: 1,
      operability: 1,
      security: 1,
    },
    tradeoffThreshold: 6,
    datalogRules: `
      reaches(X, Y) :- edge(X, Y).
      reaches(X, Z) :- edge(X, Y), reaches(Y, Z).

      // Helper facts for hard constraints
      hasInternetToDns("yes") :- node(I, "internet"), node(R, "dns"), edge(I, R).
      hasInternetToStaticFilesThroughOrigin("yes") :-
        node(I, "internet"),
        node(F, "static_assets"),
        node(O, _),
        capability(O, "static-origin"),
        reaches(I, O),
        reaches(O, F).

      // Hard constraints
      req("starts-from-internet", "pass") :- hasInternetToDns("yes").
      req("starts-from-internet", "fail") :- !hasInternetToDns("yes").

      req("static-files-distributed", "pass") :- hasInternetToStaticFilesThroughOrigin("yes").
      req("static-files-distributed", "fail") :- !hasInternetToStaticFilesThroughOrigin("yes").

      // Capability goals — evaluated via capgoal(id, outcome) predicate
      edgeDeliveryReachable("yes") :-
        node(I, "internet"), node(C, _), capability(C, "edge-delivery"), reaches(I, C).

      capgoal("edge-delivery-present", "pass") :- edgeDeliveryReachable("yes").
      capgoal("edge-delivery-present", "fail") :- !edgeDeliveryReachable("yes").

      // Passes only when a static-origin node exists that is NOT also a compute-layer.
      // This blocks raw compute (Server) from satisfying this goal.
      hasStaticOriginNotCompute("yes") :-
        node(S, T),
        capability(S, "static-origin"),
        !capability(S, "compute-layer"),
        T != "static_assets".

      capgoal("storage-at-origin", "pass") :- hasStaticOriginNotCompute("yes").
      capgoal("storage-at-origin", "fail") :- !hasStaticOriginNotCompute("yes").

      dnsToEdgeDelivery("yes") :-
        node(R, "dns"), node(C, _), capability(C, "edge-delivery"), reaches(R, C).

      capgoal("dns-routes-to-delivery", "pass") :- dnsToEdgeDelivery("yes").
      capgoal("dns-routes-to-delivery", "fail") :- !dnsToEdgeDelivery("yes").

      violation("unencrypted-cross-zone", E) :-
        edgeMeta(E, "crossesZone", "true"),
        !edgeMeta(E, "encrypted", "true").
    `,
    optimization: { maxNodes: 6, maxEdges: 6 },
  },
};

export default spaPuzzle;
