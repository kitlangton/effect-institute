import { describe, expect, it } from "vitest"
import { StepRef, WordTiming } from "@/lib/tooling/types"
import { findStepWordIndex, resolveStepTimes } from "./resolve-steps"

describe("findStepWordIndex & resolveStepTimes", () => {
	it("matches a ref against a word with punctuation (normalize + exact)", () => {
		const timings = [
			new WordTiming({ word: "TypeScript.", start: 0, end: 0.5 }),
			new WordTiming({ word: "rocks", start: 0.5, end: 1 }),
		]

		expect(findStepWordIndex({ word: "TypeScript" }, timings)).toBe(0)
	})

	it("supports prefix refs for generic-looking transcript words", () => {
		const timings = [
			new WordTiming({ word: "Promise<Order>", start: 0, end: 0.5 }),
			new WordTiming({ word: "then", start: 0.5, end: 1 }),
		]

		expect(findStepWordIndex({ word: "Promise" }, timings)).toBe(0)
		expect(findStepWordIndex({ word: "promiseorder" }, timings)).toBe(0)
	})

	it("does not prefix-match very short refs", () => {
		const timings = [new WordTiming({ word: "Promise<Order>", start: 0, end: 0.5 })]

		expect(findStepWordIndex({ word: "Pr" }, timings)).toBeUndefined()
	})

	it("supports after + nth and resolves precomputed timestamps with lead time", () => {
		const timings = [
			new WordTiming({ word: "Promise<Order>", start: 0, end: 0.5 }),
			new WordTiming({ word: "middle", start: 0.5, end: 1 }),
			new WordTiming({ word: "Promise", start: 1, end: 1.5 }),
			new WordTiming({ word: "end", start: 1.5, end: 2 }),
		]

		expect(findStepWordIndex({ word: "Promise", after: "Promise", nth: 1 }, timings)).toBe(2)
		expect(
			resolveStepTimes(
				[new StepRef({ at: "start" }), new StepRef({ at: "Promise", after: "Promise", nth: 1 })],
				timings,
			),
		).toEqual([0, 0.85])
	})
})
