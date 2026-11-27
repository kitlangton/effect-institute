/**
 * Flow DSL for animated code blocks.
 *
 * Fluent API for defining animation steps triggered by transcript words.
 *
 * @module
 */

export { type CompiledComponentFlow, compileComponentFlow, compileFlow, extractLineIds } from "./compile"
export { on } from "./step-builder"
export type { StepBuilder, StepRef } from "./types"
export { type FlowWarning, validateFlowPatterns, validateFlowWords } from "./validate"
