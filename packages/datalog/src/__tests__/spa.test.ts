/**
 * Integration tests for the SPA puzzle Datalog rules.
 * All inputs are plain Fact[] — no graph or React dependencies.
 */
import { describe, it, expect } from "vitest";
import { parseProgram } from "../parser.js";
import { evaluate } from "../evaluator.js";
import { requirementResults, capgoalResults, violations } from "../query.js";
import type { Fact } from "../types.js";

const SPA_RULES = `
  reaches(X, Y) :- edge(X, Y).
  reaches(X, Z) :- edge(X, Y), reaches(Y, Z).

  associated(X, Y) :- edge(X, Y).
  associated(X, Y) :- edge(Y, X).

  hasInternetToDns("yes")       :- node(I, "internet"), node(R, "dns"), edge(I, R).
  hasCertForEdgeDelivery("yes") :- node(A, "certificate"), node(C, _), capability(C, "edge-delivery"), associated(A, C).

  hasInternetToStaticFilesThroughOrigin("yes") :-
    node(I, "internet"),
    node(F, "static_assets"),
    node(O, _),
    capability(O, "static-origin"),
    reaches(I, O),
    reaches(O, F).

  req("starts-from-internet", "pass") :- hasInternetToDns("yes").
  req("starts-from-internet", "fail") :- !hasInternetToDns("yes").

  req("static-files-distributed", "pass") :- hasInternetToStaticFilesThroughOrigin("yes").
  req("static-files-distributed", "fail") :- !hasInternetToStaticFilesThroughOrigin("yes").

  req("https-certificate", "pass") :- hasCertForEdgeDelivery("yes").
  req("https-certificate", "fail") :- !hasCertForEdgeDelivery("yes").

  edgeDeliveryReachable("yes") :-
    node(I, "internet"), node(C, _), capability(C, "edge-delivery"), reaches(I, C).

  capgoal("edge-delivery-present", "pass") :- edgeDeliveryReachable("yes").
  capgoal("edge-delivery-present", "fail") :- !edgeDeliveryReachable("yes").

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
`;

const rules = parseProgram(SPA_RULES);

/**
 * Reference solution: internet → dns → cdn → object_storage → static_assets, certificate on cdn.
 * CDN has edge-delivery capability; object_storage has static-origin (no compute-layer).
 */
const correctEdb: Fact[] = [
  { predicate: "node",       terms: ["i1",    "internet"]       },
  { predicate: "node",       terms: ["d1",    "dns"]            },
  { predicate: "node",       terms: ["c1",    "cdn"]            },
  { predicate: "node",       terms: ["s1",    "object_storage"] },
  { predicate: "node",       terms: ["f1",    "static_assets"]  },
  { predicate: "node",       terms: ["cert1", "certificate"]    },
  { predicate: "capability", terms: ["c1",    "edge-delivery"]  },
  { predicate: "capability", terms: ["s1",    "static-origin"]  },
  { predicate: "capability", terms: ["f1",    "static-origin"]  },
  { predicate: "edge",       terms: ["i1",    "d1"]             },
  { predicate: "edge",       terms: ["d1",    "c1"]             },
  { predicate: "edge",       terms: ["c1",    "s1"]             },
  { predicate: "edge",       terms: ["s1",    "f1"]             },
  { predicate: "edge",       terms: ["cert1", "c1"]             },
];

describe("SPA puzzle — correct architecture", () => {
  const result = evaluate(rules, correctEdb);
  const reqs = requirementResults(result);
  const caps = capgoalResults(result);
  const reqMap = Object.fromEntries(reqs.map(r => [r.id, r.passed]));
  const capMap = Object.fromEntries(caps.map(r => [r.id, r.passed]));

  it("starts-from-internet passes", () => expect(reqMap["starts-from-internet"]).toBe(true));
  it("static-files-distributed passes", () => expect(reqMap["static-files-distributed"]).toBe(true));
  it("https-certificate passes", () => expect(reqMap["https-certificate"]).toBe(true));
  it("edge-delivery-present passes", () => expect(capMap["edge-delivery-present"]).toBe(true));
  it("storage-at-origin passes (object_storage has static-origin, not compute-layer)", () => expect(capMap["storage-at-origin"]).toBe(true));
  it("dns-routes-to-delivery passes", () => expect(capMap["dns-routes-to-delivery"]).toBe(true));
  it("no violations", () => expect(violations(result)).toHaveLength(0));
});

