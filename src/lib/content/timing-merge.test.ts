import { describe, expect, it } from "vitest"
import type { ParsedWordTiming, TimingsFile } from "./compile"
import { hash } from "./compile"
import { mergeTimings } from "./timing-merge"

describe("mergeTimings", () => {
	const makeParsedWords = (words: string[]): ParsedWordTiming[] =>
		words.map((word, i) => ({
			word,
			start: i,
			end: i + 1,
		}))

	const makeTimingsContent = (words: string[], overrides: Partial<TimingsFile> = {}): string => {
		const timingsFile: TimingsFile = {
			wordTimings: words.map((word, i) => ({
				index: i,
				word,
				start: i * 0.5,
				end: (i + 1) * 0.5,
			})),
			textHash: hash(words.join(" ")),
			wordCount: words.length,
			...overrides,
		}
		return JSON.stringify(timingsFile)
	}

	describe("when timings content is null (no file)", () => {
		it("returns status 'none' with placeholder timings", () => {
			const parsedWords = makeParsedWords(["hello", "world"])
			const result = mergeTimings(null, parsedWords)

			expect(result.status).toBe("none")
			expect(result.wordTimings).toHaveLength(2)
			expect(result.wordTimings[0].word).toBe("hello")
			expect(result.wordTimings[0].start).toBe(0)
			expect(result.wordTimings[1].word).toBe("world")
			expect(result.mismatch).toBeUndefined()
		})

		it("preserves styles in fallback", () => {
			const parsedWords: ParsedWordTiming[] = [
				{ word: "bold", start: 0, end: 1, style: { bold: true } },
				{ word: "normal", start: 1, end: 2 },
			]
			const result = mergeTimings(null, parsedWords)

			expect(result.wordTimings[0].style).toEqual({ bold: true })
			expect(result.wordTimings[1].style).toBeUndefined()
		})

		it("preserves paragraph breaks in fallback", () => {
			const parsedWords: ParsedWordTiming[] = [
				{ word: "end", start: 0, end: 1, paragraphBreak: true },
				{ word: "start", start: 1, end: 2 },
			]
			const result = mergeTimings(null, parsedWords)

			expect(result.wordTimings[0].paragraphBreak).toBe(true)
			expect(result.wordTimings[1].paragraphBreak).toBeUndefined()
		})
	})

	it("rejects matched metadata with missing timing entries", () => {
		const parsedWords = makeParsedWords(["hello", "world"])
		const timings = makeTimingsContent(["hello", "world"], { wordTimings: [] })

		const result = mergeTimings(timings, parsedWords)

		expect(result.status).toBe("mismatched")
		expect(result.mismatch?.reason).toBe("invalid-timings")
		expect(result.wordTimings).toHaveLength(2)
	})

	it("rejects out-of-range timing indices", () => {
		const parsedWords = makeParsedWords(["hello"])
		const timings = makeTimingsContent(["hello"], {
			wordTimings: [{ index: 5, word: "hello", start: 0, end: 1 }],
		})

		const result = mergeTimings(timings, parsedWords)

		expect(result.status).toBe("mismatched")
		expect(result.mismatch?.reason).toBe("invalid-timings")
	})

	it.each([
		["a missing timing array", JSON.stringify({ textHash: hash("hello world"), wordCount: 2 })],
		["a null timing array", JSON.stringify({ textHash: hash("hello world"), wordCount: 2, wordTimings: null })],
		["a null timing document", "null"],
	])("rejects structurally invalid JSON with %s", (_label, timings) => {
		const parsedWords = makeParsedWords(["hello", "world"])
		const result = mergeTimings(timings, parsedWords)

		expect(result.status).toBe("mismatched")
		expect(result.mismatch?.reason).toBe("invalid-timings")
		expect(result.wordTimings).toHaveLength(2)
	})

	describe("when word counts match", () => {
		it("returns status 'matched' with merged timings", () => {
			const words = ["hello", "world"]
			const content = makeTimingsContent(words)
			const parsedWords = makeParsedWords(words)

			const result = mergeTimings(content, parsedWords)

			expect(result.status).toBe("matched")
			expect(result.wordTimings).toHaveLength(2)
			expect(result.wordTimings[0].start).toBe(0)
			expect(result.wordTimings[0].end).toBe(0.5)
			expect(result.wordTimings[1].start).toBe(0.5)
			expect(result.wordTimings[1].end).toBe(1)
			expect(result.mismatch).toBeUndefined()
		})

		it("uses DSL word as canonical (not timing word)", () => {
			const words = ["hello", "world"]
			const content = makeTimingsContent(words)

			// DSL has slightly different casing
			const parsedWords = makeParsedWords(["Hello", "World"])
			const result = mergeTimings(content, parsedWords)

			// Uses DSL words
			expect(result.wordTimings[0].word).toBe("Hello")
			expect(result.wordTimings[1].word).toBe("World")
		})

		it("preserves styles from DSL", () => {
			const words = ["bold", "normal"]
			const content = makeTimingsContent(words)

			const parsedWords: ParsedWordTiming[] = [
				{ word: "bold", start: 0, end: 1, style: { bold: true } },
				{ word: "normal", start: 1, end: 2 },
			]
			const result = mergeTimings(content, parsedWords)

			expect(result.wordTimings[0].style).toEqual({ bold: true })
			expect(result.wordTimings[1].style).toBeUndefined()
		})
	})

	describe("when word counts differ", () => {
		it("returns status 'mismatched' with reason 'word-count'", () => {
			const content = makeTimingsContent(["hello", "world"])

			// DSL has 3 words now
			const parsedWords = makeParsedWords(["hello", "world", "test"])
			const result = mergeTimings(content, parsedWords)

			expect(result.status).toBe("mismatched")
			expect(result.mismatch?.reason).toBe("word-count")
			expect(result.mismatch?.timingsWordCount).toBe(2)
			expect(result.mismatch?.dslWordCount).toBe(3)
		})

		it("falls back to DSL words with placeholder timings", () => {
			const content = makeTimingsContent(["old"])
			const parsedWords = makeParsedWords(["new", "words"])

			const result = mergeTimings(content, parsedWords)

			expect(result.wordTimings[0].word).toBe("new")
			expect(result.wordTimings[1].word).toBe("words")
			// Uses placeholder timings from DSL
			expect(result.wordTimings[0].start).toBe(0)
			expect(result.wordTimings[1].start).toBe(1)
		})
	})

	describe("when word count matches but content differs", () => {
		it("returns status 'mismatched' with reason 'content-changed'", () => {
			const timingsFile: TimingsFile = {
				wordTimings: [
					{ index: 0, word: "old", start: 0, end: 0.5 },
					{ index: 1, word: "words", start: 0.5, end: 1 },
				],
				textHash: hash("old words"),
				wordCount: 2,
			}
			const content = JSON.stringify(timingsFile)

			// Same count, different words
			const parsedWords = makeParsedWords(["new", "words"])
			const result = mergeTimings(content, parsedWords)

			expect(result.status).toBe("mismatched")
			expect(result.mismatch?.reason).toBe("content-changed")
		})
	})

	describe("backward compatibility", () => {
		it("handles timings file without textHash", () => {
			const timingsFile: TimingsFile = {
				wordTimings: [
					{ index: 0, word: "hello", start: 0, end: 0.5 },
					{ index: 1, word: "world", start: 0.5, end: 1 },
				],
				textHash: "", // Empty or missing
				wordCount: 2,
			}
			const content = JSON.stringify(timingsFile)
			const parsedWords = makeParsedWords(["hello", "world"])

			const result = mergeTimings(content, parsedWords)

			// Should match since word count matches and no hash to compare
			expect(result.status).toBe("matched")
		})
	})
})
