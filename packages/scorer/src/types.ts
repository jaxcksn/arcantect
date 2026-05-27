// ---------------------------------------------------------------------------
// Core graph model
// ---------------------------------------------------------------------------

export type Zone = 'public' | 'dmz' | 'private' | 'data'

export type FlowType =
  | 'user-request'
  | 'https-request'
  | 'db-query'
  | 'event'
  | 'file-io'
  | 'internal-rpc'
  | 'dns-resolution'

export type EdgeDirection = 'directed' | 'applies'

export interface ScorerNode {
  id: string
  runeType: string
  label: string
  config: Record<string, unknown>
  zone?: Zone
}

export interface ScorerEdge {
  id: string
  source: string
  target: string
  /** Edges are interpreted as source -> target data flow. */
  direction: EdgeDirection
  flowType: FlowType
  encrypted: boolean
  crossesZone: boolean
}

// ---------------------------------------------------------------------------
// Annotated graph (fully resolved — zones set, edges annotated)
// ---------------------------------------------------------------------------

export interface AnnotatedGraph {
  nodes: ScorerNode[]
  edges: ScorerEdge[]
  puzzle: PuzzleContext
}

// ---------------------------------------------------------------------------
// Puzzle / rubric
// ---------------------------------------------------------------------------

export interface PuzzleContext {
  tags: string[]
}

export interface Requirement {
  id: string
  /** Thematic wizard-language label shown live in the side panel. */
  label: string
  hint: string
  bonus?: boolean
}

export interface AntiPattern {
  id: string
  detect: (graph: AnnotatedGraph) => Violation[]
}

export interface Optimization {
  /** Maximum nodes in the reference (no-bonus) solution. */
  maxNodes: number
  /** Maximum edges in the reference (no-bonus) solution. */
  maxEdges: number
}

export interface Rubric {
  requirements: Requirement[]
  antiPatterns?: AntiPattern[]
  /** Optional budget for the "perfect" tier. */
  optimization?: Optimization
  /** Optional Datalog rules string; evaluated in parallel with predicate checks. */
  datalogRules?: string
}

export interface RequirementResult {
  id: string
  label: string
  hint: string
  passed: boolean
  bonus: boolean
}

// ---------------------------------------------------------------------------
// Anti-pattern violations
// ---------------------------------------------------------------------------

export interface Violation {
  antipattern: string
  message: string
  nodeIds?: string[]
  edgeIds?: string[]
}

// ---------------------------------------------------------------------------
// Final evaluation output
// ---------------------------------------------------------------------------

export interface ScoreResult {
  violations: Violation[]
  requirementResults: RequirementResult[]
  /** true when every non-bonus requirement is met and no violations are present */
  passed: boolean
  /** true when passed, every bonus requirement is met, and the solution is within the puzzle's optimization budget */
  perfect: boolean
}

// ---------------------------------------------------------------------------
// Raw input types — structurally compatible with @xyflow/react Node / Edge
// so the client can pass them directly without an adapter.
// ---------------------------------------------------------------------------

export interface RawNode {
  id: string
  data: Record<string, unknown>
}

export interface RawEdge {
  id: string
  source: string
  target: string
  data?: Record<string, unknown> & { direction?: EdgeDirection }
}