describe("SPA puzzle — compute serves files (storage-at-origin should fail)", () => {
  // Compute node has both static-origin AND compute-layer — storage-at-origin must fail.
  const edb: Fact[] = [
    { predicate: "node",       terms: ["i1",   "internet"]      },
    { predicate: "node",       terms: ["d1",   "dns"]           },
    { predicate: "node",       terms: ["c1",   "cdn"]           },
    { predicate: "node",       terms: ["srv1", "compute"]       },
    { predicate: "node",       terms: ["f1",   "static_assets"] },
    { predicate: "node",       terms: ["cert1","certificate"]   },
    { predicate: "capability", terms: ["c1",   "edge-delivery"] },
    { predicate: "capability", terms: ["srv1", "static-origin"] },
    { predicate: "capability", terms: ["srv1", "compute-layer"] },
    { predicate: "capability", terms: ["f1",   "static-origin"] },
    { predicate: "edge",       terms: ["i1",   "d1"]            },
    { predicate: "edge",       terms: ["d1",   "c1"]            },
    { predicate: "edge",       terms: ["c1",   "srv1"]          },
    { predicate: "edge",       terms: ["srv1", "f1"]            },
    { predicate: "edge",       terms: ["cert1","c1"]            },
  ];
  const result = evaluate(rules, edb);
  const caps = capgoalResults(result);
  const capMap = Object.fromEntries(caps.map(r => [r.id, r.passed]));

  it("storage-at-origin fails (compute has both static-origin and compute-layer)", () =>
    expect(capMap["storage-at-origin"]).toBe(false));
  it("edge-delivery-present still passes", () =>
    expect(capMap["edge-delivery-present"]).toBe(true));
  it("dns-routes-to-delivery still passes", () =>
    expect(capMap["dns-routes-to-delivery"]).toBe(true));
});

describe("SPA puzzle — static files not connected through origin", () => {
  const edb: Fact[] = [
    { predicate: "node",       terms: ["i1",    "internet"]       },
    { predicate: "node",       terms: ["d1",    "dns"]            },
    { predicate: "node",       terms: ["c1",    "cdn"]            },
    { predicate: "node",       terms: ["s1",    "object_storage"] },
    { predicate: "node",       terms: ["f1",    "static_assets"]  },
    { predicate: "node",       terms: ["cert1", "certificate"]    },
    { predicate: "capability", terms: ["c1",    "edge-delivery"]  },
    { predicate: "capability", terms: ["s1",    "static-origin"]  },
    { predicate: "capability", terms: ["f1",    "static-origin"]  },
    { predicate: "edge",       terms: ["i1",    "d1"]             },
    { predicate: "edge",       terms: ["d1",    "c1"]             },
    { predicate: "edge",       terms: ["c1",    "s1"]             },
    { predicate: "edge",       terms: ["cert1", "c1"]             },
  ];
  const result = evaluate(rules, edb);
  const reqs = requirementResults(result);
  const reqMap = Object.fromEntries(reqs.map(r => [r.id, r.passed]));

  it("static-files-distributed fails", () => expect(reqMap["static-files-distributed"]).toBe(false));
  it("https-certificate still passes", () => expect(reqMap["https-certificate"]).toBe(true));
});

describe("SPA puzzle — missing CDN", () => {
  // DNS routes directly to object_storage — no edge-delivery node in the graph.
  const edb: Fact[] = [
    { predicate: "node",       terms: ["i1",   "internet"]      },
    { predicate: "node",       terms: ["d1",   "dns"]           },
    { predicate: "node",       terms: ["s1",   "object_storage"]},
    { predicate: "node",       terms: ["f1",   "static_assets"] },
    { predicate: "node",       terms: ["cert1","certificate"]   },
    { predicate: "capability", terms: ["s1",   "static-origin"] },
    { predicate: "capability", terms: ["f1",   "static-origin"] },
    { predicate: "edge",       terms: ["i1",   "d1"]            },
    { predicate: "edge",       terms: ["d1",   "s1"]            },
    { predicate: "edge",       terms: ["s1",   "f1"]            },
  ];
  const result = evaluate(rules, edb);
  const reqs = requirementResults(result);
  const caps = capgoalResults(result);
  const reqMap = Object.fromEntries(reqs.map(r => [r.id, r.passed]));
  const capMap = Object.fromEntries(caps.map(r => [r.id, r.passed]));

  it("static-files-distributed passes", () =>
    expect(reqMap["static-files-distributed"]).toBe(true));
  it("https-certificate fails (no edge-delivery node for certificate)", () =>
    expect(reqMap["https-certificate"]).toBe(false));
  it("edge-delivery-present fails", () => expect(capMap["edge-delivery-present"]).toBe(false));
  it("dns-routes-to-delivery fails (no edge-delivery node)", () =>
    expect(capMap["dns-routes-to-delivery"]).toBe(false));
  it("storage-at-origin passes (object_storage has static-origin but no compute-layer)", () =>
    expect(capMap["storage-at-origin"]).toBe(true));
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
