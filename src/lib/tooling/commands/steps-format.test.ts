import { describe, expect, it } from "vitest"
import { line, slot, stack } from "@/lib/animated-code/animation"
import { previewSteps } from "@/lib/animated-code/animation/preview"
import { on } from "@/lib/animated-code/flow"
import { annotateLine, componentStateSummary, formatCodeStepBody, slotSummary, transcriptContext } from "./steps-format"

const animation = stack(
	"// header",
	line("sig", ["const x: ", slot("type", { num: "number", str: "string" }), " = read()"]),
	line("use", "log(x, x)"),
)

describe("transcriptContext", () => {
	const words = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]

	it("brackets the trigger word with three words either side", () => {
		expect(transcriptContext(words, 4, "five")).toBe("...two three four [five] six seven eight...")
		expect(transcriptContext(words, 0, "one")).toBe("[one] two three four...")
		expect(transcriptContext(words, 8, "nine")).toBe("...six seven eight [nine]")
	})

	it("explains start and missing words", () => {
		expect(transcriptContext(words, -1, "start")).toBe("(section start)")
		expect(transcriptContext(words, -1, "ten")).toBe('"ten" (not found)')
	})
})

describe("annotateLine", () => {
	it("leaves unannotated lines alone", () => {
		expect(annotateLine("abc", [])).toBe("abc")
	})

	it("nests contained ranges and orders equal spans alphabetically", () => {
		expect(
			annotateLine("log(x, x)", [
				{ start: 0, end: 9, tag: "spotlight" },
				{ start: 4, end: 5, tag: "cursor" },
				{ start: 4, end: 5, tag: "bright" },
			]),
		).toBe("<spotlight>log(<bright><cursor>x</cursor></bright>, x)</spotlight>")
	})
})

describe("slotSummary", () => {
	it("lists all slots first, then only changes", () => {
		const [start, step] = previewSteps(animation, undefined, [on("x").slots({ type: "str" })])
		expect(slotSummary(start, {})).toBe("Slots: type=num")
		expect(slotSummary(step, start.slots)).toBe("Slots: type: num → str")
		expect(slotSummary(step, step.slots)).toBeUndefined()
	})
})

describe("formatCodeStepBody", () => {
	it("renders the base step without annotations or a summary", () => {
		const [start] = previewSteps(animation, undefined, [])
		expect(formatCodeStepBody(start, {})).toEqual([
			"Slots: type=num",
			"",
			"   1│ // header",
			"   2│ const x: number = read()",
			"   3│ log(x, x)",
		])
	})

	it("marks focus, nth/after-aware annotations, changed slots and missing targets", () => {
		const [start, step] = previewSteps(animation, undefined, [
			on("x")
				.slots({ type: "str" })
				.focus("use")
				.cursor("x", { after: "log(" })
				.bright("x", { nth: 3 })
				.squiggle("nope")
				.sound("pop"),
		])

		expect(formatCodeStepBody(step, start.slots)).toEqual([
			"Slots: type: num → str",
			"",
			"   1│ // header",
			"   2│ const x: string = read()",
			"    Δ const x: «string» = read()",
			"▸  3│ log(<cursor>x</cursor>, <bright>x</bright>)",
			"",
			'  cursor: "x" (after="log(") L3:4-5 | sound: pop | squiggle: "nope" (not found!)',
		])
	})

	it("says when the cursor target is missing", () => {
		const [, step] = previewSteps(animation, undefined, [on("x").cursor("missing")])
		expect(formatCodeStepBody(step, step.slots).at(-1)).toBe('  cursor: "missing" (not found!)')
	})
})

describe("componentStateSummary", () => {
	it("shows full public state first, then changed keys", () => {
		expect(componentStateSummary(0, { a: 1, _sound: "pop", b: "x" }, {})).toBe('State: a=1, b="x"')
		expect(componentStateSummary(1, { a: 2, b: "x" }, { a: 1, b: "x" })).toBe("State: a: 1 → 2")
		expect(componentStateSummary(1, { a: 1 }, { a: 1 })).toBeUndefined()
	})
})
