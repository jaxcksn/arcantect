import { describe, it, expect } from "vitest";
import { parseProgram } from "../parser.js";
import { evaluate } from "../evaluator.js";
import { factExists, violations, requirementResults } from "../query.js";
import {
  DatalogParseError,
  DatalogStratificationError,
} from "../types.js";
import type { Fact } from "../types.js";

// ---------------------------------------------------------------------------
// 1. Parser tests
// ---------------------------------------------------------------------------

describe("parser", () => {
  it("parses a ground fact", () => {
    const rules = parseProgram(`node("n1", "cdn").`);
    expect(rules).toHaveLength(1);
    expect(rules[0]!.head.predicate).toBe("node");
    expect(rules[0]!.body).toHaveLength(0);
    expect(rules[0]!.head.terms).toEqual([
      { kind: "const", value: "n1" },
      { kind: "const", value: "cdn" },
    ]);
  });

  it("parses a rule with variables", () => {
    const rules = parseProgram(`reaches(X, Z) :- edge(X, Y), reaches(Y, Z).`);
    expect(rules).toHaveLength(1);
    const rule = rules[0]!;
    expect(rule.head.predicate).toBe("reaches");
    expect(rule.body).toHaveLength(2);
    expect(rule.body[0]!.predicate).toBe("edge");
    expect(rule.body[0]!.negated).toBe(false);
    expect(rule.body[1]!.predicate).toBe("reaches");
  });

  it("parses negated body atoms", () => {
    const rules = parseProgram(`onSyncPath(N) :- computeNode(N), !consumesFromQueue(N).`);
    const body = rules[0]!.body;
    expect(body[0]!.negated).toBe(false);
    expect(body[1]!.negated).toBe(true);
    expect(body[1]!.predicate).toBe("consumesFromQueue");
  });

  it("parses infix != as a body atom", () => {
    const rules = parseProgram(`req("db-replica", "pass") :- node(D1, "database"), node(D2, "database"), D1 != D2.`);
    const body = rules[0]!.body;
    expect(body[2]!.predicate).toBe("!=");
    expect(body[2]!.negated).toBe(false);
    expect(body[2]!.terms[0]).toEqual({ kind: "var", name: "D1" });
    expect(body[2]!.terms[1]).toEqual({ kind: "var", name: "D2" });
  });

  it("parses wildcards", () => {
    const rules = parseProgram(`req("has-node", "pass") :- node(_, "cdn").`);
    expect(rules[0]!.body[0]!.terms[0]).toEqual({ kind: "wild" });
  });

  it("strips line comments", () => {
    const rules = parseProgram(`
      // This is a comment
      node("n1", "cdn"). // inline comment
    `);
    expect(rules).toHaveLength(1);
  });

  it("parses multi-line rules", () => {
    const rules = parseProgram(`
      reaches(X, Z) :-
        edge(X, Y),
        reaches(Y, Z).
    `);
    expect(rules).toHaveLength(1);
    expect(rules[0]!.body).toHaveLength(2);
  });

  it("throws DatalogParseError on syntax error", () => {
    expect(() => parseProgram(`node("n1", "cdn"`)).toThrow(DatalogParseError);
  });
});

// ---------------------------------------------------------------------------
// 2. Stratification tests
// ---------------------------------------------------------------------------

