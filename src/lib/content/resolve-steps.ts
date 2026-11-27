/**
 * Resolve step references to timestamps at build time.
 *
 * Converts word-based step triggers to numeric timestamps using word timings.
 *
 * @module
 */

import { wordMatchesRef } from "@/lib/text"
import type { StepRef } from "@/lib/tooling/types"

interface WordTiming {
	word: string
	start: number
	end: number
}

const LEAD_TIME = 0.15 // Step triggers slightly before word

/**
 * Find the transcript word a step fires on - the same lookup playback uses.
 *
 * @param ref.word - Target word (case-insensitive, punctuation-stripped, prefix match for 3+ chars)
 * @param ref.nth - Which match to find (1-based, default 1)
 * @param ref.after - Only search after this word (ignored if the anchor is not in the transcript)
 * @returns The word index, or undefined if not found
 */
export function findStepWordIndex(
	ref: { readonly word: string; readonly nth?: number | undefined; readonly after?: string | undefined },
	words: ReadonlyArray<{ readonly word: string }>,
): number | undefined {
	const nth = ref.nth ?? 1
	let startIndex = 0

	if (ref.after) {
		const afterWord = ref.after
		const afterIndex = words.findIndex((w) => wordMatchesRef(w.word, afterWord))
		if (afterIndex !== -1) startIndex = afterIndex + 1
	}

	let found = 0
	for (let i = startIndex; i < words.length; i++) {
		if (wordMatchesRef(words[i].word, ref.word)) {
			found++
			if (found === nth) return i
		}
	}
	return undefined
}

/**
 * Find the start time for a word in the transcript.
 *
 * @returns The word's start time minus lead time, or 0 if not found
 *   (build-time validation should catch missing words earlier)
 */
function findWordTime(
	word: string,
	wordTimings: readonly WordTiming[],
	options?: { nth?: number; after?: string },
): number {
	const index = findStepWordIndex({ word, nth: options?.nth, after: options?.after }, wordTimings)
	return index === undefined ? 0 : Math.max(0, wordTimings[index].start - LEAD_TIME)
}

/**
 * Resolve step references to timestamps.
 *
 * @param steps - Array of step references with word triggers
 * @param wordTimings - Array of word timings from audio alignment
 * @returns Array of timestamps in seconds, parallel to steps array
 */
export function resolveStepTimes(steps: readonly StepRef[], wordTimings: readonly WordTiming[]): number[] {
	const times: number[] = []

	for (const step of steps) {
		if (step.at === "start") {
			times.push(0)
			continue
		}

		const options: { nth?: number; after?: string } = {}
		if (step.nth !== undefined) options.nth = step.nth
		if (step.after !== undefined) options.after = step.after

		const wordTime = findWordTime(step.at, wordTimings, options)

		// Apply step offset if specified
		const offset = step.offset ?? 0
		times.push(Math.max(0, wordTime + offset))
	}

	return times
}
