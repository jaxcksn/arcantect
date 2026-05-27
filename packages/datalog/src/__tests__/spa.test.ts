/**
 * Integration tests for the SPA puzzle Datalog rules.
 * All inputs are plain Fact[] — no graph or React dependencies.
 */
import { describe, it, expect } from "vitest";
import { parseProgram } from "../parser.js";
import { evaluate } from "../evaluator.js";
import { requirementResults, violations } from "../query.js";
import type { Fact } from "../types.js";

const SPA_RULES = `
  reaches(X, Y) :- edge(X, Y).
  reaches(X, Z) :- edge(X, Y), reaches(Y, Z).

  associated(X, Y) :- edge(X, Y).
  associated(X, Y) :- edge(Y, X).

  noCdnReach(X, Y) :- edge(X, Y), !node(X, "cdn").
  noCdnReach(X, Z) :- edge(X, Y), !node(X, "cdn"), noCdnReach(Y, Z).

  hasInternetToDns("yes")     :- node(I, "internet"), node(R, "dns"), edge(I, R).
  hasCdnFrontsStorage("yes")  :- node(C, "cdn"), node(S, "object_storage"), edge(C, S).
  hasDnsToCdn("yes")          :- node(R, "dns"), node(C, "cdn"), reaches(R, C).
  hasCertForCdn("yes")        :- node(A, "certificate"), node(C, "cdn"), associated(A, C).
  hasWafForCdn("yes")         :- node(W, "waf"), node(C, "cdn"), associated(W, C).

  directPublicStorage(S) :-
    node(S, "object_storage"), node(I, "internet"), noCdnReach(I, S).
  storageExposed("yes") :- directPublicStorage(_).

  req("starts-from-internet",  "pass") :- hasInternetToDns("yes").
  req("starts-from-internet",  "fail") :- !hasInternetToDns("yes").

  req("needs-object-storage",  "pass") :- node(_, "object_storage").
  req("needs-object-storage",  "fail") :- !node(_, "object_storage").

  req("cdn-fronts-storage",    "pass") :- hasCdnFrontsStorage("yes").
  req("cdn-fronts-storage",    "fail") :- !hasCdnFrontsStorage("yes").

  req("dns-routes-to-cdn",     "pass") :- hasDnsToCdn("yes").
  req("dns-routes-to-cdn",     "fail") :- !hasDnsToCdn("yes").

  req("https-certificate",     "pass") :- hasCertForCdn("yes").
  req("https-certificate",     "fail") :- !hasCertForCdn("yes").

  req("storage-not-public",    "pass") :- node(_, "object_storage"), !storageExposed("yes").
  req("storage-not-public",    "fail") :- node(_, "object_storage"),  storageExposed("yes").

  req("waf-protects-cdn",      "pass") :- hasWafForCdn("yes").
  req("waf-protects-cdn",      "fail") :- !hasWafForCdn("yes").

  violation("unencrypted-cross-zone", E) :-
    edgeMeta(E, "crossesZone", "true"),
    !edgeMeta(E, "encrypted", "true").
`;

const rules = parseProgram(SPA_RULES);

/** Minimal correct SPA: internet → dns → cdn → object_storage, certificate on cdn */
const correctEdb: Fact[] = [
  { predicate: "node", terms: ["i1", "internet"] },
  { predicate: "node", terms: ["d1", "dns"] },
  { predicate: "node", terms: ["c1", "cdn"] },
  { predicate: "node", terms: ["s1", "object_storage"] },
  { predicate: "node", terms: ["cert1", "certificate"] },
  { predicate: "edge", terms: ["i1", "d1"] },
  { predicate: "edge", terms: ["d1", "c1"] },
  { predicate: "edge", terms: ["c1", "s1"] },
  { predicate: "edge", terms: ["cert1", "c1"] },
];

