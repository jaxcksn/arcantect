import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PuzzleJsonSchema, RubricJsonSchema } from './puzzle-schema.zod.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(
  schema: { safeParse: (v: unknown) => { success: boolean } },
  value: unknown,
  label = '',
) {
  const result = schema.safeParse(value);
  assert.equal(
    result.success,
    true,
    `Expected valid${label ? ` (${label})` : ''}: ${JSON.stringify(value)}`,
  );
}

function fail(
  schema: { safeParse: (v: unknown) => { success: boolean } },
  value: unknown,
  label = '',
) {
  const result = schema.safeParse(value);
  assert.equal(
    result.success,
    false,
    `Expected invalid${label ? ` (${label})` : ''}: ${JSON.stringify(value)}`,
  );
}

// ---------------------------------------------------------------------------
// RubricJson
// ---------------------------------------------------------------------------

const minimalRubric = {
  requirements: [
    {
      id: 'test-req',
      label: 'Label',
      hint: 'Hint',
    },
  ],
};

describe('RubricJsonSchema', () => {
  it('accepts a minimal rubric', () => ok(RubricJsonSchema, minimalRubric));

  it('accepts a rubric with optimization budget', () =>
    ok(RubricJsonSchema, {
      ...minimalRubric,
      optimization: { maxNodes: 6, maxEdges: 6 },
    }));

  it('accepts a rubric with a built-in restriction ref', () =>
    ok(RubricJsonSchema, {
      ...minimalRubric,
      restrictions: [{ ref: 'no-auth-before-data' }],
    }));

  it('accepts a rubric with an inline restriction', () =>
    ok(RubricJsonSchema, {
      ...minimalRubric,
      restrictions: [
        {
          id: 'naive-payment-path',
          label: 'Payment processing must be decoupled through a queue.',
          hint: 'Route payment through a Message Queue.',
          detect: {
            op: 'canReach',
            from: ['internet', 'load_balancer'],
            to: ['payment_processor'],
            skip: ['queue'],
            message: 'Synchronous payment path detected.',
          },
        },
      ],
    }));

  it('accepts a rubric with datalogRules', () =>
    ok(RubricJsonSchema, {
      ...minimalRubric,
      datalogRules: 'req("test-req", "pass") :- node(_, "object_storage").',
    }));

  it('rejects optimization with non-integer maxNodes', () =>
    fail(RubricJsonSchema, {
      ...minimalRubric,
      optimization: { maxNodes: 6.5, maxEdges: 6 },
    }));

  it('rejects optimization with zero maxNodes', () =>
    fail(RubricJsonSchema, {
      ...minimalRubric,
      optimization: { maxNodes: 0, maxEdges: 6 },
    }));

  it('rejects missing requirements array', () => fail(RubricJsonSchema, {}));

  it('accepts hardConstraints as the new field name', () =>
    ok(RubricJsonSchema, {
      hardConstraints: [{ id: 'test-req', label: 'Label', hint: 'Hint' }],
    }));

  it('accepts a rubric with capabilityGoals and tradeoff fields', () =>
    ok(RubricJsonSchema, {
      ...minimalRubric,
      capabilityGoals: [
        {
          id: 'edge-delivery-present',
          label: 'CDN needed',
          hint: 'Add a CDN.',
        },
      ],
      tradeoffWeights: { latency: 2, cost: 1 },
      tradeoffThreshold: 6,
    }));
});

// ---------------------------------------------------------------------------
// PuzzleJson — full round-trip against both fixture puzzles
// ---------------------------------------------------------------------------

describe('PuzzleJsonSchema — SPA puzzle', () => {
  const spaPuzzle = {
    id: 'spa',
    title: 'An Enchanted Signboard for the Village Theater',
    shortDescription: 'Model a CDN-fronted object-storage-hosted SPA.',
    prompt: 'Festival week approaches…',
    context: { tags: ['easy'] },
    rubric: {
      requirements: [
        {
          id: 'starts-from-internet',
          label:
            'Visitors should find the signboard by a name they can remember.',
          hint: 'Use the DNS to give internet traffic a URL to visit.',
        },
        {
          id: 'static-files-distributed',
          label: 'Something needs to distribute the scrolls.',
          hint: 'Connect a path from Internet to Static Assets through a static-origin node.',
        },
        {
          id: 'waf-bonus',
          label: 'Bonus WAF.',
          hint: 'Attach a WAF.',
          bonus: true,
        },
      ],
      restrictions: [{ ref: 'no-auth-before-data' }],
      optimization: { maxNodes: 6, maxEdges: 6 },
      datalogRules:
        'req("starts-from-internet", "pass") :- node(I, "internet"), node(D, "dns"), edge(I, D).',
    },
  };

  it('validates the SPA puzzle fixture', () => ok(PuzzleJsonSchema, spaPuzzle));

  it('rejects SPA puzzle with missing id', () => {
    const { id: _id, ...noId } = spaPuzzle;
    fail(PuzzleJsonSchema, noId);
  });

  it('rejects SPA puzzle with empty requirements', () => {
    fail(PuzzleJsonSchema, {
      ...spaPuzzle,
      rubric: { ...spaPuzzle.rubric, requirements: [] },
    });
  });
});

describe('PuzzleJsonSchema — Midnight Market', () => {
  const midnightMarket = {
    id: 'midnight-market',
    title: 'The Great Midnight Market',
    prompt: 'Fifty thousand shoppers rush the shopfront…',
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
          id: 'queue-decouples-orders',
          label: 'Purchase decrees must be sealed into the Scroll of Orders.',
          hint: 'Message Queue.',
        },
        {
          id: 'database-with-replica',
          label: 'The Great Ledger must have a twin.',
          hint: 'Two Database nodes.',
        },
      ],
      restrictions: [
        { ref: 'no-auth-before-data' },
        {
          id: 'naive-payment-path',
          label: 'Payment processing must be decoupled through a queue.',
          hint: 'Route payment through a Message Queue.',
          detect: {
            op: 'canReach',
            from: ['internet', 'cdn', 'load_balancer', 'api_gateway'],
            to: ['payment_processor'],
            skip: ['queue'],
            message: 'Synchronous payment path.',
          },
        },
      ],
      optimization: { maxNodes: 12, maxEdges: 12 },
    },
  };

  it('validates the Midnight Market fixture', () =>
    ok(PuzzleJsonSchema, midnightMarket));

  it('rejects a node in initialNodes with an invalid position', () =>
    fail(PuzzleJsonSchema, {
      ...midnightMarket,
      initialNodes: [
        { id: 'bad', nodeType: 'internet', position: 'not-an-object' },
      ],
    }));
});

describe('PuzzleJsonSchema — general rejections', () => {
  it('rejects a number', () => fail(PuzzleJsonSchema, 42));
  it('rejects null', () => fail(PuzzleJsonSchema, null));
  it('rejects an empty object', () => fail(PuzzleJsonSchema, {}));
  it('rejects missing rubric', () =>
    fail(PuzzleJsonSchema, {
      id: 'x',
      title: 'X',
      prompt: 'P',
      context: { tags: [] },
    }));
  it('rejects invalid context tags (non-string in array)', () =>
    fail(PuzzleJsonSchema, {
      id: 'x',
      title: 'X',
      prompt: 'P',
      context: { tags: [42] },
      rubric: { requirements: [] },
    }));
});
