/**
 * Flow DSL type definitions.
 *
 * Types for the step builder pattern that drives animated code blocks.
 *
 * @module
 */

import { Schema } from "effect"
import type { AnimationSoundName } from "@/sounds/AnimationSounds"

// ============================================================================
// Focus Spec (TaggedClass discriminated union)
// ============================================================================

/** Focus on specific lines by ID */
export class FocusLines extends Schema.TaggedClass<FocusLines>()("FocusLines", {
	ids: Schema.Array(Schema.String),
	persist: Schema.optional(Schema.Boolean),
}) {}

/** Focus on a range of lines (inclusive) */
export class FocusRange extends Schema.TaggedClass<FocusRange>()("FocusRange", {
	from: Schema.String,
	to: Schema.String,
	persist: Schema.optional(Schema.Boolean),
}) {}

/** Focus on all lines except these */
export class FocusExcept extends Schema.TaggedClass<FocusExcept>()("FocusExcept", {
	ids: Schema.Array(Schema.String),
	persist: Schema.optional(Schema.Boolean),
}) {}

/** Focus on all lines (no dimming) */
export class FocusAll extends Schema.TaggedClass<FocusAll>()("FocusAll", {}) {}

/** Focus specification union */
export const FocusSpec = Schema.Union([FocusLines, FocusRange, FocusExcept, FocusAll])
export type FocusSpec = Schema.Schema.Type<typeof FocusSpec>

// ============================================================================
// Annotation Specs (builder input)
// ============================================================================

/** Common options for pattern matching annotations */
export interface PatternMatchOptions {
	/** Which match (1-based). Default: 1 (first). Use 0 for all matches. */
	nth?: number
	/** Only search after this pattern */
	after?: string
	/** Match as substring anywhere (default: false = smart boundary matching) */
	substring?: boolean
}

/** Cursor specification */
export interface CursorSpec extends PatternMatchOptions {
	text: string
	type?: "pointer" | "hand" | "thumbsDown"
	persist?: boolean
}

/** Glow specification */
export interface GlowSpec extends PatternMatchOptions {
	text: string
	color?: string
}

/** Squiggle specification (wavy underline) */
export interface SquiggleSpec extends PatternMatchOptions {
	text: string
	color?: string
	persist?: boolean
}

/** Mark specification (colored highlight rectangle behind text) */
export interface MarkSpec extends PatternMatchOptions {
	text: string
	color?: string
	persist?: boolean
}

/** Burst specification (emoji particles) */
export interface BurstSpec extends PatternMatchOptions {
	text: string
	emoji: string | string[]
	count?: number
	persist?: boolean
}

/** Spotlight specification (legacy - use TokenFocusSpec via unified focus API) */
export interface SpotlightSpec {
	/** Pattern: string for text anywhere, or { line, text? } for line-constrained */
	pattern: string | { line: string; text?: string }
	dim?: number
	glow?: boolean
	persist?: boolean
}

// ============================================================================
// Unified Focus Spec (combines line-level and token-level focus)
// ============================================================================

/** Token-level focus specification (replaces spotlight in unified API) */
export interface TokenFocusSpec extends PatternMatchOptions {
	/** Text pattern to highlight */
	text: string
	/** Optional: constrain to specific line */
	line?: string
	/** Opacity for non-focused tokens (default: 0.4) */
	dim?: number
	/** Add glow effect to focused tokens */
	glow?: boolean
	/** Keep this focus across subsequent steps */
	persist?: boolean
}

/** Unified focus specification combining line-level and token-level focus */
export interface UnifiedFocusSpec {
	/** Line-level focus (dims entire lines) */
	lines?: FocusSpec
	/** Token-level focus (dims tokens within lines) */
	tokens?: TokenFocusSpec[]
}

/** Bright specification (text glow) */
export interface BrightSpec extends PatternMatchOptions {
	text: string
	color?: string
	persist?: boolean
}

/** Status indicator specification */
export interface StatusSpec extends PatternMatchOptions {
	text: string
	status: "running" | "success" | "error" | "interrupted" | "die"
	persist?: boolean
}

// ============================================================================
// Flow Step (what the builder produces)
// ============================================================================

/** Internal representation of a flow step */
export interface FlowStep {
	word: string
	name?: string
	after?: string
	nth?: number
	offset?: number
	slotsDelta: Record<string, string>
	stateDelta?: Record<string, unknown>
	annotations: {
		focus?: UnifiedFocusSpec
		/** @deprecated Use focus with TokenFocusSpec instead */
		spotlight?: SpotlightSpec[]
		cursor?: CursorSpec
		glow?: GlowSpec[]
		squiggle?: SquiggleSpec[]
		mark?: MarkSpec[]
		burst?: BurstSpec
		bright?: BrightSpec[]
		status?: StatusSpec[]
		/** Speech bubble attached to the cursor (transient, one step) */
		say?: string
		sound?: AnimationSoundName
		focusClear?: boolean
		/** @deprecated Unified into focusClear */
		spotlightClear?: boolean
		cursorClear?: boolean
		brightClear?: boolean
		glowClear?: boolean
		squiggleClear?: boolean
		markClear?: boolean
		burstClear?: boolean
		statusClear?: boolean
	}
}

// ============================================================================
// Step Builder Interface
// ============================================================================

