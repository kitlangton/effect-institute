import { describe, expect, it } from "@effect/vitest"
import { empty, line, slot, stack, text } from "../animation"
import { Bright, Cursor, Focus, Sound, Squiggle, Status } from "../annotations"
import { compileFlow, extractLineIds, extractSlotDefaults } from "./compile"
import { on } from "./step-builder"
import { validateFlowWords } from "./validate"

describe("flow", () => {
	describe("on() builder", () => {
		it("creates step with word", () => {
			const step = on("hello")._build()
			expect(step.word).toBe("hello")
			expect(step.slotsDelta).toEqual({})
		})

		it("supports .as() for naming", () => {
			const step = on("hello").as("greeting")._build()
			expect(step.name).toBe("greeting")
		})

		it("supports .after() for word matching", () => {
			const step = on("the").after("first")._build()
			expect(step.after).toBe("first")
		})

		it("supports .nth() for nth match", () => {
			const step = on("the").nth(2)._build()
			expect(step.nth).toBe(2)
		})

		it("supports .slots() for slot changes", () => {
			const step = on("show").slots({ body: "expanded" })._build()
			expect(step.slotsDelta).toEqual({ body: "expanded" })
		})

		it("merges multiple .slots() calls", () => {
			const step = on("show").slots({ a: "1" }).slots({ b: "2" })._build()
			expect(step.slotsDelta).toEqual({ a: "1", b: "2" })
		})

		it("supports .state() for component state", () => {
			const step = on("run").state({ running: true })._build()
			expect(step.stateDelta).toEqual({ running: true })
		})
	})

	describe("focus annotations", () => {
		it("supports .focus() for lines", () => {
			const step = on("look").focus("line1", "line2")._build()
			expect(step.annotations.focus?.lines).toMatchObject({
				_tag: "FocusLines",
				ids: ["line1", "line2"],
			})
		})

		it("supports .focus.range()", () => {
			const step = on("look").focus.range("start", "end")._build()
			expect(step.annotations.focus?.lines).toMatchObject({
				_tag: "FocusRange",
				from: "start",
				to: "end",
			})
		})

		it("supports .focus.except()", () => {
			const step = on("look").focus.except("skip")._build()
			expect(step.annotations.focus?.lines).toMatchObject({
				_tag: "FocusExcept",
				ids: ["skip"],
			})
		})

		it("supports .focus.all()", () => {
			const step = on("look").focus.all()._build()
			expect(step.annotations.focus?.lines).toMatchObject({ _tag: "FocusAll" })
		})

		it("supports .focus.clear()", () => {
			const step = on("done").focus.clear()._build()
			expect(step.annotations.focusClear).toBe(true)
		})

		it("supports .focus() with persist option", () => {
			const step = on("look").focus("a", { persist: true })._build()
			expect(step.annotations.focus?.lines).toMatchObject({
				_tag: "FocusLines",
				ids: ["a"],
				persist: true,
			})
		})

		it("supports .focus() with token patterns (unified API)", () => {
			const step = on("look").focus({ text: "pattern" })._build()
			expect(step.annotations.focus?.tokens).toEqual([{ text: "pattern" }])
		})

		it("supports .focus() with mixed line IDs and token patterns", () => {
			const step = on("look").focus("lineA", { text: "pattern" }, { line: "lineB", text: "other" })._build()
			expect(step.annotations.focus?.lines).toMatchObject({
				_tag: "FocusLines",
				ids: ["lineA"],
			})
			expect(step.annotations.focus?.tokens).toEqual([{ text: "pattern" }, { line: "lineB", text: "other" }])
		})
	})

	describe("cursor annotations", () => {
		it("supports .cursor()", () => {
			const step = on("point").cursor("target")._build()
			expect(step.annotations.cursor).toEqual({ text: "target" })
		})

		it("supports cursor options", () => {
			const step = on("point").cursor("target", { type: "pointer", nth: 2 })._build()
			expect(step.annotations.cursor).toEqual({
				text: "target",
				type: "pointer",
				nth: 2,
			})
		})

		it("supports .cursor.clear()", () => {
			const step = on("done").cursor.clear()._build()
			expect(step.annotations.cursorClear).toBe(true)
		})
	})

	describe("other annotations", () => {
		it("supports .squiggle()", () => {
			const step = on("error").squiggle("bug", { color: "red" })._build()
			expect(step.annotations.squiggle).toEqual([{ text: "bug", color: "red" }])
		})

		it("accumulates multiple .squiggle() calls", () => {
			const step = on("errors").squiggle("bug1").squiggle("bug2")._build()
			expect(step.annotations.squiggle).toHaveLength(2)
		})

		it("supports .bright()", () => {
			const step = on("highlight").bright("important")._build()
			expect(step.annotations.bright).toEqual([{ text: "important" }])
		})

		it("supports .glow()", () => {
			const step = on("glow").glow("text", { color: "blue" })._build()
			expect(step.annotations.glow).toEqual([{ text: "text", color: "blue" }])
		})

		it("supports .burst()", () => {
			const step = on("celebrate").burst("text", "🎉")._build()
			expect(step.annotations.burst).toEqual({ text: "text", emoji: "🎉" })
		})

		it("supports .sound()", () => {
			const step = on("play").sound("success")._build()
			expect(step.annotations.sound).toBe("success")
		})

		it("supports .status()", () => {
			const step = on("run").status("code", "running")._build()
			expect(step.annotations.status).toEqual([{ text: "code", status: "running" }])
		})

		it(".at() applies each annotation to the shared target, mark included", () => {
			const step = on("x")
				.at("Err", (t) => t.bright().cursor({ type: "pointer" }).mark({ color: "red" }).status("error"), { nth: 2 })
				._build()
			expect(step.annotations.bright).toEqual([{ text: "Err", nth: 2 }])
			expect(step.annotations.cursor).toEqual({ text: "Err", nth: 2, type: "pointer" })
			expect(step.annotations.mark).toEqual([{ text: "Err", nth: 2, color: "red" }])
			expect(step.annotations.status).toEqual([{ text: "Err", status: "error", nth: 2 }])
		})
	})

	describe("extractSlotDefaults()", () => {
		it("extracts first key from each slot", () => {
			const anim = stack(
				line("line", "text"),
				slot("visibility", { hidden: empty, shown: line("x", "x") }),
				slot("mode", { simple: text("a"), complex: text("b") }),
			)
			const defaults = extractSlotDefaults(anim)
			expect(defaults).toEqual({ visibility: "hidden", mode: "simple" })
		})

		it("handles nested slots", () => {
			const anim = slot("outer", {
				a: slot("inner", { x: empty, y: text("y") }),
				b: empty,
			})
			const defaults = extractSlotDefaults(anim)
			expect(defaults).toEqual({ outer: "a", inner: "x" })
		})
	})

	describe("extractLineIds()", () => {
		it("extracts all line IDs", () => {
			const anim = stack(
				line("first", "1"),
				line("second", "2"),
				slot("body", {
					hidden: empty,
					shown: line("inner", "3"),
				}),
			)
			const ids = extractLineIds(anim)
			expect(ids).toContain("first")
			expect(ids).toContain("second")
			expect(ids).toContain("inner")
		})
	})

	describe("compileFlow()", () => {
		const simpleAnim = stack(
			line("sig", "function foo() {"),
			slot("body", {
				hidden: empty,
				shown: line("impl", "  return 42"),
			}),
			line("close", "}"),
		)

		it("creates initial start step", () => {
			const { steps, snapshots } = compileFlow({}, [], simpleAnim)
			expect(steps).toHaveLength(1)
			expect(steps[0]).toEqual({ name: "start", at: "start" })
			expect(snapshots).toHaveLength(1)
		})

		it("uses slot defaults for base state", () => {
			const { snapshots } = compileFlow(undefined, [], simpleAnim)
			// First key "hidden" should be default
			expect(snapshots[0].slots.body).toBe("hidden")
		})

		it("explicit base overrides defaults", () => {
			const { snapshots } = compileFlow({ body: "shown" }, [], simpleAnim)
			expect(snapshots[0].slots.body).toBe("shown")
		})

		it("accumulates slot changes across steps", () => {
			const flow = [
				on("first").slots({ body: "shown" }),
				on("second"), // no slot change
			]
			const { snapshots } = compileFlow({ body: "hidden" }, flow, simpleAnim)

			expect(snapshots[0].slots.body).toBe("hidden") // start
			expect(snapshots[1].slots.body).toBe("shown") // first
			expect(snapshots[2].slots.body).toBe("shown") // second (persisted)
		})

		it("creates StepRef with word and name", () => {
			const flow = [on("hello").as("greeting")]
			const { steps } = compileFlow({}, flow, simpleAnim)

			expect(steps[1]).toEqual({ name: "greeting", at: "hello" })
		})

		it("includes after and nth in StepRef", () => {
			const flow = [on("the").after("first").nth(2)]
			const { steps } = compileFlow({}, flow, simpleAnim)

			expect(steps[1]).toMatchObject({
				at: "the",
				after: "first",
				nth: 2,
			})
		})

		describe("focus persistence", () => {
			it("non-persist focus clears after step", () => {
				const flow = [
					on("first").focus("sig"),
					on("second"), // no focus
				]
				const { snapshots } = compileFlow({}, flow, simpleAnim)

				// First step has focus
				expect(snapshots[1].annotations).toBeDefined()
				const ann1 = snapshots[1].annotations as unknown[]
				expect(ann1.some((a) => a instanceof Focus)).toBe(true)

				// Second step should NOT have focus (not persisted)
				const ann2 = snapshots[2].annotations
				expect(ann2?.some((a: unknown) => a instanceof Focus)).toBeFalsy()
			})

			it("persist focus carries forward", () => {
				const flow = [
					on("first").focus("sig", { persist: true }),
					on("second"), // no focus specified
				]
				const { snapshots } = compileFlow({}, flow, simpleAnim)

				// Both steps should have focus
				const ann1 = snapshots[1].annotations as unknown[]
				const ann2 = snapshots[2].annotations as unknown[]
				expect(ann1.some((a) => a instanceof Focus)).toBe(true)
				expect(ann2.some((a) => a instanceof Focus)).toBe(true)
			})

			it("focus.clear() removes persisted focus", () => {
				const flow = [on("first").focus("sig", { persist: true }), on("second").focus.clear()]
				const { snapshots } = compileFlow({}, flow, simpleAnim)

				const ann2 = snapshots[2].annotations
				expect(ann2?.some((a: unknown) => a instanceof Focus)).toBeFalsy()
			})
		})

		describe("cursor persistence", () => {
			it("non-persist cursor clears after step", () => {
				const flow = [on("first").cursor("foo"), on("second")]
				const { snapshots } = compileFlow({}, flow, simpleAnim)

				const ann1 = snapshots[1].annotations as unknown[]
				const ann2 = snapshots[2].annotations

				expect(ann1.some((a) => a instanceof Cursor)).toBe(true)
				expect(ann2?.some((a: unknown) => a instanceof Cursor)).toBeFalsy()
			})

			it("persist cursor carries forward", () => {
				const flow = [on("first").cursor("foo", { persist: true }), on("second")]
				const { snapshots } = compileFlow({}, flow, simpleAnim)

				const ann1 = snapshots[1].annotations as unknown[]
				const ann2 = snapshots[2].annotations as unknown[]

				expect(ann1.some((a) => a instanceof Cursor)).toBe(true)
				expect(ann2.some((a) => a instanceof Cursor)).toBe(true)
			})
		})

		describe("array annotations (squiggle, bright, status)", () => {
			it("non-persist squiggle clears after step", () => {
				const flow = [on("first").squiggle("error"), on("second")]
				const { snapshots } = compileFlow({}, flow, simpleAnim)

				const ann1 = snapshots[1].annotations as unknown[]
				const ann2 = snapshots[2].annotations

				expect(ann1.some((a) => a instanceof Squiggle)).toBe(true)
				expect(ann2?.some((a: unknown) => a instanceof Squiggle)).toBeFalsy()
			})

			it("persist squiggle carries forward", () => {
				const flow = [on("first").squiggle("error", { persist: true }), on("second")]
				const { snapshots } = compileFlow({}, flow, simpleAnim)

				const ann1 = snapshots[1].annotations as unknown[]
				const ann2 = snapshots[2].annotations as unknown[]

				expect(ann1.some((a) => a instanceof Squiggle)).toBe(true)
				expect(ann2.some((a) => a instanceof Squiggle)).toBe(true)
			})

			it("persist bright carries forward", () => {
				const flow = [on("first").bright("text", { persist: true }), on("second")]
				const { snapshots } = compileFlow({}, flow, simpleAnim)

				const ann2 = snapshots[2].annotations as unknown[]
				expect(ann2.some((a) => a instanceof Bright)).toBe(true)
			})

			it("persist status carries forward when new status added for different nth", () => {
				// This tests the bug where status for nth:1 was lost when status for nth:2 was added
				const flow = [
					on("first").status("runPromise", "success", { persist: true }), // nth: 1 (default)
					on("second").status("runPromise", "running", { nth: 2 }), // nth: 2
				]
				const { snapshots } = compileFlow({}, flow, simpleAnim)

				const ann2 = snapshots[2].annotations as Status[]
				const statusAnnotations = ann2.filter((a) => a instanceof Status)

				// Should have BOTH statuses: persisted nth:1 success AND new nth:2 running
				expect(statusAnnotations).toHaveLength(2)
				expect(statusAnnotations.some((s) => s.nth === 1 && s.status === "success")).toBe(true)
				expect(statusAnnotations.some((s) => s.nth === 2 && s.status === "running")).toBe(true)
			})

			it("status with same text+nth replaces rather than accumulates", () => {
				const flow = [
					on("first").status("runPromise", "running", { persist: true }),
					on("second").status("runPromise", "success", { persist: true }), // same target, should replace
				]
				const { snapshots } = compileFlow({}, flow, simpleAnim)

				const ann2 = snapshots[2].annotations as Status[]
				const statusAnnotations = ann2.filter((a) => a instanceof Status)

				// Should only have ONE status (replaced, not accumulated)
				expect(statusAnnotations).toHaveLength(1)
				expect(statusAnnotations[0].status).toBe("success")
			})

			it("multiple persistent statuses with different nth values all carry forward", () => {
				const flow = [
					on("first").status("run", "success", { persist: true }), // nth: 1
					on("second").status("run", "success", { nth: 2, persist: true }), // nth: 2
					on("third").status("run", "success", { nth: 3, persist: true }), // nth: 3
					on("fourth"), // no status change
				]
				const { snapshots } = compileFlow({}, flow, simpleAnim)

				const ann4 = snapshots[4].annotations as Status[]
				const statusAnnotations = ann4.filter((a) => a instanceof Status)

				// All 3 persistent statuses should carry forward
				expect(statusAnnotations).toHaveLength(3)
			})
		})

		it("includes sound annotation", () => {
			const flow = [on("play").sound("success")]
			const { snapshots } = compileFlow({}, flow, simpleAnim)

			const ann = snapshots[1].annotations as unknown[]
			expect(ann.some((a) => a instanceof Sound)).toBe(true)
		})
	})

	describe("validateFlowWords()", () => {
		const transcriptWords = ["hello", "world", "this", "is", "a", "test"]

		it("returns empty for valid words", () => {
			const flow = [on("hello"), on("world")]
			const warnings = validateFlowWords(flow, transcriptWords)
			expect(warnings).toHaveLength(0)
		})

		it("returns warning for missing word", () => {
			const flow = [on("missing")]
			const warnings = validateFlowWords(flow, transcriptWords)

			expect(warnings).toHaveLength(1)
			expect(warnings[0].type).toBe("word-not-found")
			expect(warnings[0]).toMatchObject({ word: "missing" })
		})

		it("matches case-insensitively", () => {
			const flow = [on("HELLO"), on("World")]
			const warnings = validateFlowWords(flow, transcriptWords)
			expect(warnings).toHaveLength(0)
		})

		it("strips punctuation for matching", () => {
			const wordsWithPunctuation = ["hello,", "world!"]
			const flow = [on("hello"), on("world")]
			const warnings = validateFlowWords(flow, wordsWithPunctuation)
			expect(warnings).toHaveLength(0)
		})

		it("provides suggestions for missing words", () => {
			const flow = [on("helo")] // typo
			const warnings = validateFlowWords(flow, transcriptWords)

			expect(warnings).toHaveLength(1)
			expect(warnings[0].type).toBe("word-not-found")
			if (warnings[0].type === "word-not-found") {
				expect(warnings[0].suggestions).toBeDefined()
				expect(warnings[0].suggestions).toContain("hello")
			}
		})
	})

	describe("slot name validation", () => {
		const simpleAnim = stack(
			line("sig", "function foo() {"),
			slot("body", {
				hidden: empty,
				shown: line("impl", "  return 42"),
			}),
			line("close", "}"),
		)

		it("warns on unknown slot name", () => {
			const flow = [on("show").slots({ typo: "value" })]
			const { warnings } = compileFlow({}, flow, simpleAnim)

			expect(warnings).toHaveLength(1)
			expect(warnings[0].type).toBe("slot-not-found")
			if (warnings[0].type === "slot-not-found") {
				expect(warnings[0].slotName).toBe("typo")
				expect(warnings[0].availableSlots).toContain("body")
			}
		})

		it("no warning for valid slot name", () => {
			const flow = [on("show").slots({ body: "shown" })]
			const { warnings } = compileFlow({}, flow, simpleAnim)

			expect(warnings).toHaveLength(0)
		})

		it("warns on multiple unknown slots", () => {
			const flow = [on("show").slots({ typo1: "a", typo2: "b" })]
			const { warnings } = compileFlow({}, flow, simpleAnim)

			expect(warnings).toHaveLength(2)
			expect(warnings.every((w) => w.type === "slot-not-found")).toBe(true)
		})
	})
})
