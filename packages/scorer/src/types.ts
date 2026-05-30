// ---------------------------------------------------------------------------
// Core graph model
// ---------------------------------------------------------------------------

export type FlowType =
  | 'user-request'
  | 'https-request'
  | 'db-query'
  | 'event'
  | 'file-io'
  | 'internal-rpc'
  | 'dns-resolution'
  | 'deployment'

export type EdgeDirection = 'directed' | 'applies' | 'hosts'

export interface ScorerNode {
  id: string
  runeType: string
  label: string
  config: Record<string, unknown>
  capabilities: string[]
  tradeoffs?: Partial<TradeoffProfile>
}

export interface ScorerEdge {
  id: string
  source: string
  target: string
  /** Edges are interpreted as source -> target data flow. */
  direction: EdgeDirection
  flowType: FlowType
  encrypted: boolean
}

// ---------------------------------------------------------------------------
// Annotated graph (fully resolved)
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

export interface CapabilityGoal {
  id: string
  label: string
  hint: string
}

export interface Restriction {
  id: string
  /** Thematic label shown in the side panel — describes what is restricted. */
  label: string
  hint: string
  detect: (graph: AnnotatedGraph) => Violation[]
}

export interface Optimization {
  /** Maximum nodes in the reference (no-bonus) solution. */
  maxNodes: number
  /** Maximum edges in the reference (no-bonus) solution. */
  maxEdges: number
}

// ---------------------------------------------------------------------------
// Tradeoff profile
// ---------------------------------------------------------------------------

export type TradeoffDimension =
  | 'latency'
  | 'cost'
  | 'complexity'
  | 'operability'
  | 'throughput'
  | 'security'
  | 'consistency'
  | 'blastRadius'

/** Signed integer deltas. Positive = better on that dimension. */
export type TradeoffProfile = Record<TradeoffDimension, number>

/** Per-puzzle weights. Dimensions absent from the map are ignored in scoring. */
export type TradeoffWeights = Partial<Record<TradeoffDimension, number>>

// ---------------------------------------------------------------------------
// Rubric
// ---------------------------------------------------------------------------

export interface Rubric {
  hardConstraints: Requirement[]
  capabilityGoals?: CapabilityGoal[]
  tradeoffWeights?: TradeoffWeights
  tradeoffThreshold?: number
  restrictions?: Restriction[]
  /** Optional budget for the ★★★ tier. */
  optimization?: Optimization
  /** Optional Datalog rules string; evaluated in parallel with predicate checks. */
  datalogRules?: string
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface RequirementResult {
  id: string
  label: string
  hint: string
  passed: boolean
  bonus: boolean
}

export interface CapabilityResult {
  id: string
  label: string
  hint: string
  passed: boolean
}

export interface RestrictionResult {
  id: string
  label: string
  hint: string
  /** true when the restriction is upheld (detect produced no violations) */
  passed: boolean
}

// ---------------------------------------------------------------------------
// Restriction violations
// ---------------------------------------------------------------------------

export interface Violation {
  restriction: string
  message: string
  nodeIds?: string[]
  edgeIds?: string[]
}

// ---------------------------------------------------------------------------
// Final evaluation output
// ---------------------------------------------------------------------------

export interface ScoreResult {
  /** Structural diagram violations (from Datalog violation() facts). */
  violations: Violation[]
  hardConstraintResults: RequirementResult[]
  capabilityResults: CapabilityResult[]
  tradeoffProfile: TradeoffProfile
  /** Always populated — one entry per restriction in the rubric. */
  restrictionResults: RestrictionResult[]
  /** true when every non-bonus hard constraint is met, all restrictions hold, and no violations are present */
  passed: boolean
  /** 1 = passed; 2 = passed + all capability goals met; 3 = ★★ + tradeoff score >= threshold + within budget */
  stars: 1 | 2 | 3
}

// ---------------------------------------------------------------------------
// Raw input types — structurally compatible with @xyflow/react Node / Edge
// so the client can pass them directly without an adapter.
// ---------------------------------------------------------------------------

export interface RawNode {
  id: string
  data: Record<string, unknown>
  /** Capabilities injected by the client before passing to scoreGraph. */
  capabilities?: string[]
  /** Tradeoff deltas injected by the client before passing to scoreGraph. */
  tradeoffs?: Partial<TradeoffProfile>
}

export interface RawEdge {
  id: string
  source: string
  target: string
  data?: Record<string, unknown> & { direction?: EdgeDirection }
}
