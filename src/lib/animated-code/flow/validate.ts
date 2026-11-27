/**
 * Flow validation utilities.
 *
 * @module
 */

import type { Animation, Snapshot } from "@/lib/animated-code/animation/animation"
import { evaluateLines } from "@/lib/animated-code/animation/compile/evaluate"
import { type AnnotationMiss, resolveAnnotations, type TargetKind } from "@/lib/animated-code/animation/compile/resolve"
import { normalizeWord, wordMatchesRef } from "@/lib/text"
import { extractLineIds } from "./compile"
import type { FocusSpec, StepBuilder } from "./types"

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

/** Line IDs a line focus names */
function focusLineIds(focus: FocusSpec | undefined): readonly string[] {
	switch (focus?._tag) {
		case "FocusLines":
		case "FocusExcept":
			return focus.ids
		case "FocusRange":
			return [focus.from, focus.to]
		default:
			return []
	}
}

const ANNOTATION_LABEL: Record<TargetKind, string> = {
	cursor: "cursor",
	burst: "burst",
	bright: "bright",
	glow: "glow",
	squiggle: "squiggle",
	mark: "mark",
	status: "status",
	spotlight: "focus (token)",
}

const patternOf = (target: AnnotationMiss["target"]): string => {
	if (typeof target === "string") return target
	if (!("line" in target)) return target.text
	return target.text === undefined ? `line ${target.line}` : `${target.text} (line ${target.line})`
}

/**
 * Check every annotation against the code its step shows, exactly as the compiler resolves it,
 * and every line ID a line focus names. `snapshots` is compileFlow's output: the base state,
 * then one per flow step. An annotation that persists while missing is reported at the first
 * step it misses.
 */
export function validateFlowPatterns(
	animation: Animation,
	flow: readonly StepBuilder[],
	snapshots: readonly Snapshot[],
): FlowWarning[] {
	if (snapshots.length !== flow.length + 1) {
		throw new Error(`validateFlowPatterns: expected ${flow.length + 1} snapshots, got ${snapshots.length}`)
	}
	const lineIds = new Set(extractLineIds(animation))
	const warnings: FlowWarning[] = []
	let missedBefore = new Set<string>()

	for (const [i, builder] of flow.entries()) {
		const step = builder._build()
		const stepName = step.name ?? step.word
		const snapshot = snapshots[i + 1]
		const { missing } = resolveAnnotations(evaluateLines(animation, snapshot.slots), snapshot.annotations)

		const missed = new Set<string>()
		for (const miss of missing) {
			const key = JSON.stringify([miss.kind, miss.target])
			missed.add(key)
			if (missedBefore.has(key)) continue
			warnings.push({
				type: "pattern-not-found",
				pattern: patternOf(miss.target),
				stepName,
				annotation: ANNOTATION_LABEL[miss.kind],
			})
		}
		missedBefore = missed

		for (const lineId of focusLineIds(step.annotations.focus?.lines)) {
			if (!lineIds.has(lineId)) warnings.push({ type: "line-id-not-found", lineId, stepName })
		}
	}

	return warnings
}
