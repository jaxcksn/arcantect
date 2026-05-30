import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { midnightMarketRubric } from './midnight-market.ts';
import type { AnnotatedGraph, ScorerEdge, ScorerNode } from '../types.ts';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let _edgeCounter = 0;

function node(id: string, runeType: string): ScorerNode {
  return { id, runeType, label: runeType, config: {}, capabilities: [] };
}

function edge(source: string, target: string): ScorerEdge {
  return {
    id: `e${_edgeCounter++}`,
    source,
    target,
    direction: 'directed',
    flowType: 'internal-rpc',
    encrypted: false,
  };
}

function graph(nodes: ScorerNode[], edges: ScorerEdge[]): AnnotatedGraph {
  return { nodes, edges, puzzle: { tags: [] } };
}

function restrictionById(id: string) {
  const r = midnightMarketRubric.restrictions?.find(r => r.id === id);
  if (!r) throw new Error(`Restriction "${id}" not found`);
  return r.detect;
}

// ---------------------------------------------------------------------------
// Restrictions
// ---------------------------------------------------------------------------

describe('restriction: naive-payment-path', () => {
  const detect = restrictionById('naive-payment-path');

  it('triggers when ingress reaches payment_processor without going through queue', () => {
    const g = graph(
      [node('lb', 'load_balancer'), node('srv', 'compute'), node('pp', 'payment_processor'), node('q', 'queue')],
      [edge('lb', 'srv'), edge('srv', 'pp'), edge('srv', 'q')],
    );
    const violations = detect(g);
    assert.equal(violations.length, 1);
    assert.equal(violations[0]!.restriction, 'naive-payment-path');
  });

  it('does not trigger when the only path from ingress to payment_processor goes through the queue', () => {
    const g = graph(
      [
        node('lb', 'load_balancer'),
        node('srv', 'compute'),
        node('q', 'queue'),
        node('proc', 'serverless'),
        node('pp', 'payment_processor'),
      ],
      [edge('lb', 'srv'), edge('srv', 'q'), edge('q', 'proc'), edge('proc', 'pp')],
    );
    assert.equal(detect(g).length, 0);
  });

  it('does not trigger when there is no ingress node', () => {
    const g = graph(
      [node('srv', 'compute'), node('q', 'queue'), node('pp', 'payment_processor')],
      [edge('srv', 'pp'), edge('srv', 'q')],
    );
    assert.equal(detect(g).length, 0);
  });

  it('does not trigger when there is no queue (requirement check handles that case)', () => {
    const g = graph(
      [node('lb', 'load_balancer'), node('srv', 'compute'), node('pp', 'payment_processor')],
      [edge('lb', 'srv'), edge('srv', 'pp')],
    );
    assert.equal(detect(g).length, 0);
  });
});

describe('restriction: no-auth-before-data (via noAuthBeforeData)', () => {
  const detect = restrictionById('no-auth-before-data');

  it('triggers when ingress can reach a data store without auth', () => {
    const g = graph(
      [node('i', 'internet'), node('db', 'database')],
      [edge('i', 'db')],
    );
    const violations = detect(g);
    assert.equal(violations.length, 1);
    assert.equal(violations[0]!.restriction, 'no-auth-before-data');
  });

  it('does not trigger when api_gateway (which is itself an auth type) is on the path', () => {
    const g = graph(
      [node('i', 'internet'), node('ag', 'api_gateway'), node('db', 'database')],
      [edge('i', 'ag'), edge('ag', 'db')],
    );
    assert.equal(detect(g).length, 0);
  });

  it('does not trigger when a dedicated auth node is on the path from ingress to data', () => {
    const g = graph(
      [node('i', 'internet'), node('a', 'auth'), node('db', 'database')],
      [edge('i', 'a'), edge('a', 'db')],
    );
    assert.equal(detect(g).length, 0);
  });

  it('does not trigger when there is no ingress node', () => {
    const g = graph([node('db', 'database')], []);
    assert.equal(detect(g).length, 0);
  });
});

describe('restriction: single-az-database (via singleAzDatabase)', () => {
  const detect = restrictionById('single-az-database');

  it('triggers when there is only one database node with no multiAz config', () => {
    const g = graph([node('db', 'database')], []);
    const violations = detect(g);
    assert.equal(violations.length, 1);
    assert.equal(violations[0]!.restriction, 'single-az-database');
  });

  it('does not trigger when there are two database nodes (treated as replica pair)', () => {
    const g = graph([node('db1', 'database'), node('db2', 'database')], []);
    assert.equal(detect(g).length, 0);
  });

  it('does not trigger when the single database node has multiAz: true', () => {
    const n = node('db', 'database');
    n.config['multiAz'] = true;
    const g = graph([n], []);
    assert.equal(detect(g).length, 0);
  });
});
