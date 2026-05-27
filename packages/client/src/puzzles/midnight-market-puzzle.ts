import type { PuzzleJson } from '@arcantect/scorer';

const midnightMarketPuzzle: PuzzleJson = {
  id: 'midnight-market',
  title: 'The Great Midnight Market',
  shortDescription: 'Model e-commerce order processing under high load.',
  prompt:
    "The House of Silks and Sundries begs your aid before the great Midnight Market. When the black moon rises, fifty thousand shoppers may rush the shopfront at once, all clawing through racks of cloaks, boots, rings, and enchanted scarves. They must be able to browse the wares, place treasures into their baskets, and pay with royal coin-seals before the best goods vanish. But the merchant guild has strict demands. No purchase decree may ever be lost, even if the scribes in the counting house faint, the delivery ravens fall behind, or some lesser spell in the back room fails. No cloak, ring, or pair of boots may be sold to two villagers at once. If only three dragonhide jackets remain, then only three buyers may claim them. The shoppers' coin-seals are dangerous secrets, and the guild forbids us from letting ordinary shop goblins handle them carelessly. Their payment magic must be guarded according to the laws of the Royal Treasury. And above all, the shopfront itself must not collapse merely because the counting house is slow. Shoppers should still be able to browse, fill baskets, and place orders, even if the order scribes are buried under a mountain of scrolls. What spellwork would you weave so the Midnight Market survives the rush?",
  context: { tags: ['hard', 'high-throughput'] },
  initialNodes: [
    {
      id: 'preplaced-internet',
      nodeType: 'internet',
      position: { x: -320, y: 200 },
      deletable: false,
    },
    {
      id: 'preplaced-payment-processor',
      nodeType: 'payment_processor',
      position: { x: 560, y: 400 },
      deletable: false,
    },
  ],
  rubric: {
    requirements: [
      {
        id: 'waf-filters-traffic',
        label:
          'Fifty thousand shoppers may rush the shopfront at once, and the gate needs protection.',
        hint: 'Apply a WAF to the API Gateway so public requests are filtered there.',
      },
      {
        id: 'api-gateway-behind-waf',
        label:
          'Shoppers must be able to browse, fill baskets, and place orders through a public shopfront.',
        hint: 'Route shoppers to an API Gateway directly, or through DNS first.',
      },
      {
        id: 'load-balancer-in-path',
        label:
          'The shopfront must not collapse when the Midnight Market crowd arrives.',
        hint: 'A Load Balancer distributes requests across the application workers.',
      },
      {
        id: 'compute-serves-requests',
        label:
          'Something needs to handle browsing, baskets, and order requests for shoppers.',
        hint: 'Put compute or serverless workers behind the Load Balancer.',
      },
      {
        id: 'cache-for-reads',
        label:
          'The same racks of cloaks, boots, rings, and scarves will be browsed far more often than the purchase ledger is updated.',
        hint: 'Use a Cache for catalogue reads so browsing traffic does not hammer the database.',
      },
      {
        id: 'auth-layer-present',
        label:
          'Only real shoppers should be trusted to place treasures into baskets and pay.',
        hint: 'Add an Auth Service before requests touch protected data stores.',
      },
      {
        id: 'queue-decouples-orders',
        label:
          'No purchase decree may ever be lost, even if the counting house falls behind.',
        hint: 'Place orders on a Message Queue so order intake is durable and asynchronous.',
      },
      {
        id: 'order-processor-reads-queue',
        label:
          'The counting house still needs to process each purchase decree after it is accepted.',
        hint: 'Use compute or serverless workers to consume orders from the Message Queue.',
      },
      {
        id: 'database-with-replica',
        label: 'If we lose a ledger, another one shall be available!',
        hint: 'Use replicated databases by adding a second Database node.',
      },
      {
        id: 'payment-gateway-integrated',
        label:
          'Shoppers must be able to pay with royal coin-seals before the best goods vanish.',
        hint: 'The order processor should send payment work to the external Payment Processor.',
      },
      {
        id: 'payment-keys-in-secrets',
        label:
          "Shoppers' coin-seals are dangerous secrets and must be guarded under Royal Treasury rules.",
        hint: 'Store Payment Processor credentials in a Secrets Manager and let the order processor read them.',
      },
    ],
    datalogRules: `
      reaches(X, Y) :- edge(X, Y).
      reaches(X, Z) :- edge(X, Y), reaches(Y, Z).

      hasWafOnApi("yes")         :- node(W, "waf"),           node(A, "api_gateway"),   edgeById(E, W, A), edgeMeta(E, "direction", "applies").
      hasInternetToApi("yes")    :- node(I, "internet"),      node(A, "api_gateway"),   edge(I, A).
      hasInternetToApi("yes")    :- node(I, "internet"),      node(D, "dns"),           node(A, "api_gateway"), edge(I, D), edge(D, A).
      hasApiToLb("yes")          :- node(A, "api_gateway"),   node(L, "load_balancer"), edge(A, L).
      hasLbToCompute("yes")      :- node(L, "load_balancer"), node(C, "compute"),       edge(L, C).
      hasLbToCompute("yes")      :- node(L, "load_balancer"), node(C, "serverless"),    edge(L, C).
      hasComputeToCache("yes")   :- node(C, "compute"),       node(K, "cache"),         edge(C, K).
      hasComputeToCache("yes")   :- node(C, "serverless"),    node(K, "cache"),         edge(C, K).
      hasComputeToQueue("yes")   :- node(C, "compute"),       node(Q, "queue"),         edge(C, Q).
      hasComputeToQueue("yes")   :- node(C, "serverless"),    node(Q, "queue"),         edge(C, Q).
      hasQueueToCompute("yes")   :- node(Q, "queue"),         node(C, "compute"),       edge(Q, C).
      hasQueueToCompute("yes")   :- node(Q, "queue"),         node(C, "serverless"),    edge(Q, C).
      hasComputeToPayment("yes") :- node(C, "compute"),       node(P, "payment_processor"), edge(C, P).
      hasComputeToPayment("yes") :- node(C, "serverless"),    node(P, "payment_processor"), edge(C, P).
      hasComputeToSecrets("yes") :- node(C, "compute"),       node(S, "secrets_manager"),   edge(C, S).
      hasComputeToSecrets("yes") :- node(C, "serverless"),    node(S, "secrets_manager"),   edge(C, S).
      hasTwoDatabases("yes")     :- node(D1, "database"),     node(D2, "database"),     D1 != D2.

      req("waf-filters-traffic",       "pass") :- hasWafOnApi("yes").
      req("waf-filters-traffic",       "fail") :- !hasWafOnApi("yes").

      req("api-gateway-behind-waf",    "pass") :- hasInternetToApi("yes").
      req("api-gateway-behind-waf",    "fail") :- !hasInternetToApi("yes").

      req("load-balancer-in-path",     "pass") :- hasApiToLb("yes").
      req("load-balancer-in-path",     "fail") :- !hasApiToLb("yes").

      req("compute-serves-requests",   "pass") :- hasLbToCompute("yes").
      req("compute-serves-requests",   "fail") :- !hasLbToCompute("yes").

      req("cache-for-reads",           "pass") :- node(_, "cache"), hasComputeToCache("yes").
      req("cache-for-reads",           "fail") :- !node(_, "cache").
      req("cache-for-reads",           "fail") :- node(_, "cache"), !hasComputeToCache("yes").

      req("auth-layer-present",        "pass") :- node(_, "auth").
      req("auth-layer-present",        "fail") :- !node(_, "auth").

      req("queue-decouples-orders",    "pass") :- node(_, "queue"), hasComputeToQueue("yes").
      req("queue-decouples-orders",    "fail") :- !node(_, "queue").
      req("queue-decouples-orders",    "fail") :- node(_, "queue"), !hasComputeToQueue("yes").

      req("order-processor-reads-queue", "pass") :- hasQueueToCompute("yes").
      req("order-processor-reads-queue", "fail") :- !hasQueueToCompute("yes").

      req("database-with-replica",     "pass") :- hasTwoDatabases("yes").
      req("database-with-replica",     "fail") :- !hasTwoDatabases("yes").

      req("payment-gateway-integrated","pass") :- hasComputeToPayment("yes").
      req("payment-gateway-integrated","fail") :- !hasComputeToPayment("yes").

      req("payment-keys-in-secrets",   "pass") :- node(_, "secrets_manager"), hasComputeToSecrets("yes").
      req("payment-keys-in-secrets",   "fail") :- !node(_, "secrets_manager").
      req("payment-keys-in-secrets",   "fail") :- node(_, "secrets_manager"), !hasComputeToSecrets("yes").

      violation("db-public-exposure",  N) :- node(N, "database"), zone(N, "public").
      violation("single-az-database",  N) :- node(N, "database"), !nodeConfig(N, "multiAz", "true"), !hasTwoDatabases("yes").
    `,
    optimization: { maxNodes: 14, maxEdges: 12 },
  },
};

export default midnightMarketPuzzle;
