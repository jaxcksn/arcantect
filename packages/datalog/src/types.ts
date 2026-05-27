// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

export type AstTerm =
  | { kind: "const"; value: string }
  | { kind: "var"; name: string }
  | { kind: "wild" };

export interface AstAtom {
  predicate: string;
  terms: AstTerm[];
  negated: boolean;
}

export interface AstRule {
  head: AstAtom; // never negated
  body: AstAtom[]; // may contain negated atoms
}

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

export type GroundTerm = string;

export interface Fact {
  predicate: string;
  terms: GroundTerm[];
}

// Outer key: predicate name
// Inner key: JSON.stringify(GroundTerm[]) for deduplication
export type FactSet = Map<string, Set<string>>;

// ---------------------------------------------------------------------------
// Evaluation result
// ---------------------------------------------------------------------------

export interface EvalResult {
  facts: FactSet;
  /** All tuples derived for this predicate */
  query(predicate: string): GroundTerm[][];
  /** First tuple matching this predicate and pattern (null = wildcard position) */
  queryOne(predicate: string, ...pattern: (string | null)[]): GroundTerm[] | undefined;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class DatalogParseError extends Error {
  constructor(message: string, public line: number) {
    super(`Line ${line}: ${message}`);
    this.name = "DatalogParseError";
  }
}

export class DatalogStratificationError extends Error {
  constructor(public cycle: string[]) {
    super(`Unstratifiable negation cycle: ${cycle.join(" → ")}`);
    this.name = "DatalogStratificationError";
  }
}

export class DatalogSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatalogSafetyError";
  }
}
