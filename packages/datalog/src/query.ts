import type { EvalResult, GroundTerm } from "./types.js";

/** True if any fact matches the predicate with the given pattern (null = wildcard). */
export function factExists(
  result: EvalResult,
  predicate: string,
  ...pattern: (string | null)[]
): boolean {
  return result.queryOne(predicate, ...pattern) !== undefined;
}

/** All tuples derived for a predicate. */
export function allFacts(result: EvalResult, predicate: string): GroundTerm[][] {
  return result.query(predicate);
}

/** All violation tuples derived as violation(id, nodeId). */
export function violations(result: EvalResult): Array<{ id: string; nodeId: string }> {
  return result.query("violation").map(tuple => ({
    id: tuple[0] ?? "",
    nodeId: tuple[1] ?? "",
  }));
}

/** All requirement results derived as req(id, "pass") or req(id, "fail"). */
export function requirementResults(
  result: EvalResult,
): Array<{ id: string; passed: boolean }> {
  const passSet = new Set<string>();
  const failSet = new Set<string>();

  for (const tuple of result.query("req")) {
    const [id, outcome] = tuple;
    if (id === undefined) continue;
    if (outcome === "pass") passSet.add(id);
    else if (outcome === "fail") failSet.add(id);
  }

  const allIds = new Set([...passSet, ...failSet]);
  return [...allIds].map(id => ({ id, passed: passSet.has(id) && !failSet.has(id) }));
}

/** All capability goal results derived as capgoal(id, "pass") or capgoal(id, "fail"). */
export function capgoalResults(
  result: EvalResult,
): Array<{ id: string; passed: boolean }> {
  const passSet = new Set<string>();
  const failSet = new Set<string>();

  for (const tuple of result.query("capgoal")) {
    const [id, outcome] = tuple;
    if (id === undefined) continue;
    if (outcome === "pass") passSet.add(id);
    else if (outcome === "fail") failSet.add(id);
  }

  const allIds = new Set([...passSet, ...failSet]);
  return [...allIds].map(id => ({ id, passed: passSet.has(id) && !failSet.has(id) }));
}