describe("stratification", () => {
  it("throws DatalogStratificationError for recursive negation", () => {
    // p(X) :- q(X), !p(X).  — p negatively depends on itself
    const rules = parseProgram(`
      q("a").
      p(X) :- q(X), !p(X).
    `);
    expect(() => evaluate(rules, [])).toThrow(DatalogStratificationError);
  });

  it("accepts non-recursive negation across predicates", () => {
    const rules = parseProgram(`
      computeNode("n1").
      consumesFromQueue("n1").
      onSyncPath(N) :- computeNode(N), !consumesFromQueue(N).
    `);
    expect(() => evaluate(rules, [])).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3. Reachability
// ---------------------------------------------------------------------------

describe("reachability", () => {
  const reachRules = parseProgram(`
    reaches(X, Y) :- edge(X, Y).
    reaches(X, Z) :- edge(X, Y), reaches(Y, Z).
  `);

  it("derives transitive reachability from a chain A→B→C", () => {
    const edb: Fact[] = [
      { predicate: "edge", terms: ["A", "B"] },
      { predicate: "edge", terms: ["B", "C"] },
    ];
    const result = evaluate(reachRules, edb);
    expect(factExists(result, "reaches", "A", "B")).toBe(true);
    expect(factExists(result, "reaches", "B", "C")).toBe(true);
    expect(factExists(result, "reaches", "A", "C")).toBe(true);
    expect(factExists(result, "reaches", "C", "A")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Negation — onSyncPath / consumesFromQueue
// ---------------------------------------------------------------------------

describe("negation", () => {
  const rules = parseProgram(`
    computeNode(N) :- node(N, "compute").
    computeNode(N) :- node(N, "serverless").
    consumesFromQueue(N) :- computeNode(N), node(Q, "queue"), edge(Q, N).
    onSyncPath(N) :- computeNode(N), !consumesFromQueue(N).
  `);

  it("marks sync-path nodes not connected from a queue", () => {
    const edb: Fact[] = [
      { predicate: "node", terms: ["c1", "compute"] },
      { predicate: "node", terms: ["c2", "compute"] },
      { predicate: "node", terms: ["q1", "queue"] },
      { predicate: "edge", terms: ["q1", "c2"] }, // c2 reads from queue
    ];
    const result = evaluate(rules, edb);
    expect(factExists(result, "onSyncPath", "c1")).toBe(true);
    expect(factExists(result, "onSyncPath", "c2")).toBe(false);
    expect(factExists(result, "consumesFromQueue", "c2")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Missing-read-cache anti-pattern
// ---------------------------------------------------------------------------

describe("missing-read-cache anti-pattern", () => {
  const rules = parseProgram(`
    reaches(X, Y) :- edge(X, Y).
    reaches(X, Z) :- edge(X, Y), reaches(Y, Z).
    computeNode(N) :- node(N, "compute").
    consumesFromQueue(N) :- computeNode(N), node(Q, "queue"), edge(Q, N).
    onSyncPath(N) :- computeNode(N), !consumesFromQueue(N).
    cacheMediated(C, D) :-
      computeNode(C), node(K, "cache"), node(D, "database"),
      edge(C, K), reaches(K, D).
    violation("missing-read-cache", N) :-
      onSyncPath(N), node(N, "compute"),
      node(D, "database"), reaches(N, D),
      !cacheMediated(N, D).
  `);

  it("flags reader (no cache) but not writer (via queue)", () => {
    // reader: compute → database directly (no cache)
    // writer: queue → compute (async path)
    const edb: Fact[] = [
      { predicate: "node", terms: ["reader", "compute"] },
      { predicate: "node", terms: ["writer", "compute"] },
      { predicate: "node", terms: ["q1", "queue"] },
      { predicate: "node", terms: ["db1", "database"] },
      { predicate: "edge", terms: ["reader", "db1"] },
      { predicate: "edge", terms: ["q1", "writer"] },
      { predicate: "edge", terms: ["writer", "db1"] },
    ];
    const result = evaluate(rules, edb);
    const v = violations(result);
    const ids = v.map(x => x.nodeId);
    expect(ids).toContain("reader");
    expect(ids).not.toContain("writer");
  });

  it("does not flag reader when cache is present", () => {
    const edb: Fact[] = [
      { predicate: "node", terms: ["reader", "compute"] },
      { predicate: "node", terms: ["cache1", "cache"] },
      { predicate: "node", terms: ["db1", "database"] },
      { predicate: "edge", terms: ["reader", "cache1"] },
      { predicate: "edge", terms: ["cache1", "db1"] },
    ];
    const result = evaluate(rules, edb);
    const v = violations(result);
    expect(v.map(x => x.nodeId)).not.toContain("reader");
  });
});

// ---------------------------------------------------------------------------
// 6. Inequality (!=)
// ---------------------------------------------------------------------------

describe("inequality", () => {
  const rules = parseProgram(`
    req("two-databases", "pass") :- node(D1, "database"), node(D2, "database"), D1 != D2.
  `);

  it("does NOT fire when D1 and D2 resolve to the same constant", () => {
    const edb: Fact[] = [
      { predicate: "node", terms: ["db1", "database"] },
    ];
    const result = evaluate(rules, edb);
    expect(factExists(result, "req", "two-databases", "pass")).toBe(false);
  });

  it("fires when D1 and D2 are distinct nodes", () => {
    const edb: Fact[] = [
      { predicate: "node", terms: ["db1", "database"] },
      { predicate: "node", terms: ["db2", "database"] },
    ];
    const result = evaluate(rules, edb);
    expect(factExists(result, "req", "two-databases", "pass")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Query helpers
// ---------------------------------------------------------------------------

describe("query helpers", () => {
  const rules = parseProgram(`
    reaches(X, Y) :- edge(X, Y).
    reaches(X, Z) :- edge(X, Y), reaches(Y, Z).
    violation("no-edge", "") :- node(N, "compute"), !edge(N, _).
    req("has-node", "pass") :- node(_, "database").
  `);

  const edb: Fact[] = [
    { predicate: "node", terms: ["c1", "compute"] },
    { predicate: "node", terms: ["db1", "database"] },
    { predicate: "node", terms: ["isolated", "compute"] },
    { predicate: "edge", terms: ["c1", "db1"] },
  ];

  it("factExists returns correct results", () => {
    const result = evaluate(rules, edb);
    expect(factExists(result, "reaches", "c1", "db1")).toBe(true);
    expect(factExists(result, "reaches", "db1", "c1")).toBe(false);
    expect(factExists(result, "node", null, "compute")).toBe(true);
  });

  it("violations returns correct shape", () => {
    const result = evaluate(rules, edb);
    const v = violations(result);
    expect(v).toEqual(expect.arrayContaining([{ id: "no-edge", nodeId: "" }]));
  });

  it("requirementResults returns correct shape", () => {
    const result = evaluate(rules, edb);
    const reqs = requirementResults(result);
    expect(reqs).toEqual(expect.arrayContaining([{ id: "has-node", passed: true }]));
  });
});