describe("SPA puzzle — correct architecture", () => {
  const result = evaluate(rules, correctEdb);
  const reqs = requirementResults(result);
  const reqMap = Object.fromEntries(reqs.map(r => [r.id, r.passed]));

  it("starts-from-internet passes", () => expect(reqMap["starts-from-internet"]).toBe(true));
  it("needs-object-storage passes", () => expect(reqMap["needs-object-storage"]).toBe(true));
  it("cdn-fronts-storage passes", () => expect(reqMap["cdn-fronts-storage"]).toBe(true));
  it("dns-routes-to-cdn passes", () => expect(reqMap["dns-routes-to-cdn"]).toBe(true));
  it("https-certificate passes", () => expect(reqMap["https-certificate"]).toBe(true));
  it("storage-not-public passes", () => expect(reqMap["storage-not-public"]).toBe(true));
  it("waf-protects-cdn fails (no waf node)", () => expect(reqMap["waf-protects-cdn"]).toBe(false));
  it("no violations", () => expect(violations(result)).toHaveLength(0));
});

describe("SPA puzzle — storage directly internet-accessible", () => {
  const edb: Fact[] = [
    ...correctEdb,
    // Direct internet → object_storage edge bypasses the CDN
    { predicate: "edge", terms: ["i1", "s1"] },
  ];
  const result = evaluate(rules, edb);
  const reqs = requirementResults(result);
  const reqMap = Object.fromEntries(reqs.map(r => [r.id, r.passed]));

  it("storage-not-public fails", () => expect(reqMap["storage-not-public"]).toBe(false));
  it("cdn-fronts-storage still passes (cdn still connects to storage)", () =>
    expect(reqMap["cdn-fronts-storage"]).toBe(true));
});

describe("SPA puzzle — missing CDN", () => {
  const edb: Fact[] = [
    { predicate: "node", terms: ["i1", "internet"] },
    { predicate: "node", terms: ["d1", "dns"] },
    { predicate: "node", terms: ["s1", "object_storage"] },
    { predicate: "node", terms: ["cert1", "certificate"] },
    { predicate: "edge", terms: ["i1", "d1"] },
    { predicate: "edge", terms: ["d1", "s1"] },
  ];
  const result = evaluate(rules, edb);
  const reqs = requirementResults(result);
  const reqMap = Object.fromEntries(reqs.map(r => [r.id, r.passed]));

  it("cdn-fronts-storage fails", () => expect(reqMap["cdn-fronts-storage"]).toBe(false));
  it("dns-routes-to-cdn fails (no cdn node)", () => expect(reqMap["dns-routes-to-cdn"]).toBe(false));
  it("storage-not-public fails (internet reaches storage without cdn)", () =>
    expect(reqMap["storage-not-public"]).toBe(false));
});

describe("SPA puzzle — WAF bonus", () => {
  const edb: Fact[] = [
    ...correctEdb,
    { predicate: "node", terms: ["w1", "waf"] },
    { predicate: "edge", terms: ["w1", "c1"] },
  ];
  const result = evaluate(rules, edb);
  const reqs = requirementResults(result);
  const reqMap = Object.fromEntries(reqs.map(r => [r.id, r.passed]));

  it("waf-protects-cdn passes", () => expect(reqMap["waf-protects-cdn"]).toBe(true));
  it("all core requirements still pass", () => {
    for (const id of ["starts-from-internet", "needs-object-storage", "cdn-fronts-storage",
                      "dns-routes-to-cdn", "https-certificate", "storage-not-public"]) {
      expect(reqMap[id]).toBe(true);
    }
  });
});

describe("SPA puzzle — unencrypted cross-zone violation", () => {
  const edb: Fact[] = [
    ...correctEdb,
    { predicate: "edgeMeta", terms: ["e-cross", "crossesZone", "true"] },
  ];
  const result = evaluate(rules, edb);
  const v = violations(result);

  it("triggers unencrypted-cross-zone violation", () =>
    expect(v.some(x => x.id === "unencrypted-cross-zone")).toBe(true));

  it("does not trigger when the edge is encrypted", () => {
    const encryptedEdb: Fact[] = [
      ...correctEdb,
      { predicate: "edgeMeta", terms: ["e-cross", "crossesZone", "true"] },
      { predicate: "edgeMeta", terms: ["e-cross", "encrypted", "true"] },
    ];
    const r2 = evaluate(rules, encryptedEdb);
    expect(violations(r2).some(x => x.id === "unencrypted-cross-zone")).toBe(false);
  });
});
