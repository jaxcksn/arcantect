import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreGraph } from './scorer.ts';
import { compileRubric } from './puzzle-compiler.ts';
import midnightMarketPuzzle from '../../client/src/puzzles/midnight-market-puzzle.ts';
import type { RawEdge, RawNode, Rubric } from './types.ts';

const context = { tags: [] };

const rubric: Rubric = {
  requirements: [
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
  const req = result.requirementResults.find(r => r.id === id);
  if (!req) throw new Error(`Requirement "${id}" not found`);
  return req.passed;
}

describe('scoreGraph', () => {
  it('does not award perfect when a bonus requirement is missing', () => {
    const result = scoreGraph([node('core', 'core')], [], rubric, context);

    assert.equal(result.passed, true);
    assert.equal(result.perfect, false);
  });

  it('awards perfect when all requirements, including bonuses, are met within budget', () => {
    const result = scoreGraph(
      [node('core', 'core'), node('bonus', 'bonus')],
      [],
      rubric,
      context,
    );

    assert.equal(result.passed, true);
    assert.equal(result.perfect, true);
  });
});

describe('scoreGraph — Midnight Market WAF/API Gateway scoring', () => {
  const midnightRubric = compileRubric(midnightMarketPuzzle.rubric);
  const midnightContext = midnightMarketPuzzle.context;

  function completeNodes(extra: RawNode[] = []): RawNode[] {
    return [
      node('internet', 'internet'),
      node('waf', 'waf'),
      node('api', 'api_gateway'),
      node('lb', 'load_balancer'),
      node('app', 'compute'),
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
      directed('e-lb-app', 'lb', 'app'),
      directed('e-app-cache', 'app', 'cache'),
      directed('e-app-queue', 'app', 'queue'),
      directed('e-queue-processor', 'queue', 'processor'),
      directed('e-processor-payment', 'processor', 'payment'),
      directed('e-processor-secrets', 'processor', 'secrets'),
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

    assert.equal(reqPassed(result, 'waf-filters-traffic'), false);
    assert.equal(reqPassed(result, 'api-gateway-behind-waf'), false);
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

    assert.equal(reqPassed(result, 'waf-filters-traffic'), true);
    assert.equal(reqPassed(result, 'api-gateway-behind-waf'), true);
    assert.equal(result.passed, true);
    assert.equal(result.perfect, true);
  });
});
