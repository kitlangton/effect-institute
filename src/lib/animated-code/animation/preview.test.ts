import { describe, expect, it } from "vitest"
import { Bright, Cursor, Spotlight } from "@/lib/animated-code/annotations"
import { on } from "@/lib/animated-code/flow"
import { line, slot, stack } from "./animation"
import { describeTarget, locateAnnotations, previewSteps, type StepPreview } from "./preview"

const animation = stack(
	"// unlabeled header",
	line("imp", 'import { isEnabled } from "./flags"'),
	line("mock", ["vi.mock(() => ({ isEnable", slot("end", { good: "d", bad: "" }), ": vi.fn() }))"]),
	line("use", "if (isEnabled()) isEnabled.reset()"),
)

const at = (previews: StepPreview[], name: string) => previews.find((p) => p.name === name)!

describe("previewSteps", () => {
	it("preserves after/substring/nth specs from the flow", () => {
		const previews = previewSteps(animation, undefined, [
			on("one").as("one").cursor("isEnabled", { after: "if" }).bright("isEnable", { substring: true, nth: 2 }),
			on("two").as("two").focus({ line: "use", text: "isEnabled" }).squiggle("isEnable", { nth: 1 }),
		])

		expect(previews.map((p) => p.name)).toEqual(["start", "one", "two"])
		expect(at(previews, "one").annotations).toEqual([
			new Cursor({ text: "isEnabled", nth: 1, type: "hand", after: "if", substring: false }),
			new Bright({ text: "isEnable", nth: 2, color: undefined, after: undefined, substring: true }),
		])
		expect(at(previews, "two").annotations[0]).toEqual(
			new Spotlight({ patterns: [{ line: "use", text: "isEnabled" }], dim: 0.4, glow: false }),
		)
	})
})

describe("locateAnnotations", () => {
	const locate = (flow: Parameters<typeof previewSteps>[2], base?: Record<string, string>) => {
		const previews = previewSteps(animation, base, flow)
		return locateAnnotations(previews[previews.length - 1])
	}

	it("honours after: the cursor lands on the first match past the anchor", () => {
		const { locations } = locate([on("x").cursor("isEnabled", { after: "if (" })])
		expect(locations).toEqual([{ kind: "cursor", line: 4, start: 4, end: 13 }])
	})

	it("honours nth across lines", () => {
		const { locations } = locate([on("x").cursor("isEnabled", { nth: 3 })])
		expect(locations).toEqual([{ kind: "cursor", line: 4, start: 4, end: 13 }])
	})

	it("uses smart word boundaries unless substring is set", () => {
		const bounded = locate([on("x").bright("isEnable")], { end: "bad" })
		expect(bounded.locations).toEqual([{ kind: "bright", line: 3, start: 17, end: 25 }])

		const substring = locate([on("x").bright("isEnable", { substring: true })], { end: "bad" })
		expect(substring.locations).toEqual([{ kind: "bright", line: 2, start: 9, end: 17 }])
	})

	it("reports a spec whose nth match is only in some other step's code", () => {
		// With end "bad" there is one bounded "isEnable" (line 3), so nth=2 has nothing to land on
		const { locations, missing } = locate([on("x").squiggle("isEnable", { nth: 2 })], { end: "bad" })
		expect(locations).toEqual([])
		expect(missing).toEqual([{ kind: "squiggle", target: { text: "isEnable", nth: 2, substring: false } }])
	})

	it("locates each of several specs once instead of every line containing the text", () => {
		const { locations } = locate([on("x").bright("isEnabled").bright("vi.fn")])
		expect(locations).toEqual([
			{ kind: "bright", line: 2, start: 9, end: 18 },
			{ kind: "bright", line: 3, start: 28, end: 33 },
		])
	})

	it("spotlights every occurrence, optionally constrained to one line ID", () => {
		const anywhere = locate([on("x").focus({ text: "isEnabled" })])
		expect(anywhere.locations.map((l) => l.line)).toEqual([2, 3, 4, 4])

		const onLine = locate([on("x").focus({ line: "use", text: "isEnabled" })])
		expect(onLine.locations).toEqual([
			{ kind: "spotlight", line: 4, start: 4, end: 13 },
			{ kind: "spotlight", line: 4, start: 17, end: 26 },
		])
	})

	it("maps focused line IDs to line numbers even after unlabeled lines", () => {
		const { focusedLines } = locate([on("x").focus("use")])
		expect([...focusedLines]).toEqual([4])
	})
})

describe("describeTarget", () => {
	it("shows only non-default options", () => {
		expect(describeTarget({ text: "a", nth: 1, substring: false })).toBe('"a"')
		expect(describeTarget({ text: "a", nth: 2, after: "b", substring: true })).toBe('"a" (nth=2, after="b", substring)')
		expect(describeTarget("pat")).toBe('"pat"')
		expect(describeTarget({ line: "l1" })).toBe("line l1")
		expect(describeTarget({ line: "l1", text: "t" })).toBe('"t" (line=l1)')
	})
})
