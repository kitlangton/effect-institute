/**
 * Flow DSL for animated code blocks.
 *
 * Fluent API for defining animation steps triggered by transcript words.
 *
 * @module
 */

// Compilation
export {
	type CompiledComponentFlow,
	compileComponentFlow,
	compileFlow,
	extractLineIds,
	extractSlotDefaults,
	resolveFocus,
} from "./compile"
// Persistence utilities
export { Persistent, PersistentArray } from "./persistence"
// Builder
export { on, step } from "./step-builder"
// Types
export {
	type BrightSpec,
	type BurstSpec,
	type CursorSpec,
	type FlowStep,
	FocusAll,
	FocusExcept,
	FocusLines,
	FocusRange,
	FocusSpec,
	type GlowSpec,
	type PatternMatchOptions,
	type SpotlightSpec,
	type SquiggleSpec,
	type StatusSpec,
	type StepBuilder,
	type StepRef,
} from "./types"
// Validation
export {
	type FlowWarning,
	validateFlowPatterns,
	validateFlowWords,
} from "./validate"
