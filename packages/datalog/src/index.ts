export { parseProgram } from "./parser.js";
export { evaluate } from "./evaluator.js";
export { factExists, allFacts, violations, requirementResults } from "./query.js";
export type {
  AstRule,
  AstAtom,
  AstTerm,
  Fact,
  FactSet,
  EvalResult,
  GroundTerm,
} from "./types.js";
export {
  DatalogParseError,
  DatalogStratificationError,
  DatalogSafetyError,
} from "./types.js";