/** Input types for unified focus API */
export type FocusInput = string | TokenFocusSpec | { persist?: boolean }

/** Builder interface for flow steps */
export interface StepBuilder {
	as(name: string): StepBuilder
	after(word: string): StepBuilder
	nth(n: number): StepBuilder
	offset(seconds: number): StepBuilder
	slots(delta: Record<string, string>): StepBuilder
	state(delta: Record<string, unknown>): StepBuilder
	/**
	 * Unified focus API - highlights lines or text patterns.
	 *
	 * @example Line-level focus (bare strings = line IDs)
	 * ```typescript
	 * .focus("log")
	 * .focus("line1", "line2")
	 * .focus("a", "b", { persist: true })
	 * ```
	 *
	 * @example Token-level focus (objects with text property)
	 * ```typescript
	 * .focus({ text: "() => {" })
	 * .focus({ line: "close", text: "}" })
	 * .focus({ text: "pattern", dim: 0.5, glow: true })
	 * ```
	 *
	 * @example Mixed (both in one call)
	 * ```typescript
	 * .focus("lineId", { text: "pattern" })
	 * ```
	 */
	focus: {
		(...args: FocusInput[]): StepBuilder
		range(from: string, to: string, opts?: { persist?: boolean }): StepBuilder
		except(...ids: string[]): StepBuilder
		all(): StepBuilder
		clear(): StepBuilder
	}
	/**
	 * @deprecated Use `.focus({ text: "pattern" })` instead
	 */
	spotlight: {
		(
			pattern: string | { line: string; text?: string },
			opts?: { dim?: number; glow?: boolean; persist?: boolean },
		): StepBuilder
		clear(): StepBuilder
	}
	cursor: {
		(
			text: string,
			opts?: {
				nth?: number
				type?: "pointer" | "hand" | "thumbsDown"
				after?: string
				substring?: boolean
				persist?: boolean
			},
		): StepBuilder
		clear(): StepBuilder
	}
	glow(
		text: string,
		opts?: {
			color?: string
			nth?: number
			after?: string
			substring?: boolean
		},
	): StepBuilder
	squiggle: {
		(
			text: string,
			opts?: {
				color?: string
				nth?: number
				after?: string
				substring?: boolean
				persist?: boolean
			},
		): StepBuilder
		clear(): StepBuilder
	}
	/**
	 * Highlight text with a colored rectangle (background + border).
	 *
	 * @example
	 * ```typescript
	 * .mark('{"id":1}', { color: "red" })
	 * ```
	 */
	mark: {
		(
			text: string,
			opts?: {
				color?: string
				nth?: number
				after?: string
				substring?: boolean
				persist?: boolean
			},
		): StepBuilder
		clear(): StepBuilder
	}
	/**
	 * Show a speech bubble under the cursor for this step.
	 *
	 * @example
	 * ```typescript
	 * .cursor("mock", { persist: true }).say("hideous")
	 * ```
	 */
	say(text: string): StepBuilder
	burst: {
		(
			text: string,
			emoji: string | string[],
			opts?: {
				count?: number
				nth?: number
				after?: string
				substring?: boolean
				persist?: boolean
			},
		): StepBuilder
		clear(): StepBuilder
	}
	bright: {
		(
			text: string,
			opts?: {
				nth?: number
				color?: string
				after?: string
				substring?: boolean
				persist?: boolean
			},
		): StepBuilder
		clear(): StepBuilder
	}
	sound(name: AnimationSoundName): StepBuilder
	status: {
		(
			text: string,
			status: "running" | "success" | "error" | "interrupted" | "die",
			opts?: {
				nth?: number
				after?: string
				substring?: boolean
				persist?: boolean
			},
		): StepBuilder
		clear(): StepBuilder
	}
	/**
	 * Apply multiple annotations to the same text target.
	 *
	 * @example
	 * ```typescript
	 * on("TooHigh")
	 *   .focus("sig")
	 *   .at("TooHigh", t => t.bright().cursor().glow({ color: "blue" }))
	 * ```
	 */
	at(
		text: string,
		configure: (builder: AnnotationBuilder) => AnnotationBuilder,
		opts?: PatternMatchOptions,
	): StepBuilder
	_build(): FlowStep
}

/**
 * Builder for grouping multiple annotations on the same text target.
 */
export interface AnnotationBuilder {
	cursor(opts?: { type?: "pointer" | "hand" | "thumbsDown"; persist?: boolean }): AnnotationBuilder
	bright(opts?: { color?: string; persist?: boolean }): AnnotationBuilder
	glow(opts?: { color?: string }): AnnotationBuilder
	squiggle(opts?: { color?: string; persist?: boolean }): AnnotationBuilder
	burst(emoji: string | string[], opts?: { count?: number; persist?: boolean }): AnnotationBuilder
	status(
		status: "running" | "success" | "error" | "interrupted" | "die",
		opts?: { persist?: boolean },
	): AnnotationBuilder
}

// ============================================================================
// Step Reference (compiled output)
// ============================================================================

/** Step reference - triggers snapshot at word */
export interface StepRef {
	readonly name: string
	readonly at: string | "start"
	readonly after?: string
	readonly nth?: number
	readonly offset?: number
}

// ============================================================================
// Re-export sound name type
// ============================================================================

export type { AnimationSoundName } from "@/sounds/AnimationSounds"
