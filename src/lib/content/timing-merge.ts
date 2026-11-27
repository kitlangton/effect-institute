/**
 * Timing merge utilities.
 *
 * Merges AI-generated word timings with DSL transcript data.
 * Pure functions - no file I/O.
 *
 * @module
 */

import { WordStyle, WordTiming } from "@/lib/tooling/types"
import type { ParsedWordTiming, TimingsFile } from "./compile"
import { hashMatches } from "./compile"

// ============================================================================
// Types
// ============================================================================

export type TimingsStatus = "none" | "matched" | "mismatched"

export type MismatchReason = "word-count" | "content-changed" | "invalid-timings"

export interface TimingMergeResult {
	readonly wordTimings: WordTiming[]
	readonly status: TimingsStatus
	/** Mismatch details if status is "mismatched" */
	readonly mismatch?: {
		readonly reason: MismatchReason
		readonly timingsWordCount: number
		readonly dslWordCount: number
	}
}

// ============================================================================
// Merge Function
// ============================================================================

/**
 * Helper to create fallback word timings from parsed words.
 */
function createFallbackTimings(parsedWords: readonly ParsedWordTiming[]): WordTiming[] {
	return parsedWords.map(
		(w) =>
			new WordTiming({
				word: w.word,
				start: w.start,
				end: w.end,
				style: w.style ? new WordStyle(w.style) : undefined,
				paragraphBreak: w.paragraphBreak,
				listItem: w.listItem,
				definition: w.definition,
				link: w.link,
				suffix: w.suffix,
			}),
	)
}

function isTimingsFile(value: unknown): value is TimingsFile {
	if (typeof value !== "object" || value === null) return false
	const candidate = value as Record<string, unknown>
	return (
		Number.isInteger(candidate.wordCount) &&
		(candidate.textHash === undefined || typeof candidate.textHash === "string") &&
		Array.isArray(candidate.wordTimings) &&
		candidate.wordTimings.every((timing) => typeof timing === "object" && timing !== null)
	)
}

/**
 * Merge timings content with DSL parsed words.
 * Pure function - caller handles file I/O.
 *
 * @param timingsContent - JSON string content of .timings.json file, or null if file doesn't exist
 * @param parsedWords - Parsed words from DSL transcript
 * @returns Merged word timings with status
 */
export function mergeTimings(
	timingsContent: string | null,
	parsedWords: readonly ParsedWordTiming[],
): TimingMergeResult {
	if (timingsContent === null) {
		// No timings file - use DSL parsed words with placeholder timings
		return {
			wordTimings: createFallbackTimings(parsedWords),
			status: "none",
		}
	}

	const dslWordCount = parsedWords.length
	const invalidTimings = (timingsWordCount = 0): TimingMergeResult => ({
		wordTimings: createFallbackTimings(parsedWords),
		status: "mismatched",
		mismatch: { reason: "invalid-timings", timingsWordCount, dslWordCount },
	})

	let timingsData: TimingsFile
	try {
		const parsed: unknown = JSON.parse(timingsContent)
		if (!isTimingsFile(parsed)) return invalidTimings()
		timingsData = parsed
	} catch {
		return invalidTimings()
	}

	if (timingsData.wordCount !== dslWordCount) {
		// Word count changed - transcript was edited
		return {
			wordTimings: createFallbackTimings(parsedWords),
			status: "mismatched",
			mismatch: {
				reason: "word-count",
				timingsWordCount: timingsData.wordCount,
				dslWordCount,
			},
		}
	}

	// Check content hash (same count but different words). Accepts the legacy 32-bit
	// format so timings files aligned before the SHA-256 switch stay valid.
	if (timingsData.textHash && !hashMatches(timingsData.textHash, parsedWords.map((w) => w.word).join(" "))) {
		return {
			wordTimings: createFallbackTimings(parsedWords),
			status: "mismatched",
			mismatch: {
				reason: "content-changed",
				timingsWordCount: timingsData.wordCount,
				dslWordCount,
			},
		}
	}

	const validIndices = new Set(timingsData.wordTimings.map((timing) => timing.index))
	const isValidTimings =
		timingsData.wordTimings.length === dslWordCount &&
		validIndices.size === dslWordCount &&
		timingsData.wordTimings.every(
			(timing) =>
				Number.isInteger(timing.index) &&
				timing.index >= 0 &&
				timing.index < dslWordCount &&
				Number.isFinite(timing.start) &&
				Number.isFinite(timing.end) &&
				timing.start >= 0 &&
				timing.end >= timing.start,
		)
	if (!isValidTimings) {
		return invalidTimings(timingsData.wordTimings.length)
	}

	// Index-based merge: lookup DSL word by index
	const wordTimings = timingsData.wordTimings.map((timing) => {
		const parsed = parsedWords[timing.index]
		return new WordTiming({
			word: parsed.word, // Use DSL word (canonical)
			start: timing.start,
			end: timing.end,
			style: parsed?.style ? new WordStyle(parsed.style) : undefined,
			paragraphBreak: parsed?.paragraphBreak,
			listItem: parsed?.listItem,
			definition: parsed?.definition,
			link: parsed?.link,
			suffix: parsed?.suffix,
		})
	})

	return {
		wordTimings,
		status: "matched",
	}
}
