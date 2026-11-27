import { describe, expect, it } from "vitest"
import { type Animation, line, slot, stack } from "@/lib/animated-code/animation/animation"
import { compileFlow, on, type StepBuilder, validateFlowPatterns, validateFlowWords } from "."

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

const validate = (animation: Animation, flow: StepBuilder[]) =>
	validateFlowPatterns(animation, flow, compileFlow(undefined, flow, animation).snapshots)

const misses = (animation: Animation, flow: StepBuilder[]) =>
	validate(animation, flow).map((w) =>
		w.type === "pattern-not-found" ? [w.stepName, w.annotation, w.pattern] : w.type,
	)

describe("validateFlowPatterns", () => {
	it("accepts punctuation-leading patterns without substring mode", () => {
		expect(validate(line("a", "slowDie.pipe("), [on("With").cursor(".pipe")])).toHaveLength(0)
		expect(validate(line("a", "const x: any = 1"), [on("type").cursor(": any")])).toHaveLength(0)
	})

	it("checks each step against the code that step shows", () => {
		const anim = line("l", slot("v", { a: "const alpha = 1", b: "const beta = 2" }))
		expect(validate(anim, [on("first").cursor("alpha"), on("second").slots({ v: "b" }).cursor("beta")])).toHaveLength(0)
		expect(
			misses(anim, [on("first").slots({ v: "b" }).cursor("alpha"), on("second").slots({ v: "a" }).cursor("beta")]),
		).toEqual([
			["first", "cursor", "alpha"],
			["second", "cursor", "beta"],
		])
	})

	it("does not match patterns across line boundaries", () => {
		expect(validate(stack(line("a", "a"), line("b", "b")), [on("x").cursor("a\nb")])).toHaveLength(1)
	})

	it("checks marks and status indicators", () => {
		expect(misses(line("a", "const x = 1"), [on("x").mark("y"), on("z").status("nope", "success")])).toEqual([
			["x", "mark", "y"],
			["z", "status", "nope"],
		])
	})

	it("checks line-scoped token focus on its line only", () => {
		const anim = stack(line("a", "foo()"), line("b", "bar()"))
		expect(validate(anim, [on("x").focus({ line: "b", text: "bar" })])).toHaveLength(0)
		expect(misses(anim, [on("x").focus({ line: "b", text: "foo" })])).toEqual([["x", "focus (token)", "foo (line b)"]])
	})

	it("reports a persisting annotation once, where it first misses", () => {
		const anim = line("l", slot("v", { a: "alpha", b: "beta" }))
		const flow = [on("one").bright("alpha", { persist: true }), on("two").slots({ v: "b" }), on("three")]
		expect(misses(anim, flow)).toEqual([["two", "bright", "alpha"]])
	})

	it("reports line IDs a line focus names that do not exist", () => {
		expect(validate(line("a", "x"), [on("x").focus("a"), on("y").focus.range("a", "zz")])).toEqual([
			{ type: "line-id-not-found", lineId: "zz", stepName: "y" },
		])
	})

	it("rejects snapshots that are not aligned with the flow", () => {
		expect(() => validateFlowPatterns(line("a", "x"), [on("x")], [])).toThrow("expected 2 snapshots")
	})
})
