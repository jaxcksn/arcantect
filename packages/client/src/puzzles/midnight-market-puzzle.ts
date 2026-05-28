import type { PuzzleJson } from '@arcantect/scorer';

const midnightMarketPuzzle: PuzzleJson = {
  id: 'midnight-market',
  title: 'The Great Midnight Market',
  shortDescription: 'Model e-commerce order processing under high load.',
  prompt:
    "Before the black moon crests the Obsidian Tower, the House of Silks and Sundries must be ready. Fifty thousand shoppers will descend at the stroke of midnight — clawing through racks of cloaks, dragonhide jackets, enchanted scarves, and silver rings — and every one of them expects the shelves to answer instantly.,,Two rivers of demand will run at once: the great browsing flood, as thousands scan the wares, and the sharper rush of purchase, where a shopper slaps down coin-seals for the last jacket. These rivers must not drown each other. Even when every scribe in the counting house is buried beneath a mountain of purchase scrolls, the shelves should still answer browsers. And those purchase scrolls must never be lost — not if a scribe faints, not if a raven falls, not if the candles blow out.,,Every dragonhide jacket is a singular treasure. If only three remain, exactly three buyers may claim them — not four, not five. The counting house must reckon each claim in ink that cannot be erased or written twice, and the ledger must endure. Should one ledger catch fire, another must be standing by.,,The coin-seals of the realm are jealously guarded secrets. The guild of Royal Treasury forbids ordinary shop servants from touching payment magic. The spells that speak to the Royal Mint must be kept behind separate wards, in a vault no common hand may open, and only the appointed payment scribe may hold the keys.,,What enchantment would you weave to raise the Midnight Market so it may survive both the flood of curious eyes and the fever of midnight spending?",
  context: { tags: ['hard', 'high-throughput'] },
  initialNodes: [
    {
      id: 'preplaced-internet',
      nodeType: 'internet',
      position: { x: -420, y: 160 },
      deletable: false,
    },
    {
      id: 'preplaced-payment-processor',
      nodeType: 'payment_processor',
      position: { x: 640, y: 380 },
      deletable: false,
    },
    {
      id: 'preplaced-catalog-service',
      nodeType: 'application',
      label: 'Catalog Service',
      position: { x: -120, y: -140 },
      deletable: false,
    },
    {
      id: 'preplaced-order-service',
      nodeType: 'application',
      label: 'Order Service',
      position: { x: 160, y: -140 },
      deletable: false,
    },
    {
      id: 'preplaced-payment-service',
      nodeType: 'application',
      label: 'Payment Service',
      position: { x: 440, y: -140 },
      deletable: false,
    },
  ],
  rubric: {
    requirements: [
      {
        id: 'api-gateway-public',
        label: 'The shopfront must have a public gate that all may enter.',
        hint: 'Add an API Gateway and route internet traffic to it, optionally through DNS first.',
      },
      {
        id: 'waf-guards-gateway',
        label: 'A protective ward must filter the mob before it reaches the gate.',
        hint: 'Apply a WAF to the API Gateway to filter malicious traffic at the boundary.',
      },
      {
        id: 'lb-distributes-load',
        label: 'The midnight mob must be spread across many workers, lest any one scribe collapse.',
        hint: 'Place a Load Balancer between the API Gateway and your compute workers.',
      },
      {
        id: 'catalog-on-compute',
        label: 'The Catalog Service cannot cast its spell in mid-air — it must be bound to a servant.',
        hint: 'Connect the Catalog Service to a Server or Serverless Function.',
      },
      {
        id: 'order-intake-on-compute',
        label: 'The Order Service must run on its own computing servant.',
        hint: 'Connect the Order Service to a Server or Serverless Function.',
      },
      {
        id: 'cache-shields-catalog',
        label: 'Fifty thousand browsers should not each demand a fresh reading from the great ledger.',
        hint: "Connect the Catalog Service's compute to a Cache so product reads are served from memory.",
      },
      {
        id: 'auth-guards-api',
        label: 'Only verified shoppers should touch their baskets and place orders.',
        hint: 'Add an Auth Service to verify identity before requests reach protected resources.',
      },
      {
        id: 'orders-queued-for-durability',
        label: 'No purchase decree must be lost, even if every scribe in the counting house falls ill.',
        hint: 'Have the Order Service write incoming orders to a Queue, Event Bus, or Data Stream.',
      },
      {
        id: 'order-processor-consumes-queue',
        label: 'Every decree on the scroll must be picked up and fulfilled by a working scribe.',
        hint: 'Connect compute or serverless workers to consume orders from the Queue.',
      },
      {
        id: 'relational-db-for-inventory',
        label: 'If three dragonhide jackets remain, exactly three may be sold — never four.',
        hint: 'Use a Relational Database whose ACID transactions prevent inventory oversell.',
      },
      {
        id: 'database-replicated-for-ha',
        label: 'Should one great ledger catch fire, another must stand ready to take its place.',
        hint: 'Add a second Relational Database node to serve as a standby replica.',
      },
      {
        id: 'payment-service-isolated',
        label: 'The payment scribe must work behind separate wards, apart from the shopfront and counting house.',
        hint: 'Host the Payment Service on dedicated compute that does not also host the Catalog or Order Service.',
      },
      {
        id: 'payment-credentials-in-secrets',
        label: 'The keys to the Royal Mint must be kept in a sealed vault, never left in the open.',
        hint: 'Store payment credentials in a Secrets Manager and give only the Payment Service compute access to it.',
      },
      {
        id: 'payment-processor-reachable',
        label: 'The payment scribe must be able to reach the Royal Mint to collect the coin-seals.',
        hint: "Connect the Payment Service's compute to the external Payment Processor.",
      },
      {
        id: 'cdn-reduces-origin-load',
        label: 'Let distant copies of the wares reach browsing hands without taxing the central storehouse. (Bonus)',
        hint: 'Add a CDN reachable from the internet to serve cached copies of catalog content.',
        bonus: true,
      },
      {
        id: 'observability-present',
        label: 'The Guild must be able to watch the Market\'s health when the midnight rush arrives. (Bonus)',
        hint: 'Add Monitoring, Metrics, or Alerting to keep watch over the live system.',
        bonus: true,
      },
    ],
    datalogRules: `
      reaches(X, Y) :- edge(X, Y).
      reaches(X, Z) :- edge(X, Y), reaches(Y, Z).

      // ── Compute type helper ─────────────────────────────────────────────────
      // Any node that can execute application code — server, function, container, or cluster.
      isCompute(C) :- node(C, "compute").
      isCompute(C) :- node(C, "serverless").
      isCompute(C) :- node(C, "container").
      isCompute(C) :- node(C, "kubernetes").

      // ── Hosting helpers ─────────────────────────────────────────────────────
      // Which compute node each pre-placed service runs on.
      // container = single standalone container workload (like an ECS task)
      // kubernetes = a cluster platform that can host many services as separate pods;
      //              multiple application nodes may point to the same kubernetes node.
      catalogHostedOn(C) :- isCompute(C), edge("preplaced-catalog-service", C).
      orderHostedOn(C)   :- isCompute(C), edge("preplaced-order-service", C).
      paymentHostedOn(C) :- isCompute(C), edge("preplaced-payment-service", C).

      // ── Public ingress ──────────────────────────────────────────────────────
      hasInternetToApi("yes") :- node(I, "internet"), node(A, "api_gateway"), edge(I, A).
      hasInternetToApi("yes") :- node(I, "internet"), node(D, "dns"), node(A, "api_gateway"), edge(I, D), edge(D, A).

      hasWafOnApi("yes") :- node(W, "waf"), node(A, "api_gateway"), edgeById(E, W, A), edgeMeta(E, "direction", "applies").

      hasApiToLb("yes")     :- node(A, "api_gateway"),   node(L, "load_balancer"), edge(A, L).
      hasLbToCompute("yes") :- node(L, "load_balancer"), isCompute(C),             edge(L, C).
      hasLbPath("yes")      :- hasApiToLb("yes"), hasLbToCompute("yes").

      // ── Read path ───────────────────────────────────────────────────────────
      hasCacheForCatalog("yes") :- catalogHostedOn(Comp), node(K, "cache"), edge(Comp, K).

      // ── Auth ────────────────────────────────────────────────────────────────
      hasAuth("yes") :- node(_, "auth").

      // ── Order durability: intake → queue ────────────────────────────────────
      // Accepts Queue, Event Bus, or Data Stream.
      orderWritesToQueue("yes") :- orderHostedOn(C), node(Q, "queue"),     edge(C, Q).
      orderWritesToQueue("yes") :- orderHostedOn(C), node(Q, "event_bus"), edge(C, Q).
      orderWritesToQueue("yes") :- orderHostedOn(C), node(Q, "streaming"), edge(C, Q).

      // ── Order processor: queue → compute ────────────────────────────────────
      queueHasProcessor("yes") :- node(Q, "queue"),     isCompute(C), edge(Q, C).
      queueHasProcessor("yes") :- node(Q, "event_bus"), isCompute(C), edge(Q, C).
      queueHasProcessor("yes") :- node(Q, "streaming"), isCompute(C), edge(Q, C).

      // ── Data stores ─────────────────────────────────────────────────────────
      hasRelationalDb("yes") :- node(_, "database").
      hasTwoDatabases("yes") :- node(D1, "database"), node(D2, "database"), D1 != D2.

      // ── Payment isolation ───────────────────────────────────────────────────
      // Payment is isolated when its host node ID differs from every catalog and order host.
      // Two services on the same kubernetes cluster share a node ID → not isolated.
      paymentSharesCompute("yes") :- paymentHostedOn(C), catalogHostedOn(C).
      paymentSharesCompute("yes") :- paymentHostedOn(C), orderHostedOn(C).
      paymentIsolated("yes")      :- paymentHostedOn(_), !paymentSharesCompute("yes").

      paymentToSecrets("yes")   :- paymentHostedOn(C), node(S, "secrets_manager"), edge(C, S).
      paymentToProcessor("yes") :- paymentHostedOn(C), node(P, "payment_processor"), edge(C, P).

      // ── Bonus ───────────────────────────────────────────────────────────────
      // CDN must be reachable from internet AND have at least one downstream origin it serves.
      hasCdn("yes") :- node(I, "internet"), node(C, "cdn"), reaches(I, C), edge(C, O).

      // Observability must be wired to at least one compute node.
      // Accepts both pull/applies (monitoring → compute) and push (compute → monitoring).
      hasObservability("yes") :- node(M, "monitoring"), isCompute(C), edge(M, C).
      hasObservability("yes") :- node(M, "monitoring"), isCompute(C), edge(C, M).
      hasObservability("yes") :- node(M, "alerting"),   isCompute(C), edge(M, C).
      hasObservability("yes") :- node(M, "alerting"),   isCompute(C), edge(C, M).
      hasObservability("yes") :- node(M, "metrics"),    isCompute(C), edge(M, C).
      hasObservability("yes") :- node(M, "metrics"),    isCompute(C), edge(C, M).

      // ── Requirements ────────────────────────────────────────────────────────
      req("api-gateway-public",           "pass") :- hasInternetToApi("yes").
      req("api-gateway-public",           "fail") :- !hasInternetToApi("yes").

      req("waf-guards-gateway",           "pass") :- hasWafOnApi("yes").
      req("waf-guards-gateway",           "fail") :- !hasWafOnApi("yes").

      req("lb-distributes-load",          "pass") :- hasLbPath("yes").
      req("lb-distributes-load",          "fail") :- !hasLbPath("yes").

      req("catalog-on-compute",           "pass") :- catalogHostedOn(_).
      req("catalog-on-compute",           "fail") :- !catalogHostedOn(_).

      req("order-intake-on-compute",      "pass") :- orderHostedOn(_).
      req("order-intake-on-compute",      "fail") :- !orderHostedOn(_).

      req("cache-shields-catalog",        "pass") :- hasCacheForCatalog("yes").
      req("cache-shields-catalog",        "fail") :- !hasCacheForCatalog("yes").

      req("auth-guards-api",              "pass") :- hasAuth("yes").
      req("auth-guards-api",              "fail") :- !hasAuth("yes").

      req("orders-queued-for-durability", "pass") :- orderWritesToQueue("yes").
      req("orders-queued-for-durability", "fail") :- !orderWritesToQueue("yes").

      req("order-processor-consumes-queue", "pass") :- queueHasProcessor("yes").
      req("order-processor-consumes-queue", "fail") :- !queueHasProcessor("yes").

      req("relational-db-for-inventory",  "pass") :- hasRelationalDb("yes").
      req("relational-db-for-inventory",  "fail") :- !hasRelationalDb("yes").

      req("database-replicated-for-ha",   "pass") :- hasTwoDatabases("yes").
      req("database-replicated-for-ha",   "fail") :- !hasTwoDatabases("yes").

      req("payment-service-isolated",     "pass") :- paymentIsolated("yes").
      req("payment-service-isolated",     "fail") :- !paymentIsolated("yes").

      req("payment-credentials-in-secrets", "pass") :- paymentToSecrets("yes").
      req("payment-credentials-in-secrets", "fail") :- !paymentToSecrets("yes").

      req("payment-processor-reachable",  "pass") :- paymentToProcessor("yes").
      req("payment-processor-reachable",  "fail") :- !paymentToProcessor("yes").

      req("cdn-reduces-origin-load",      "pass") :- hasCdn("yes").
      req("cdn-reduces-origin-load",      "fail") :- !hasCdn("yes").

      req("observability-present",        "pass") :- hasObservability("yes").
      req("observability-present",        "fail") :- !hasObservability("yes").

      // ── Violations ──────────────────────────────────────────────────────────
      violation("db-public-exposure",     N) :- node(N, "database"),  zone(N, "public").
      violation("payment-service-public", N) :- paymentHostedOn(N),   zone(N, "public").
      violation("queue-public-exposure",  N) :- node(N, "queue"),     zone(N, "public").
      violation("queue-public-exposure",  N) :- node(N, "event_bus"), zone(N, "public").
      violation("queue-public-exposure",  N) :- node(N, "streaming"), zone(N, "public").
    `,
    optimization: { maxNodes: 18, maxEdges: 16 },
  },
};

export default midnightMarketPuzzle;
