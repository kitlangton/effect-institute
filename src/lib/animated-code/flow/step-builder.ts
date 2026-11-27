/**
 * Step builder implementation.
 *
 * Fluent API for defining animation steps triggered by transcript words.
 *
 * @module
 */

import type { AnimationSoundName, CursorType, StatusKind } from "@/lib/animated-code/annotations"
import {
	type AnnotationBuilder,
	type FlowStep,
	FocusAll,
	FocusExcept,
	type FocusInput,
	FocusLines,
	FocusRange,
	type PatternMatchOptions,
	type StepBuilder,
	type TokenFocusSpec,
	type UnifiedFocusSpec,
} from "./types"

// ============================================================================
// Annotation Builder Implementation
// ============================================================================

/** `.at()`'s builder: each call is the step's own annotation method on the shared target */
class TargetBuilder implements AnnotationBuilder {
	constructor(
		private readonly step: StepBuilder,
		private readonly text: string,
		private readonly opts: PatternMatchOptions,
	) {}

	cursor(opts?: { type?: CursorType; persist?: boolean }): AnnotationBuilder {
		this.step.cursor(this.text, { ...this.opts, ...opts })
		return this
	}

	bright(opts?: { color?: string; persist?: boolean }): AnnotationBuilder {
		this.step.bright(this.text, { ...this.opts, ...opts })
		return this
	}

	glow(opts?: { color?: string }): AnnotationBuilder {
		this.step.glow(this.text, { ...this.opts, ...opts })
		return this
	}

	squiggle(opts?: { color?: string; persist?: boolean }): AnnotationBuilder {
		this.step.squiggle(this.text, { ...this.opts, ...opts })
		return this
	}

	mark(opts?: { color?: string; persist?: boolean }): AnnotationBuilder {
		this.step.mark(this.text, { ...this.opts, ...opts })
		return this
	}

	burst(emoji: string | string[], opts?: { count?: number; persist?: boolean }): AnnotationBuilder {
		this.step.burst(this.text, emoji, { ...this.opts, ...opts })
		return this
	}

	status(status: StatusKind, opts?: { persist?: boolean }): AnnotationBuilder {
		this.step.status(this.text, status, { ...this.opts, ...opts })
		return this
	}
}

// ============================================================================
// Builder Implementation
// ============================================================================

class StepBuilderImpl implements StepBuilder {
	private step: FlowStep

	constructor(word: string) {
		this.step = {
			word,
			slotsDelta: {},
			annotations: {},
		}
	}

	as(name: string): StepBuilder {
		this.step.name = name
		return this
	}

	after(word: string): StepBuilder {
		this.step.after = word
		return this
	}

	nth(n: number): StepBuilder {
		this.step.nth = n
		return this
	}

	offset(seconds: number): StepBuilder {
		this.step.offset = seconds
		return this
	}

	slots(delta: Record<string, string>): StepBuilder {
		this.step.slotsDelta = { ...this.step.slotsDelta, ...delta }
		return this
	}

	state(delta: Record<string, unknown>): StepBuilder {
		this.step.stateDelta = { ...this.step.stateDelta, ...delta }
		return this
	}

	/**
	 * Helper to check if an object is a TokenFocusSpec (has `text` property)
	 */
	private isTokenFocusSpec(arg: FocusInput): arg is TokenFocusSpec {
		return typeof arg === "object" && arg !== null && "text" in arg
	}

	/**
	 * Helper to check if an object is just options (has `persist` but no `text`)
	 */
	private isOptionsOnly(arg: FocusInput): arg is { persist?: boolean } {
		return typeof arg === "object" && arg !== null && !("text" in arg)
	}

	/**
	 * Helper to ensure focus annotation exists
	 */
	private ensureFocus(): UnifiedFocusSpec {
		if (!this.step.annotations.focus) {
			this.step.annotations.focus = {}
		}
		return this.step.annotations.focus
	}

	focus = Object.assign(
		(...args: FocusInput[]): StepBuilder => {
			const lineIds: string[] = []
			const tokens: TokenFocusSpec[] = []
			let linePersist = false

			for (const arg of args) {
				if (typeof arg === "string") {
					lineIds.push(arg)
				} else if (this.isTokenFocusSpec(arg)) {
					tokens.push(arg)
				} else if (this.isOptionsOnly(arg)) {
					linePersist = arg.persist ?? false
				}
			}

			// Accumulate into existing focus spec
			const existing = this.ensureFocus()

			// Line-level focus: new call replaces (can only have one line focus type)
			if (lineIds.length > 0) {
				existing.lines = new FocusLines(linePersist ? { ids: lineIds, persist: true } : { ids: lineIds })
			}

			// Token-level focus: accumulate across multiple calls
			if (tokens.length > 0) {
				if (!existing.tokens) {
					existing.tokens = []
				}
				existing.tokens.push(...tokens)
			}

			return this
		},
		{
			range: (from: string, to: string, opts?: { persist?: boolean }): StepBuilder => {
				const spec = this.ensureFocus()
				spec.lines = new FocusRange(opts?.persist ? { from, to, persist: true } : { from, to })
				return this
			},
			except: (...ids: string[]): StepBuilder => {
				const spec = this.ensureFocus()
				spec.lines = new FocusExcept({ ids })
				return this
			},
			all: (): StepBuilder => {
				const spec = this.ensureFocus()
				spec.lines = new FocusAll({})
				return this
			},
			clear: (): StepBuilder => {
				this.step.annotations.focusClear = true
				return this
			},
		},
	)

