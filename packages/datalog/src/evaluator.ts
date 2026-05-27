import {
  DatalogSafetyError,
  DatalogStratificationError,
} from "./types.js";
import type { AstAtom, AstRule, EvalResult, Fact, FactSet, GroundTerm } from "./types.js";

// ---------------------------------------------------------------------------
// Binding: variable name → ground term
// ---------------------------------------------------------------------------

type Binding = Record<string, GroundTerm>;

// ---------------------------------------------------------------------------
// FactSet helpers
// ---------------------------------------------------------------------------

function addFact(fs: FactSet, predicate: string, terms: GroundTerm[]): boolean {
  let bucket = fs.get(predicate);
  if (!bucket) {
    bucket = new Set();
    fs.set(predicate, bucket);
  }
  const key = JSON.stringify(terms);
  if (bucket.has(key)) return false;
  bucket.add(key);
  return true;
}

function getTuples(fs: FactSet, predicate: string): GroundTerm[][] {
  const bucket = fs.get(predicate);
  if (!bucket) return [];
  return [...bucket].map(k => JSON.parse(k) as GroundTerm[]);
}

// ---------------------------------------------------------------------------
// Term resolution and matching
// ---------------------------------------------------------------------------

function resolveTerm(term: AstAtom["terms"][number], binding: Binding): GroundTerm | null {
  switch (term.kind) {
    case "const": return term.value;
    case "var": return binding[term.name] ?? null;
    case "wild": return null; // wildcards are unresolvable
  }
}

/** Try to unify an atom's terms against a ground tuple under the current binding.
 *  Returns a new binding if successful, null otherwise. */
function matchTuple(
  terms: AstAtom["terms"],
  tuple: GroundTerm[],
  binding: Binding,
): Binding | null {
  if (terms.length !== tuple.length) return null;
  const newBinding: Binding = { ...binding };
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i]!;
    const value = tuple[i]!;
    switch (term.kind) {
      case "wild":
        break; // always matches, never bound
      case "const":
        if (term.value !== value) return null;
        break;
      case "var":
        if (newBinding[term.name] !== undefined) {
          if (newBinding[term.name] !== value) return null;
        } else {
          newBinding[term.name] = value;
        }
        break;
    }
  }
  return newBinding;
}

// ---------------------------------------------------------------------------
// Safety check
// ---------------------------------------------------------------------------

