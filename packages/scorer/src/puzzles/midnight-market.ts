import type { AnnotatedGraph, Rubric } from '../types.ts';
import { restrictions } from '../restrictions.ts';
import { canReach } from '../graph.ts';

function nodeIdsByType(g: AnnotatedGraph, ...runeTypes: string[]): Set<string> {
  return new Set(
    g.nodes.filter(n => runeTypes.includes(n.runeType)).map(n => n.id),
  );
}

/**
 * Rubric for the Midnight Market e-commerce puzzle.
 *
 * Target architecture:
 *   [Internet] → (optional DNS) → API Gateway → Load Balancer → App Servers → Cache (reads)
 *                                ↑
 *                               WAF (applied)
 *                                                          ↓
 *                                                     Auth Service
 *                                                          ↓
 *                                                     Message Queue  ←── order placed
 *                                                          ↓
 *                                                   Order Processor
 *                                                      ↙        ↘
 *                                                 Database    [Payment Processor]
 *                                                 (+ replica)
 *                                                      ↓
 *                                               Notification Service
 *                                                      ↓
 *                                             Secrets Manager (payment keys)
 */
export const midnightMarketRubric: Rubric = {
  hardConstraints: [
    {
      id: 'waf-filters-traffic',
      label: 'A Ward must stand at the gate where the multitudes arrive.',
      hint: 'Apply a WAF to the API Gateway so public requests are filtered there.',
    },
    {
      id: 'api-gateway-behind-waf',
      label: 'The Scroll Router must accept only petitions the Ward has cleansed.',
      hint: 'Route shoppers to an API Gateway directly, or through DNS first.',
    },
    {
      id: 'load-balancer-in-path',
      label: "The Scales of Burden must divide the work among the guild's servants.",
      hint: 'Distribute requests across app servers with a Load Balancer — connect API Gateway → Load Balancer.',
    },
    {
      id: 'compute-serves-requests',
      label: 'Guild scribes must await behind the Scales to answer every shopper.',
      hint: 'The Load Balancer needs compute (app servers) behind it to handle shopper requests.',
    },
    {
      id: 'cache-for-reads',
      label: 'A Memory Chalice must spare the Great Ledger from ten thousand browsing eyes.',
      hint: 'Serve catalogue reads from a Cache — thousands of shoppers should not hammer the database directly.',
    },
    {
      id: 'auth-layer-present',
      label: 'A Sentinel of Identity must guard the path between petition and treasure.',
      hint: 'Every request must pass through an Auth Service before touching any data store.',
    },
    {
      id: 'queue-decouples-orders',
      label: 'Purchase decrees must be sealed into the Scroll of Orders before the counting house acts.',
      hint: 'Place orders on a Message Queue so the shopfront stays responsive even when the counting house is buried in scrolls.',
    },
    {
      id: 'order-processor-reads-queue',
      label: 'A scribe of the counting house must read from the Scroll of Orders.',
      hint: 'An order processor (compute) must consume from the queue to handle purchases asynchronously.',
    },
    {
      id: 'database-with-replica',
      label: 'The Great Ledger must have a twin, lest one calamity erase all purchase decrees.',
      hint: 'No purchase decree may ever be lost — your database must have a replica (add a second Database node).',
    },
    {
      id: 'payment-gateway-integrated',
      label: 'The order scribe must deliver royal coin-seals to the Payment Alcove.',
      hint: 'The order processor must route completed transactions to the external Payment Processor.',
    },
    {
      id: 'payment-keys-in-secrets',
      label: 'The keys to the Payment Alcove must be sealed in the Chamber of Secrets.',
      hint: "Coin-seal secrets are dangerous — guard the Payment Processor's keys in a Secrets Manager.",
    },
  ],
  restrictions: [
    restrictions.noAuthBeforeData,
    restrictions.singleAzDatabase,
    {
      id: 'naive-payment-path',
      label: 'Payment processing must be decoupled through a queue.',
      hint: 'The Payment Processor should only be reachable after passing through a Message Queue.',
      detect: (g: AnnotatedGraph) => {
        const ingressIds = nodeIdsByType(g, 'internet', 'cdn', 'load_balancer', 'api_gateway');
        const paymentIds = nodeIdsByType(g, 'payment_processor');
        const queueIds = nodeIdsByType(g, 'queue');

        if (ingressIds.size === 0 || paymentIds.size === 0 || queueIds.size === 0) return [];

        if (canReach(ingressIds, paymentIds, g.edges, queueIds)) {
          return [
            {
              restriction: 'naive-payment-path',
              message:
                'Your Payment Processor is reachable from compute without passing through a Message Queue — purchase orders must be decoupled asynchronously.',
            },
          ];
        }
        return [];
      },
    },
  ],
  optimization: { maxNodes: 14, maxEdges: 12 },
};
