# Datalog Scoring System

This document summarizes the current Datalog-based scoring path. It intentionally ignores the older check-expression DSL except where the scorer still merges Datalog output into the existing `ScoreResult` shape.

## High-Level Flow

Scoring starts in `scoreGraph(rawNodes, rawEdges, rubric, puzzleContext)` from `packages/scorer/src/scorer.ts`.

1. Raw client nodes and edges are normalized into scorer-owned `ScorerNode` and `ScorerEdge` records.
2. Zones are inferred for nodes, then edges are annotated with `crossesZone`.
3. The annotated graph is converted into Datalog extensional database facts by `graphToFacts`.
4. The puzzle's `rubric.datalogRules` string is parsed with `parseProgram`.
5. Built-in zone seed facts are prepended to the puzzle rules.
6. The Datalog evaluator derives all reachable facts to a fixpoint.
7. Derived `req(id, outcome)` facts become requirement results.
8. Derived `violation(id, target)` facts become scorer violations.
9. Final `passed` and `perfect` booleans are computed from requirements, violations, bonus state, and optimization budget.

The Datalog path is active only when a compiled `Rubric` has `datalogRules`.

## Fact Model

`graphToFacts` emits the scorer graph as ground facts:

```prolog
node(NodeId, RuneType).
zone(NodeId, Zone).
nodeConfig(NodeId, Key, Value).
edge(SourceNodeId, TargetNodeId).
edgeById(EdgeId, SourceNodeId, TargetNodeId).
edgeMeta(EdgeId, "encrypted", "true").
edgeMeta(EdgeId, "direction", Direction).
edgeMeta(EdgeId, "flowType", FlowType).
edgeMeta(EdgeId, "crossesZone", "true").
puzzleTag(Tag).
```

Only string and boolean node config values are emitted. Boolean values are stringified as `"true"` or `"false"`.

Edges are represented two ways:

- `edge(Source, Target)` captures graph topology for reachability and association rules.
- `edgeById(EdgeId, Source, Target)` captures graph topology in a form that can be joined to edge metadata.
- `edgeMeta(EdgeId, Key, Value)` captures edge attributes, keyed by edge id.

## Built-In Seed Rules

`ZONE_SEED_RULES` is prepended to every puzzle Datalog program. These ground facts classify rune types:

```prolog
publicZoneType("cdn").
privateZoneType("queue").
dataZoneType("database").
softDmzType("compute").
```

These are available for puzzle-authored rules that want to reason about category membership without hard-coding every rune type inline. Separately, actual node zone assignment still comes from the scorer's zone inference step and is emitted as `zone(NodeId, Zone)`.

## Puzzle Rule Contract

Puzzle rules are authored as a string on `rubric.datalogRules`. The SPA puzzle demonstrates the intended style:

```prolog
reaches(X, Y) :- edge(X, Y).
reaches(X, Z) :- edge(X, Y), reaches(Y, Z).

associated(X, Y) :- edge(X, Y).
associated(X, Y) :- edge(Y, X).

req("dns-routes-to-cdn", "pass") :-
  node(R, "dns"), node(C, "cdn"), reaches(R, C).

req("dns-routes-to-cdn", "fail") :-
  !hasDnsToCdn("yes").

violation("unencrypted-cross-zone", E) :-
  edgeMeta(E, "crossesZone", "true"),
  !edgeMeta(E, "encrypted", "true").
```

The scorer recognizes two derived predicates as public outputs:

- `req(id, "pass")` or `req(id, "fail")`
- `violation(id, nodeOrEdgeId)`

`requirementResults()` treats a requirement as passing only when there is a pass fact and no fail fact for the same id. This gives fail facts precedence when both are derived.

`violations()` maps every `violation` tuple to `{ id, nodeId }`. The scorer then converts that into a `Violation` object with a generated message. Despite the helper naming the second field `nodeId`, some rules currently use it for edge ids too, such as `violation("unencrypted-cross-zone", E)`.

## Datalog Language Supported

The interpreter in `packages/datalog` supports a deliberately small Datalog subset:

- String constants: `"cdn"`, `"pass"`
- Variables beginning with uppercase letters: `Node`, `X`, `D1`
- Predicate names beginning with lowercase letters: `node`, `reaches`
- Wildcards: `_`
- Rules: `head(...) :- body(...), body(...).`
- Ground facts: `fact("value").`
- Negation-as-failure in rule bodies: `!predicate(...)`
- Inequality: `X != Y`
- Line comments: `// comment`

The evaluator enforces safety:

- Head variables must be bound by a positive body atom.
- Variables in negated atoms and inequalities must be bound by a positive body atom.
- Wildcards cannot appear in rule heads.
- Ground fact heads can contain only constants.

The evaluator also enforces stratified negation. Recursive negative dependency cycles throw `DatalogStratificationError`.

## Evaluation Semantics

Evaluation is synchronous and deterministic for a given fact/rule set.

1. Ground facts from parsed rules are folded into the EDB.
2. Rules are safety-checked.
3. Predicate dependencies are split into strata using strongly connected components.
4. Each stratum is evaluated to a fixpoint before the next stratum runs.
5. Facts are deduplicated by predicate plus JSON-serialized tuple.

Positive atoms are joined left-to-right. Negated atoms filter bindings after positive joins have produced candidate bindings. Inequality behaves like a built-in positive predicate and succeeds only when both resolved terms differ.

## Requirement Merge Behavior

The scorer still creates initial requirement result objects from the compiled rubric so labels, hints, and bonus flags are preserved. Datalog then updates those result objects by id:

- If Datalog emits a matching `req(id, outcome)`, the existing result's `passed` field is replaced.
- If Datalog emits a new requirement id that was not present in the rubric, the scorer appends a placeholder result with `label` equal to the id, an empty hint, and `bonus: false`.

For a Datalog-first puzzle, every authored requirement should have corresponding `req(id, "pass")` and `req(id, "fail")` derivations so the UI always receives an explicit pass/fail state.

## Pass And Perfect Calculation

After Datalog results are merged:

- `passed` is true when every non-bonus requirement is passed and there are no violations.
- `perfect` is true when `passed` is true, all bonus requirements are passed, an optimization budget exists, and the solution stays within `maxNodes` and `maxEdges`.

Violations are hard blockers for `passed`, even when every requirement passes.

## Current SPA Pattern

The SPA puzzle uses Datalog for graph-wide reasoning that is awkward in simple predicate checks:

- Transitive reachability with `reaches`.
- Undirected attachment semantics with `associated`.
- Reachability that intentionally avoids CDN nodes with `noCdnReach`.
- Negation-backed helper facts such as `hasDnsToCdn("yes")`.
- Explicit fail derivations for missing requirements.
- A cross-zone encryption violation based on `edgeMeta`.

This makes the scoring logic declarative: puzzle authors define the architecture properties they care about, and the evaluator derives requirements and violations from the submitted graph facts.

## Practical Authoring Notes

Prefer deriving helper predicates first, then mapping those helpers into `req` facts. This keeps requirement rules readable and makes negation safer.

Use explicit fail rules for each visible requirement. If a rule only derives pass facts, a missing pass may leave the requirement dependent on legacy fallback behavior.

Bind variables before negation. For example:

```prolog
storageSafe(S) :- node(S, "object_storage"), !directPublicStorage(S).
```

Avoid assuming `violation` targets are always nodes. The current scorer message says `Node <id> violates <rule>` for every non-empty target, even when the target is an edge id.

Add new EDB predicates in `graphToFacts` when puzzle rules need graph attributes that are not currently representable. Do not encode those attributes into predicate names; keep facts regular and joinable.
