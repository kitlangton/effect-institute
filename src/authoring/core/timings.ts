/**
 * Pure helpers for turning audio timing data into `<section>.timings.json`.
 *
 * Authoring-only: imported by the `bun narrate` commands, never by the app.
 *
 * @module
 */
import { hash } from "@/lib/content/compile"
import { normalizeWord } from "@/lib/text"

export interface TimedWord {
	readonly word: string
	readonly start: number
	readonly end: number
}

export interface MappedTiming {
	readonly sourceIndex: number
	readonly start: number
	readonly end: number
}

export interface Span {
	readonly start: number
	readonly end: number
}

/** Where a timings file came from. "estimated" timings are placeholders that should be aligned later. */
export type TimingsSource = "aligned" | "generated" | "estimated"

export interface TimingsFileContent {
	readonly wordTimings: ReadonlyArray<{ index: number; word: string; start: number; end: number }>
	readonly textHash: string
	readonly wordCount: number
	readonly source: TimingsSource
}

/**
 * Map aligned words from an alignment service back to transcript word indices.
 *
 * Greedy and forward-only. Handles punctuation differences, words the service skipped,
 * and transcript words the service split ("new Date()." aligned as ["new", "Date."]).
 */
export function mapAlignedToSource(
	alignedWords: ReadonlyArray<TimedWord>,
	sourceWords: ReadonlyArray<{ readonly word: string }>,
): MappedTiming[] {
	const result: MappedTiming[] = []
	let sourceIdx = 0
	let alignedIdx = 0

	while (alignedIdx < alignedWords.length) {
		const aligned = alignedWords[alignedIdx]
		const normAligned = normalizeWord(aligned.word)
		let foundIdx = -1
		let consumeCount = 1
		let endTime = aligned.end

		for (let i = sourceIdx; i < sourceWords.length; i++) {
			const normSource = normalizeWord(sourceWords[i].word)

			if (normSource === normAligned) {
				foundIdx = i
				break
			}

			// The service split one transcript word into several aligned words.
			if (normAligned.length > 0 && normSource.startsWith(normAligned) && normSource.length > normAligned.length) {
				let accumulated = normAligned
				for (let j = alignedIdx + 1; j < alignedWords.length; j++) {
					const next = normalizeWord(alignedWords[j].word)
					const withSpace = `${accumulated} ${next}`
					const joined = accumulated + next
					const candidate = normSource.startsWith(withSpace) ? withSpace : normSource.startsWith(joined) ? joined : null
					if (candidate === null) break
					accumulated = candidate
					consumeCount = j - alignedIdx + 1
					endTime = alignedWords[j].end
					if (candidate === normSource) break
				}
				foundIdx = i
				break
			}

			// The aligned word carries extra characters, e.g. aligned "Promise<Order>" for source "Promise".
			if (normSource.length >= 3 && normAligned.startsWith(normSource)) {
				foundIdx = i
				break
			}
		}

		if (foundIdx === -1) {
			alignedIdx++
			continue
		}
		result.push({ sourceIndex: foundIdx, start: aligned.start, end: endTime })
		sourceIdx = foundIdx + 1
		alignedIdx += consumeCount
	}

	return result
}

