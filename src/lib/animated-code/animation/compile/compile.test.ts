import { describe, expect, it } from "@effect/vitest"
import { Background, Burst, Cursor, Focus, Glow, Mark, Sound, Spotlight, Squiggle, Status } from "../../annotations"
import { concat, empty, line, slot, stack, text } from "../animation"
import { compile } from "./compile"

describe("compile", () => {
	describe("basic compilation", () => {
		it("compiles single line single snapshot", () => {
			const def = {
				animation: stack(line("line1", "const x = 1")),
				snapshots: [{}],
			}

			const data = compile(def)

			expect(data.frames).toHaveLength(1)
			expect(data.frames[0].lines).toHaveLength(1)
			expect(data.frames[0].lines[0].lineId).toBe("line1")
			expect(data.frames[0].lines[0].text).toBe("const x = 1")
		})

		it("compiles multiple lines", () => {
			const def = {
				animation: stack(line("line1", "const x = 1"), line("line2", "const y = 2"), line("line3", "const z = 3")),
				snapshots: [{}],
			}

			const data = compile(def)

			expect(data.frames[0].lines).toHaveLength(3)
			expect(data.frames[0].lines.map((l) => l.lineId)).toEqual(["line1", "line2", "line3"])
		})

		it("compiles multiple snapshots", () => {
			const def = {
				animation: stack(line("line1", "const x = 1")),
				snapshots: [{}, {}, {}],
			}

			const data = compile(def)

			expect(data.frames).toHaveLength(3)
		})
	})

	describe("slot value changes", () => {
		it("handles slot changing content across snapshots", () => {
			const def = {
				animation: stack(
					line("line1", concat(text("const x: "), slot("type", { num: text("number"), str: text("string") }))),
				),
				snapshots: [{ type: "num" }, { type: "str" }],
			}

			const data = compile(def)

			expect(data.frames[0].lines[0].text).toBe("const x: number")
			expect(data.frames[1].lines[0].text).toBe("const x: string")
		})

		it("handles slot with empty value", () => {
			const def = {
				animation: stack(
					line("line1", concat(text("const x"), slot("type", { hidden: empty, shown: text(": number") }))),
				),
				snapshots: [{ type: "hidden" }, { type: "shown" }],
			}

			const data = compile(def)

			expect(data.frames[0].lines[0].text).toBe("const x")
			expect(data.frames[1].lines[0].text).toBe("const x: number")
		})
	})

	describe("line visibility", () => {
		it("omits optional lines from an unspecified initial snapshot", () => {
			const def = {
				animation: stack(line("line1", "const x = 1"), slot.optional("extra", line("line2", "const y = 2"))),
				snapshots: [{}, { extra: "shown" }],
			}

			const data = compile(def)

			expect(data.frames[0].lines.map((line) => line.lineId)).toEqual(["line1"])
			expect(data.frames[1].lines.map((line) => line.lineId)).toEqual(["line1", "line2"])
		})

		it("handles line appearing in later snapshot", () => {
			const def = {
				animation: stack(
					line("line1", "const x = 1"),
					slot("extra", {
						hidden: empty,
						shown: line("line2", "const y = 2"),
					}),
				),
				snapshots: [{ extra: "hidden" }, { extra: "shown" }],
			}

			const data = compile(def)

			expect(data.frames[0].lines).toHaveLength(1)
			expect(data.frames[0].lines[0].lineId).toBe("line1")

			expect(data.frames[1].lines).toHaveLength(2)
			expect(data.frames[1].lines[1].lineId).toBe("line2")
			expect(data.frames[1].lines[1].entering).toBe(true)
		})

		it("marks continuing lines as not entering", () => {
			const def = {
				animation: stack(
					line("line1", "const x = 1"),
					slot("extra", {
						hidden: empty,
						shown: line("line2", "const y = 2"),
					}),
				),
				snapshots: [{ extra: "hidden" }, { extra: "shown" }],
			}

			const data = compile(def)

			expect(data.frames[1].lines[0].entering).toBe(false)
		})
	})

	describe("annotation processing", () => {
		it("processes Mark annotations", () => {
			const def = {
				animation: stack(line("line1", "const x = 1")),
				snapshots: [
					{
						annotations: [new Mark({ text: "const" })],
					},
				],
			}

			const data = compile(def)

			expect(data.frames[0].marks).toHaveLength(1)
			expect(data.frames[0].marks[0].lineIndex).toBe(0)
			expect(data.frames[0].marks[0].start).toBe(0)
			expect(data.frames[0].marks[0].end).toBe(5)
		})

		it("processes Glow annotations", () => {
			const def = {
				animation: stack(line("line1", "const x = 1")),
				snapshots: [
					{
						annotations: [new Glow({ text: "x", color: "blue" })],
					},
				],
			}

			const data = compile(def)

			expect(data.frames[0].glows).toHaveLength(1)
			expect(data.frames[0].glows[0].color).toBe("blue")
		})

		it("processes Squiggle annotations", () => {
			const def = {
				animation: stack(line("line1", "const x = error")),
				snapshots: [
					{
						annotations: [new Squiggle({ text: "error", color: "red" })],
					},
				],
			}

			const data = compile(def)

			expect(data.frames[0].squiggles).toHaveLength(1)
			expect(data.frames[0].squiggles[0].color).toBe("red")
		})

		it("processes Cursor annotations", () => {
			const def = {
				animation: stack(line("line1", "const x = 1")),
				snapshots: [
					{
						annotations: [new Cursor({ text: "x", type: "pointer" })],
					},
				],
			}

			const data = compile(def)

			expect(data.frames[0].cursor).toBeDefined()
			expect(data.frames[0].cursor!.type).toBe("pointer")
		})

		it("processes Burst annotations", () => {
			const def = {
				animation: stack(line("line1", "const x = 1")),
				snapshots: [
					{
						annotations: [new Burst({ text: "x", emoji: "🎉", count: 3 })],
					},
				],
			}

			const data = compile(def)

			expect(data.frames[0].bursts).toHaveLength(1)
			expect(data.frames[0].bursts[0].emoji).toEqual(["🎉"])
			expect(data.frames[0].bursts[0].count).toBe(3)
		})

		it("processes Focus annotations", () => {
			const def = {
				animation: stack(line("line1", "const x = 1"), line("line2", "const y = 2")),
				snapshots: [
					{
						annotations: [new Focus({ lines: ["line1"] })],
					},
				],
			}

			const data = compile(def)

			expect(data.frames[0].lines[0].dimmed).toBe(false)
			expect(data.frames[0].lines[1].dimmed).toBe(true)
		})

		it("processes Status annotations", () => {
			const def = {
				animation: stack(line("line1", "const x = 1")),
				snapshots: [
					{
						annotations: [new Status({ text: "x", status: "running" })],
					},
				],
			}

			const data = compile(def)

			expect(data.frames[0].status).toBeDefined()
			expect(data.frames[0].status!.ranges[0]).toBeDefined()
		})

		it("processes Spotlight annotations", () => {
			const def = {
				animation: stack(line("line1", "const x = 1")),
				snapshots: [
					{
						annotations: [new Spotlight({ patterns: ["const"], dim: 0.5 })],
					},
				],
			}

			const data = compile(def)

			expect(data.frames[0].spotlight).toBeDefined()
			expect(data.frames[0].spotlight!.dim).toBe(0.5)
		})

		it("processes Background annotations", () => {
			const def = {
				animation: stack(line("line1", "const x = 1")),
				snapshots: [
					{
						annotations: [new Background({ lineId: "line1", style: "success" })],
					},
				],
			}

			const data = compile(def)

			expect(data.frames[0].lines[0].background).toBe("success")
		})

		it("processes Sound annotations", () => {
			const def = {
				animation: stack(line("line1", "const x = 1")),
				snapshots: [
					{
						annotations: [new Sound({ name: "ding" })],
					},
				],
			}

			const data = compile(def)

			expect(data.frames[0].sound).toBe("ding")
		})
	})

	describe("pattern matching", () => {
		it("finds pattern at correct position", () => {
			const def = {
				animation: stack(line("line1", "const foo = bar")),
				snapshots: [
					{
						annotations: [new Mark({ text: "foo" })],
					},
				],
			}

			const data = compile(def)

			expect(data.frames[0].marks[0].start).toBe(6)
			expect(data.frames[0].marks[0].end).toBe(9)
		})

		it("matches punctuation-leading patterns by default", () => {
			const def = {
				animation: stack(line("line1", "const x: any = 1")),
				snapshots: [
					{
						annotations: [new Mark({ text: ": any" })],
					},
				],
			}

			const data = compile(def)

			expect(data.frames[0].marks).toHaveLength(1)
			expect(data.frames[0].marks[0].start).toBe(7)
			expect(data.frames[0].marks[0].end).toBe(12)
		})

		it("matches dot-leading patterns even when preceded by a word char", () => {
			const def = {
				animation: stack(line("line1", "slowDie.pipe(")),
				snapshots: [
					{
						annotations: [new Mark({ text: ".pipe" })],
					},
				],
			}

			const data = compile(def)

			expect(data.frames[0].marks).toHaveLength(1)
			expect(data.frames[0].marks[0].start).toBe(7)
			expect(data.frames[0].marks[0].end).toBe(12)
		})

		it("handles nth option for multiple matches", () => {
			const def = {
				animation: stack(line("line1", "const x = x + x")),
				snapshots: [
					{
						annotations: [new Mark({ text: "x", nth: 2 })],
					},
				],
			}

			const data = compile(def)

			expect(data.frames[0].marks[0].start).toBe(10)
		})

		it("handles after option", () => {
			const def = {
				animation: stack(line("line1", "const x = x + y")),
				snapshots: [
					{
						annotations: [new Mark({ text: "x", after: "=" })],
					},
				],
			}

			const data = compile(def)

			expect(data.frames[0].marks[0].start).toBe(10)
		})

		it("returns empty when pattern not found", () => {
			const def = {
				animation: stack(line("line1", "const x = 1")),
				snapshots: [
					{
						annotations: [new Mark({ text: "notfound" })],
					},
				],
			}

			const data = compile(def)

			expect(data.frames[0].marks).toHaveLength(0)
		})
	})

	describe("slot toggling", () => {
		it("handles slot going shown → hidden (toggle back)", () => {
			// This is the critical bug case: a slot that goes hidden → shown → hidden
			// The compiled frames should reflect the slot being hidden again in frame 2
			const def = {
				animation: stack(
					line("line1", concat(text("const x"), slot("type", { hidden: empty, shown: text(": number") }))),
				),
				snapshots: [{ type: "hidden" }, { type: "shown" }, { type: "hidden" }],
			}

			const data = compile(def)

			// Frame 0: hidden - no ": number"
			expect(data.frames[0].lines[0].text).toBe("const x")

			// Frame 1: shown - has ": number"
			expect(data.frames[1].lines[0].text).toBe("const x: number")

			// Frame 2: hidden again - no ": number" (THIS IS THE BUG)
			expect(data.frames[2].lines[0].text).toBe("const x")
		})

		it("handles multiple slot toggles", () => {
			const def = {
				animation: stack(line("line1", concat(text("fn"), slot("parens", { hidden: empty, shown: text("()") })))),
				snapshots: [
					{ parens: "hidden" },
					{ parens: "shown" },
					{ parens: "hidden" },
					{ parens: "shown" },
					{ parens: "hidden" },
				],
			}

			const data = compile(def)

			expect(data.frames[0].lines[0].text).toBe("fn")
			expect(data.frames[1].lines[0].text).toBe("fn()")
			expect(data.frames[2].lines[0].text).toBe("fn")
			expect(data.frames[3].lines[0].text).toBe("fn()")
			expect(data.frames[4].lines[0].text).toBe("fn")
		})

		it("handles slot toggle on line inside optional container", () => {
			// Real-world case: line has an optional slot, and the line itself is inside another optional slot
			const def = {
				animation: stack(
					line("def", concat(text("const x"), slot("thunk", { hidden: empty, shown: text("()") }))),
					slot("calls", {
						hidden: empty,
						shown: stack(line("call1", "x()"), line("call2", "x()")),
					}),
				),
				snapshots: [
					{ thunk: "hidden", calls: "hidden" },
					{ thunk: "shown", calls: "hidden" },
					{ thunk: "shown", calls: "shown" },
					{ thunk: "hidden", calls: "shown" }, // thunk goes back to hidden while calls still shown
				],
			}

			const data = compile(def)

			// Frame 0: thunk hidden
			expect(data.frames[0].lines[0].text).toBe("const x")

			// Frame 1: thunk shown
			expect(data.frames[1].lines[0].text).toBe("const x()")

			// Frame 2: thunk shown, calls shown
			expect(data.frames[2].lines[0].text).toBe("const x()")

			// Frame 3: thunk hidden again (BUG: this might stay "()" incorrectly)
			expect(data.frames[3].lines[0].text).toBe("const x")
		})
	})

	describe("part animation", () => {
		it("sets animateEntry for parts appearing after line", () => {
			const def = {
				animation: stack(
					line("line1", concat(text("const x"), slot("type", { hidden: empty, shown: text(": number") }))),
				),
				snapshots: [{ type: "hidden" }, { type: "shown" }],
			}

			const data = compile(def)

			// In frame 1, the ": number" part should have animateEntry true
			const frame1Parts = data.frames[1].lines[0].parts
			const typePart = frame1Parts.find((p) => p.tokens.some((t) => t.text === ": number"))
			expect(typePart?.animateEntry).toBe(true)
		})

		it("sets crossfade for parts with multiple versions", () => {
			const def = {
				animation: stack(
					line("line1", concat(text("const x: "), slot("type", { num: text("number"), str: text("string") }))),
				),
				snapshots: [{ type: "num" }, { type: "str" }],
			}

			const data = compile(def)

			const typePart = data.frames[0].lines[0].parts.find((p) => p.tokens.some((t) => t.text === "number"))
			expect(typePart?.crossfade).toBe(true)
		})
	})
})