function checkSafety(rules: AstRule[]): void {
  for (const rule of rules) {
    // Variables bound by positive body atoms
    const boundVars = new Set<string>();
    for (const atom of rule.body) {
      if (!atom.negated && atom.predicate !== "!=") {
        for (const term of atom.terms) {
          if (term.kind === "var") boundVars.add(term.name);
        }
      }
    }

    // Head variables must be bound
    for (const term of rule.head.terms) {
      if (term.kind === "wild") {
        throw new DatalogSafetyError(
          `Wildcard '_' may not appear in rule head: ${rule.head.predicate}(...)`,
        );
      }
      if (term.kind === "var" && !boundVars.has(term.name)) {
        throw new DatalogSafetyError(
          `Head variable '${term.name}' in '${rule.head.predicate}' is not bound by any positive body atom`,
        );
      }
    }

    // Negated/inequality atom variables must be bound
    for (const atom of rule.body) {
      if (atom.negated || atom.predicate === "!=") {
        for (const term of atom.terms) {
          if (term.kind === "var" && !boundVars.has(term.name)) {
            throw new DatalogSafetyError(
              `Variable '${term.name}' in ${atom.negated ? "negated" : "inequality"} atom '${atom.predicate}' is not bound by any positive body atom`,
            );
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Stratification via Tarjan's SCC
// ---------------------------------------------------------------------------

interface DepEdge {
  to: string;
  negative: boolean;
}

function computeSCCs(
  nodes: string[],
  adj: Map<string, DepEdge[]>,
): string[][] {
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];
  let counter = 0;

  function strongConnect(v: string): void {
    index.set(v, counter);
    lowlink.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);

    for (const { to: w } of adj.get(v) ?? []) {
      if (!index.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  }

  for (const node of nodes) {
    if (!index.has(node)) strongConnect(node);
  }

  // Tarjan's emits SCCs with dependencies first (EDB before IDB) when edges
  // point from dependent → dependency, which is how we built the graph.
  return sccs;
}

/** Returns rules grouped by stratum, in dependency order (lowest stratum first). */
function stratify(rules: AstRule[], edb: Fact[]): AstRule[][] {
  // Collect all predicate names
  const allPreds = new Set<string>();
  for (const f of edb) allPreds.add(f.predicate);
  for (const rule of rules) {
    allPreds.add(rule.head.predicate);
    for (const atom of rule.body) {
      if (atom.predicate !== "!=") allPreds.add(atom.predicate);
    }
  }

  // Build adjacency list for dependency graph (head depends on body)
  const adj = new Map<string, DepEdge[]>();
  for (const pred of allPreds) adj.set(pred, []);

  for (const rule of rules) {
    const headPred = rule.head.predicate;
    for (const atom of rule.body) {
      if (atom.predicate === "!=") continue;
      adj.get(headPred)!.push({ to: atom.predicate, negative: atom.negated });
    }
  }

  const sccs = computeSCCs([...allPreds], adj);

  // Check each SCC for an internal negative edge (recursive negation → unstratifiable)
  for (const scc of sccs) {
    const sccSet = new Set(scc);
    for (const pred of scc) {
      for (const edge of adj.get(pred) ?? []) {
        if (edge.negative && sccSet.has(edge.to)) {
          throw new DatalogStratificationError(scc);
        }
      }
    }
  }

  // Map predicate → SCC index
  const predToStratum = new Map<string, number>();
  for (let i = 0; i < sccs.length; i++) {
    for (const pred of sccs[i]!) predToStratum.set(pred, i);
  }

  // Group rules by stratum (ground facts with empty body are handled as EDB)
  const stratumRules: AstRule[][] = sccs.map(() => []);
  for (const rule of rules) {
    if (rule.body.length === 0) continue; // ground fact already seeded from EDB
    const stratum = predToStratum.get(rule.head.predicate) ?? 0;
    stratumRules[stratum]!.push(rule);
  }

  return stratumRules;
}

// ---------------------------------------------------------------------------
// Join engine
// ---------------------------------------------------------------------------

function matchPositiveAtom(
  atom: AstAtom,
  fs: FactSet,
  binding: Binding,
): Binding[] {
  // Built-in inequality
  if (atom.predicate === "!=") {
    const v1 = resolveTerm(atom.terms[0]!, binding);
    const v2 = resolveTerm(atom.terms[1]!, binding);
    // Both must be bound (safety guarantee ensures this)
    if (v1 === null || v2 === null) return [];
    return v1 !== v2 ? [binding] : [];
  }

  const tuples = getTuples(fs, atom.predicate);
  const results: Binding[] = [];
  for (const tuple of tuples) {
    const b = matchTuple(atom.terms, tuple, binding);
    if (b !== null) results.push(b);
  }
  return results;
}

function checkNegatedAtom(atom: AstAtom, fs: FactSet, binding: Binding): boolean {
  const tuples = getTuples(fs, atom.predicate);
  for (const tuple of tuples) {
    if (matchTuple(atom.terms, tuple, binding) !== null) return false; // negation fails
  }
  return true; // negation holds
}

function deriveHeadFact(head: AstAtom, binding: Binding): GroundTerm[] | null {
  const terms: GroundTerm[] = [];
  for (const term of head.terms) {
    switch (term.kind) {
      case "const":
        terms.push(term.value);
        break;
      case "var": {
        const v = binding[term.name];
        if (v === undefined) return null;
        terms.push(v);
        break;
      }
      case "wild":
        return null; // safety check should have caught this
    }
  }
  return terms;
}

function applyRule(rule: AstRule, fs: FactSet): GroundTerm[][] {
  // Separate body atoms into positives (including !=) and negated
  const positives = rule.body.filter(a => !a.negated);
  const negated = rule.body.filter(a => a.negated);

  // Join positive atoms left-to-right
  let bindings: Binding[] = [{}];
  for (const atom of positives) {
    const next: Binding[] = [];
    for (const b of bindings) {
      next.push(...matchPositiveAtom(atom, fs, b));
    }
    bindings = next;
    if (bindings.length === 0) break;
  }

  // Filter by negated atoms
  if (negated.length > 0) {
    bindings = bindings.filter(b => negated.every(neg => checkNegatedAtom(neg, fs, b)));
  }

  // Derive head facts
  const results: GroundTerm[][] = [];
  for (const b of bindings) {
    const terms = deriveHeadFact(rule.head, b);
    if (terms !== null) results.push(terms);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Naive fixpoint evaluation per stratum
// ---------------------------------------------------------------------------

function evaluateStratum(rules: AstRule[], fs: FactSet): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of rules) {
      const derived = applyRule(rule, fs);
      for (const terms of derived) {
        if (addFact(fs, rule.head.predicate, terms)) changed = true;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function evaluate(rules: AstRule[], edb: Fact[]): EvalResult {
  // Ground facts in rules (body-less rules) are treated as EDB too
  const allEdb = [
    ...edb,
    ...rules.filter(r => r.body.length === 0).map(r => ({
      predicate: r.head.predicate,
      terms: r.head.terms.map(t => {
        if (t.kind === "const") return t.value;
        throw new DatalogSafetyError("Ground fact head may only contain constants");
      }),
    })),
  ];

  checkSafety(rules.filter(r => r.body.length > 0));

  const fs: FactSet = new Map();
  for (const fact of allEdb) {
    addFact(fs, fact.predicate, fact.terms);
  }

  const strata = stratify(rules, allEdb);
  for (const strataRules of strata) {
    if (strataRules.length > 0) evaluateStratum(strataRules, fs);
  }

  return makeEvalResult(fs);
}

function makeEvalResult(fs: FactSet): EvalResult {
  function query(predicate: string): GroundTerm[][] {
    return getTuples(fs, predicate);
  }

  function queryOne(predicate: string, ...pattern: (string | null)[]): GroundTerm[] | undefined {
    for (const tuple of getTuples(fs, predicate)) {
      if (tuple.length === pattern.length &&
          pattern.every((p, i) => p === null || p === tuple[i])) {
        return tuple;
      }
    }
    return undefined;
  }

  return { facts: fs, query, queryOne };
}
