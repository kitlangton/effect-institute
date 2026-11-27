import { describe, expect, it } from "vitest"
import { parseTranscript } from "@/lib/content/compile"
import { mergeTimings } from "@/lib/content/timing-merge"
import {
	charactersToWords,
	coverage,
	estimateTimings,
	interpolateTimings,
	makeTimingsFile,
	mapAlignedToSource,
} from "./timings"

const words = (...ws: string[]) => ws.map((word) => ({ word }))
const timed = (word: string, start: number, end: number) => ({ word, start, end })

describe("mapAlignedToSource", () => {
	it("matches words across punctuation differences", () => {
		const mapped = mapAlignedToSource([timed("Hello", 0, 0.4), timed("world", 0.5, 0.9)], words("Hello,", "world."))
		expect(mapped).toEqual([
			{ sourceIndex: 0, start: 0, end: 0.4 },
			{ sourceIndex: 1, start: 0.5, end: 0.9 },
		])
	})

	it("skips aligned words with no transcript match", () => {
		const mapped = mapAlignedToSource([timed("um", 0, 0.2), timed("yes", 0.3, 0.5)], words("yes"))
		expect(mapped).toEqual([{ sourceIndex: 0, start: 0.3, end: 0.5 }])
	})

	it("joins a transcript word the aligner split in two", () => {
		const mapped = mapAlignedToSource(
			[timed("new", 1, 1.2), timed("Date().", 1.25, 1.6), timed("done", 2, 2.3)],
			words("new Date().", "done"),
		)
		expect(mapped).toEqual([
			{ sourceIndex: 0, start: 1, end: 1.6 },
			{ sourceIndex: 1, start: 2, end: 2.3 },
		])
	})

	it("accepts an aligned word with extra characters", () => {
		const mapped = mapAlignedToSource([timed("Promise<Order>", 0, 1)], words("Promise"))
		expect(mapped).toEqual([{ sourceIndex: 0, start: 0, end: 1 }])
	})
})

describe("interpolateTimings", () => {
	it("returns one span per transcript word and fills gaps between neighbours", () => {
		const spans = interpolateTimings(
			[
				{ sourceIndex: 0, start: 0, end: 1 },
				{ sourceIndex: 2, start: 3, end: 4 },
			],
			4,
		)
		expect(spans).toHaveLength(4)
		expect(spans[1].start).toBeGreaterThanOrEqual(1)
		expect(spans[1].end).toBeLessThanOrEqual(3)
		expect(spans[3].start).toBeGreaterThan(4)
	})

	it("places words before the first match ahead of it", () => {
		const [first] = interpolateTimings([{ sourceIndex: 1, start: 2, end: 2.5 }], 2)
		expect(first.end).toBeLessThanOrEqual(2)
		expect(first.start).toBeGreaterThanOrEqual(0)
	})
})

describe("charactersToWords", () => {
	it("groups characters into words on whitespace", () => {
		const chars = [..."Hi there"]
		const result = charactersToWords({
			characters: chars,
			character_start_times_seconds: chars.map((_, i) => i * 0.1),
			character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.1),
		})
		expect(result.map((w) => w.word)).toEqual(["Hi", "there"])
		expect(result[1].start).toBeCloseTo(0.3)
		expect(result[1].end).toBeCloseTo(0.8)
	})
})

describe("estimateTimings", () => {
	it("spreads monotonic spans across the whole duration", () => {
		const spans = estimateTimings(words("One", "two,", "three.", "Four"), 10)
		expect(spans).toHaveLength(4)
		for (let i = 1; i < spans.length; i++) expect(spans[i].start).toBeGreaterThanOrEqual(spans[i - 1].end)
		expect(spans.at(-1)?.end).toBeCloseTo(10)
		expect(spans[0].start).toBe(0)
	})

	it("handles an empty transcript", () => {
		expect(estimateTimings([], 5)).toEqual([])
	})
})

describe("makeTimingsFile", () => {
	it("writes a file the course builder accepts as matched", () => {
		const { words: parsed } = parseTranscript("Effects are **lazy** descriptions.\n\nRun them with `Effect.runSync`.")
		const file = makeTimingsFile(parsed, estimateTimings(parsed, 4), "estimated")
		const parsedWordTimings = parsed.map((w, i) => ({ ...w, start: i, end: i + 1 }))
		const merged = mergeTimings(JSON.stringify(file), parsedWordTimings)
		expect(merged.status).toBe("matched")
		expect(file.source).toBe("estimated")
	})

	it("is detected as stale after the transcript changes", () => {
		const before = parseTranscript("One two three").words
		const after = parseTranscript("One two four").words
		const file = makeTimingsFile(before, estimateTimings(before, 3), "aligned")
		const merged = mergeTimings(
			JSON.stringify(file),
			after.map((w, i) => ({ ...w, start: i, end: i + 1 })),
		)
		expect(merged.status).toBe("mismatched")
	})

	it("rejects a span count that does not match the transcript", () => {
		expect(() => makeTimingsFile(words("a", "b"), [{ start: 0, end: 1 }], "aligned")).toThrow()
	})
})

describe("coverage", () => {
	it("is the share of transcript words matched directly", () => {
		expect(coverage([{ sourceIndex: 0, start: 0, end: 1 }], 4)).toBe(0.25)
	})
})
