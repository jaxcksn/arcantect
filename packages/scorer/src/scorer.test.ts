import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreGraph } from './scorer.ts';
import { compileRubric } from './puzzle-compiler.ts';
import midnightMarketPuzzle from '../../client/src/puzzles/midnight-market-puzzle.ts';
import type { RawEdge, RawNode, Rubric } from './types.ts';

const context = { tags: [] };

const rubric: Rubric = {
  hardConstraints: [
    { id: 'core', label: 'Core requirement', hint: 'Add the core node.' },
    { id: 'bonus', label: 'Bonus requirement', hint: 'Add the bonus node.', bonus: true },
  ],
  optimization: { maxNodes: 2, maxEdges: 0 },
  datalogRules: `
    req("core",  "pass") :- node(_, "core").
    req("core",  "fail") :- !node(_, "core").
    req("bonus", "pass") :- node(_, "bonus").
    req("bonus", "fail") :- !node(_, "bonus").
  `,
};

function node(id: string, nodeType: string): RawNode {
  return { id, data: { nodeType } };
}

function directed(id: string, source: string, target: string): RawEdge {
  return { id, source, target };
}

function applies(id: string, source: string, target: string): RawEdge {
  return { id, source, target, data: { direction: 'applies' } };
}

function reqPassed(result: ReturnType<typeof scoreGraph>, id: string): boolean {
  const req = result.hardConstraintResults.find(r => r.id === id);
  if (!req) throw new Error(`Hard constraint "${id}" not found`);
  return req.passed;
}

describe('scoreGraph', () => {
  it('passes when all non-bonus hard constraints are met (stars >= 1)', () => {
    const result = scoreGraph([node('core', 'core')], [], rubric, context);

    assert.equal(result.passed, true);
    // Within budget (1 node, 0 edges, max 2/0) and no capability goals → stars = 3
    assert.equal(result.stars, 3);
  });

  it('stars = 3 when all constraints pass within budget', () => {
    const result = scoreGraph(
      [node('core', 'core'), node('bonus', 'bonus')],
      [],
      rubric,
      context,
    );

    assert.equal(result.passed, true);
    assert.equal(result.stars, 3);
  });

  it('stars = 2 when passed but over optimization budget', () => {
    const overBudgetRubric: Rubric = {
      ...rubric,
      optimization: { maxNodes: 1, maxEdges: 0 },
    };
    const result = scoreGraph(
      [node('core', 'core'), node('bonus', 'bonus')],
      [],
      overBudgetRubric,
      context,
    );

    assert.equal(result.passed, true);
    assert.equal(result.stars, 2);
  });

  it('stars = 1 when capability goals fail', () => {
    const rubricWithCaps: Rubric = {
      hardConstraints: [{ id: 'core', label: 'Core', hint: 'Add core.' }],
      capabilityGoals: [{ id: 'needs-cdn', label: 'Needs CDN', hint: 'Add a CDN.' }],
      datalogRules: `
        req("core", "pass") :- node(_, "core").
        req("core", "fail") :- !node(_, "core").
        capgoal("needs-cdn", "pass") :- node(_, "cdn").
        capgoal("needs-cdn", "fail") :- !node(_, "cdn").
      `,
    };
    const result = scoreGraph([node('core', 'core')], [], rubricWithCaps, context);

    assert.equal(result.passed, true);
    assert.equal(result.capabilityResults[0]?.passed, false);
    assert.equal(result.stars, 1);
  });

  it('returns tradeoffProfile aggregated from node tradeoffs', () => {
    const result = scoreGraph(
      [{ id: 'n1', data: { nodeType: 'cdn' }, capabilities: ['edge-delivery'], tradeoffs: { latency: 2, cost: -1 } }],
      [],
      { hardConstraints: [{ id: 'x', label: 'x', hint: 'x' }], datalogRules: 'req("x","pass") :- node(_,_).' },
      context,
    );

    assert.equal(result.tradeoffProfile.latency, 2);
    assert.equal(result.tradeoffProfile.cost, -1);
    assert.equal(result.tradeoffProfile.security, 0);
  });
});

describe('scoreGraph — Midnight Market WAF/API Gateway scoring', () => {
  const midnightRubric = compileRubric(midnightMarketPuzzle.rubric);
  const midnightContext = midnightMarketPuzzle.context;

  // The new midnight market puzzle has pre-placed application nodes.
  // completeNodes builds a valid graph that passes all non-bonus requirements.
  function completeNodes(extra: RawNode[] = []): RawNode[] {
    return [
      node('internet', 'internet'),
      node('waf', 'waf'),
      node('api', 'api_gateway'),
      node('lb', 'load_balancer'),
      // Pre-placed application nodes (fixed IDs required by the datalog rules)
      { id: 'preplaced-catalog-service',  data: { nodeType: 'application' } },
      { id: 'preplaced-order-service',    data: { nodeType: 'application' } },
      { id: 'preplaced-payment-service',  data: { nodeType: 'application' } },
      node('catalog-compute', 'compute'),
      node('order-compute', 'compute'),
      node('payment-compute', 'compute'),
      node('auth', 'auth'),
      node('cache', 'cache'),
      node('queue', 'queue'),
      node('processor', 'serverless'),
      node('db1', 'database'),
      node('db2', 'database'),
      node('payment', 'payment_processor'),
      node('secrets', 'secrets_manager'),
      ...extra,
    ];
  }

  function completeEdges(frontDoor: RawEdge[]): RawEdge[] {
    return [
      ...frontDoor,
      applies('e-waf-api', 'waf', 'api'),
      directed('e-api-lb', 'api', 'lb'),
      directed('e-lb-catalog', 'lb', 'catalog-compute'),
      // Connect pre-placed service nodes to their compute hosts
      { id: 'e-cat-host', source: 'preplaced-catalog-service', target: 'catalog-compute', data: { direction: 'hosts' as const } },
      { id: 'e-ord-host', source: 'preplaced-order-service',   target: 'order-compute',   data: { direction: 'hosts' as const } },
      { id: 'e-pay-host', source: 'preplaced-payment-service', target: 'payment-compute', data: { direction: 'hosts' as const } },
      directed('e-catalog-cache', 'catalog-compute', 'cache'),
      directed('e-order-queue', 'order-compute', 'queue'),
      directed('e-queue-processor', 'queue', 'processor'),
      directed('e-payment-secrets', 'payment-compute', 'secrets'),
      directed('e-payment-pp', 'payment-compute', 'payment'),
    ];
  }

  it('requires the WAF to be applied to the API Gateway, not placed in the request path', () => {
    const result = scoreGraph(
      completeNodes(),
      [
        directed('e-internet-waf', 'internet', 'waf'),
        directed('e-waf-api', 'waf', 'api'),
      ],
      midnightRubric,
      midnightContext,
    );

    assert.equal(reqPassed(result, 'waf-guards-gateway'), false);
    assert.equal(reqPassed(result, 'api-gateway-public'), false);
  });

  it('allows DNS in front of the API Gateway when the WAF is applied to the API Gateway', () => {
    const result = scoreGraph(
      completeNodes([node('dns', 'dns')]),
      completeEdges([
        directed('e-internet-dns', 'internet', 'dns'),
        directed('e-dns-api', 'dns', 'api'),
      ]),
      midnightRubric,
      midnightContext,
    );

    assert.equal(reqPassed(result, 'waf-guards-gateway'), true);
    assert.equal(reqPassed(result, 'api-gateway-public'), true);
    assert.equal(result.passed, true);
  });
});