	cursor = Object.assign(
		(
			text: string,
			opts?: {
				nth?: number
				type?: CursorType
				after?: string
				substring?: boolean
				persist?: boolean
			},
		): StepBuilder => {
			this.step.annotations.cursor = { text, ...opts }
			return this
		},
		{
			clear: (): StepBuilder => {
				this.step.annotations.cursorClear = true
				return this
			},
		},
	)

	glow(
		text: string,
		opts?: {
			color?: string
			nth?: number
			after?: string
			substring?: boolean
		},
	): StepBuilder {
		if (!this.step.annotations.glow) {
			this.step.annotations.glow = []
		}
		this.step.annotations.glow.push({ text, ...opts })
		return this
	}

	squiggle = Object.assign(
		(
			text: string,
			opts?: {
				color?: string
				nth?: number
				after?: string
				substring?: boolean
				persist?: boolean
			},
		): StepBuilder => {
			if (!this.step.annotations.squiggle) {
				this.step.annotations.squiggle = []
			}
			this.step.annotations.squiggle.push({ text, ...opts })
			return this
		},
		{
			clear: (): StepBuilder => {
				this.step.annotations.squiggleClear = true
				return this
			},
		},
	)

	mark = Object.assign(
		(
			text: string,
			opts?: {
				color?: string
				nth?: number
				after?: string
				substring?: boolean
				persist?: boolean
			},
		): StepBuilder => {
			if (!this.step.annotations.mark) {
				this.step.annotations.mark = []
			}
			this.step.annotations.mark.push({ text, ...opts })
			return this
		},
		{
			clear: (): StepBuilder => {
				this.step.annotations.markClear = true
				return this
			},
		},
	)

	say(text: string): StepBuilder {
		this.step.annotations.say = text
		return this
	}

	burst = Object.assign(
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
		): StepBuilder => {
			this.step.annotations.burst = { text, emoji, ...opts }
			return this
		},
		{
			clear: (): StepBuilder => {
				this.step.annotations.burstClear = true
				return this
			},
		},
	)

	bright = Object.assign(
		(
			text: string,
			opts?: {
				nth?: number
				color?: string
				after?: string
				substring?: boolean
				persist?: boolean
			},
		): StepBuilder => {
			if (!this.step.annotations.bright) {
				this.step.annotations.bright = []
			}
			this.step.annotations.bright.push({ text, ...opts })
			return this
		},
		{
			clear: (): StepBuilder => {
				this.step.annotations.brightClear = true
				return this
			},
		},
	)

	sound(name: AnimationSoundName): StepBuilder {
		this.step.annotations.sound = name
		return this
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
	): StepBuilder {
		configure(new TargetBuilder(this, text, opts ?? {}))
		return this
	}

	status = Object.assign(
		(
			text: string,
			status: StatusKind,
			opts?: {
				nth?: number
				after?: string
				substring?: boolean
				persist?: boolean
			},
		): StepBuilder => {
			if (!this.step.annotations.status) {
				this.step.annotations.status = []
			}
			this.step.annotations.status.push({ text, status, ...opts })
			return this
		},
		{
			clear: (): StepBuilder => {
				this.step.annotations.statusClear = true
				return this
			},
		},
	)

	_build(): FlowStep {
		return this.step
	}
}

// ============================================================================
// Entry Point
// ============================================================================

/**
 * Options for the `on()` function.
 */
export interface OnOptions {
	/** Only trigger after this word appears first */
	after?: string
	/** Which match to trigger on (1-based, default 1) */
	nth?: number
	/** Offset in seconds from the word timing */
	offset?: number
}

/**
 * Start defining a step triggered by a word in the transcript.
 *
 * @example
 * ```typescript
 * // Basic usage
 * on("try/catch")
 *   .slots({ tryBlock: "shown" })
 *   .focus.range("try", "catchClose")
 *
 * // With options
 * on("one", { after: "by" })
 *   .focus("sig")
 *   .cursor("TooHigh")
 * ```
 */
export function on(word: string, opts?: OnOptions): StepBuilder {
	const builder = new StepBuilderImpl(word)
	if (opts?.after) builder.after(opts.after)
	if (opts?.nth) builder.nth(opts.nth)
	if (opts?.offset) builder.offset(opts.offset)
	return builder
}