/** Fill timings for transcript words that had no direct match, interpolating between neighbours. */
export function interpolateTimings(mapped: ReadonlyArray<MappedTiming>, totalSourceWords: number): Span[] {
	const byIndex = new Map(mapped.map((t) => [t.sourceIndex, { start: t.start, end: t.end }]))
	const result: Span[] = []

	for (let i = 0; i < totalSourceWords; i++) {
		const direct = byIndex.get(i)
		if (direct) {
			result.push(direct)
			continue
		}

		let prevIdx = -1
		for (let j = i - 1; j >= 0; j--) {
			if (byIndex.has(j)) {
				prevIdx = j
				break
			}
		}
		let nextIdx = -1
		for (let j = i + 1; j < totalSourceWords; j++) {
			if (byIndex.has(j)) {
				nextIdx = j
				break
			}
		}
		const prev = prevIdx >= 0 ? byIndex.get(prevIdx) : undefined
		const next = nextIdx >= 0 ? byIndex.get(nextIdx) : undefined

		if (prev && next) {
			const slot = (next.start - prev.end) / (nextIdx - prevIdx)
			const pos = i - prevIdx
			result.push({ start: Math.max(0, prev.end + slot * (pos - 0.5)), end: prev.end + slot * (pos + 0.5) })
		} else if (prev) {
			const duration = prev.end - prev.start
			const start = prev.end + duration * 0.1
			result.push({ start, end: start + duration })
		} else if (next) {
			const duration = next.end - next.start
			const end = next.start - duration * 0.1
			result.push({ start: Math.max(0, end - duration), end: Math.max(0, end) })
		} else {
			result.push({ start: i, end: i + 1 })
		}
	}

	return result
}

/** Group character-level timestamps (ElevenLabs text-to-speech) into whitespace-separated words. */
export function charactersToWords(alignment: {
	readonly characters: ReadonlyArray<string>
	readonly character_start_times_seconds: ReadonlyArray<number>
	readonly character_end_times_seconds: ReadonlyArray<number>
}): TimedWord[] {
	const words: TimedWord[] = []
	let current = ""
	let start = 0
	let end = 0

	alignment.characters.forEach((char, i) => {
		if (/\s/.test(char)) {
			if (current.length > 0) words.push({ word: current, start, end })
			current = ""
			return
		}
		if (current.length === 0) start = alignment.character_start_times_seconds[i] ?? end
		current += char
		end = alignment.character_end_times_seconds[i] ?? start
	})
	if (current.length > 0) words.push({ word: current, start, end })
	return words
}

/**
 * Placeholder timings spread across durationSeconds, weighted by word length with a pause after
 * punctuation. Good enough to hear a take and watch steps fire; replace them with "narrate align".
 */
export function estimateTimings(words: ReadonlyArray<{ readonly word: string }>, durationSeconds: number): Span[] {
	if (words.length === 0) return []
	const weights = words.map(({ word }) => ({
		speak: Math.max(2, normalizeWord(word).length) + 1,
		pause: /[.!?]$/.test(word) ? 3 : /[,;:]$/.test(word) ? 1.5 : 0,
	}))
	const total = weights.reduce((sum, w) => sum + w.speak + w.pause, 0)
	const unit = Math.max(0, durationSeconds) / total

	const spans: Span[] = []
	let cursor = 0
	for (const w of weights) {
		const end = cursor + w.speak * unit
		spans.push({ start: cursor, end })
		cursor = end + w.pause * unit
	}
	return spans
}

/**
 * Serialize timings in the format the course builder merges (mergeTimings): one entry per transcript word,
 * keyed by index, plus a hash of the transcript so the build detects stale timings after an edit.
 */
export function makeTimingsFile(
	words: ReadonlyArray<{ readonly word: string }>,
	spans: ReadonlyArray<Span>,
	source: TimingsSource,
): TimingsFileContent {
	if (spans.length !== words.length) {
		throw new Error(`Expected ${words.length} timings, got ${spans.length}`)
	}
	const round = (n: number) => Math.round(n * 1000) / 1000
	return {
		wordTimings: words.map((w, index) => {
			const start = round(Math.max(0, spans[index].start))
			return { index, word: w.word, start, end: Math.max(start, round(spans[index].end)) }
		}),
		textHash: hash(words.map((w) => w.word).join(" ")),
		wordCount: words.length,
		source,
	}
}

/** Fraction of transcript words the aligner matched directly; the rest were interpolated. */
export const coverage = (mapped: ReadonlyArray<MappedTiming>, totalSourceWords: number) =>
	totalSourceWords === 0 ? 0 : new Set(mapped.map((m) => m.sourceIndex)).size / totalSourceWords
