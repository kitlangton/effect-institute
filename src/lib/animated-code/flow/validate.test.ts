import { describe, expect, it } from "vitest"
import { on, validateFlowPatterns, validateFlowWords } from "."

describe("validateFlowWords", () => {
	it("accepts prefix refs for generic-looking transcript words", () => {
		const warnings = validateFlowWords([on("Promise")], ["Promise<Order>"])
		expect(warnings).toHaveLength(0)
	})

	it("rejects very short prefix refs", () => {
		const warnings = validateFlowWords([on("Pr")], ["Promise<Order>"])
		expect(warnings).toHaveLength(1)
		expect(warnings[0]?.type).toBe("word-not-found")
	})
})

describe("validateFlowPatterns", () => {
	it("accepts punctuation-leading patterns without substring mode", () => {
		const flow = [on("With").cursor(".pipe")]
		const warnings = validateFlowPatterns(flow, "slowDie.pipe(", [])
		expect(warnings).toHaveLength(0)
	})

	it("accepts punctuation patterns like ': any' without substring mode", () => {
		const flow = [on("type").cursor(": any")]
		const warnings = validateFlowPatterns(flow, "const x: any = 1", [])
		expect(warnings).toHaveLength(0)
	})

	it("validates each step against its own rendered code when given per-step code", () => {
		const flow = [on("first").cursor("alpha"), on("second").cursor("beta")]
		expect(validateFlowPatterns(flow, ["const alpha = 1", "const beta = 2"], [])).toHaveLength(0)

		// "beta" only exists in step 1's code, so step 0's cursor must not resolve against it
		const swapped = validateFlowPatterns(flow, ["const beta = 2", "const alpha = 1"], [])
		expect(swapped.map((w) => (w.type === "pattern-not-found" ? [w.stepName, w.pattern] : w.type))).toEqual([
			["first", "alpha"],
			["second", "beta"],
		])
	})

	it("does not match patterns across line boundaries", () => {
		const flow = [on("x").cursor("a\nb")]
		expect(validateFlowPatterns(flow, "a\nb", [])).toHaveLength(1)
	})

	it("rejects per-step code that is not aligned with the flow", () => {
		expect(() => validateFlowPatterns([on("x")], [], [])).toThrow("expected 1 rendered steps")
	})
})
