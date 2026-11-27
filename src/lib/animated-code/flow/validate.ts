/**
 * Flow validation utilities.
 *
 * @module
 */

import type { EvaluatedLine } from "@/lib/animated-code/animation/compile/evaluate"
import { findPatternGlobally, indexLines } from "@/lib/animated-code/animation/compile/pattern-matching"
import { normalizeWord, wordMatchesRef } from "@/lib/text"
import type { StepBuilder } from "./types"

// ============================================================================
// Warning Types
// ============================================================================

export type FlowWarning =
	| {
			type: "word-not-found"
			word: string
			stepName: string
			suggestions?: string[]
	  }
	| {
			type: "pattern-not-found"
			pattern: string
			stepName: string
			annotation: string
	  }
	| { type: "line-id-not-found"; lineId: string; stepName: string }
	| {
			type: "slot-not-found"
			slotName: string
			stepName: string
			availableSlots: string[]
	  }

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate that step words exist in the transcript.
 */
export function validateFlowWords(flow: StepBuilder[], transcriptWords: string[]): FlowWarning[] {
	const warnings: FlowWarning[] = []
	const normalizedTranscript = transcriptWords.map(normalizeWord)

	for (const builder of flow) {
		const step = builder._build()
		const targetWord = normalizeWord(step.word)

		const found = transcriptWords.some((w) => wordMatchesRef(w, step.word))

		if (!found) {
			const suggestions = normalizedTranscript
				.filter((w) => w.includes(targetWord.slice(0, 3)) || targetWord.includes(w.slice(0, 3)))
				.slice(0, 3)

			const warning: FlowWarning = {
				type: "word-not-found",
				word: step.word,
				stepName: step.name ?? step.word,
			}
			if (suggestions.length > 0) {
				warning.suggestions = suggestions
			}
			warnings.push(warning)
		}
	}

	return warnings
}

/** Split rendered code into per-line entries, matching how the runtime compiler indexes lines. */
function indexRenderedCode(code: string) {
	return indexLines(code.split("\n").map((text, i) => ({ id: `__line_${i}__`, text }) as EvaluatedLine))
}

/**
 * Validate annotation patterns exist in rendered code.
 *
 * @param renderedCode - Either one code string used for every step, or one rendered
 *   code string per flow step (index-aligned with `flow`). Per-step code is what the
 *   course compiler passes: each step's annotations must match the snapshot that
 *   step produces, not text that only appears in some other step.
 */
export function validateFlowPatterns(
	flow: StepBuilder[],
	renderedCode: string | readonly string[],
	allLineIds: string[],
): FlowWarning[] {
	const warnings: FlowWarning[] = []
	const lineIdSet = new Set(allLineIds)

	const sharedLines = typeof renderedCode === "string" ? indexRenderedCode(renderedCode) : undefined
	if (typeof renderedCode !== "string" && renderedCode.length !== flow.length) {
		throw new Error(`validateFlowPatterns: expected ${flow.length} rendered steps, got ${renderedCode.length}`)
	}
	let indexedLines = sharedLines ?? []

	const checkPattern = (
		spec: { text: string; nth?: number; after?: string; substring?: boolean },
		stepName: string,
		annotation: string,
	) => {
		const match = findPatternGlobally(indexedLines, spec.text, {
			nth: spec.nth,
			after: spec.after,
			substring: spec.substring,
		})
		if (!match) {
			warnings.push({
				type: "pattern-not-found",
				pattern: spec.text,
				stepName,
				annotation,
			})
		}
	}

	for (const [stepIndex, builder] of flow.entries()) {
		if (typeof renderedCode !== "string") indexedLines = indexRenderedCode(renderedCode[stepIndex])
		const step = builder._build()
		const stepName = step.name ?? step.word
		const ann = step.annotations

		if (ann.cursor) {
			checkPattern(ann.cursor, stepName, "cursor")
		}

		if (ann.burst) {
			checkPattern(ann.burst, stepName, "burst")
		}

		if (ann.bright) {
			for (const spec of ann.bright) {
				checkPattern(spec, stepName, "bright")
			}
		}

		if (ann.glow) {
			for (const spec of ann.glow) {
				checkPattern(spec, stepName, "glow")
			}
		}

		if (ann.squiggle) {
			for (const spec of ann.squiggle) {
				checkPattern(spec, stepName, "squiggle")
			}
		}

		// Validate line-level focus (unified focus uses .lines)
		const focusLines = ann.focus?.lines
		if (focusLines && focusLines._tag === "FocusLines") {
			for (const id of focusLines.ids) {
				if (!lineIdSet.has(id)) {
					warnings.push({ type: "line-id-not-found", lineId: id, stepName })
				}
			}
		}
		if (focusLines && focusLines._tag === "FocusRange") {
			if (!lineIdSet.has(focusLines.from)) {
				warnings.push({
					type: "line-id-not-found",
					lineId: focusLines.from,
					stepName,
				})
			}
			if (!lineIdSet.has(focusLines.to)) {
				warnings.push({
					type: "line-id-not-found",
					lineId: focusLines.to,
					stepName,
				})
			}
		}
		if (focusLines && focusLines._tag === "FocusExcept") {
			for (const id of focusLines.ids) {
				if (!lineIdSet.has(id)) {
					warnings.push({ type: "line-id-not-found", lineId: id, stepName })
				}
			}
		}
		// Validate token-level focus (unified focus uses .tokens)
		if (ann.focus?.tokens) {
			for (const tokenSpec of ann.focus.tokens) {
				checkPattern(tokenSpec, stepName, "focus (token)")
			}
		}
	}

	return warnings
}
