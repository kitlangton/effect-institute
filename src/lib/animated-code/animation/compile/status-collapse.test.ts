import { describe, expect, it } from "@effect/vitest"
import { Spotlight, Status } from "../../annotations"
import { expandFrame } from "../../slideshow"
import { type AnimationDef, line, slot, stack } from "../animation"
import { compile } from "./compile"

/** Compile and expand every frame, as the renderer sees them */
const compileFrames = (def: AnimationDef) => {
	const { template, frames } = compile(def)
	return { frames: frames.map((frame) => expandFrame(frame, template)) }
}

describe("status and spotlight after line collapse", () => {
	/**
	 * When lines collapse (slots hidden), indices shift.
	 * allRanges must use line ID (string) not index (number)
	 * so rendering can look up ranges by the stable line ID.
	 */

	describe("status allRanges keyed by line ID", () => {
		it("allRanges uses line ID as key, not index", () => {
			const def = {
				animation: stack(
					slot("extra", {
						shown: line("collapsible", "// this line can collapse"),
					}),
					line("target", "doSomething()"),
				),
				snapshots: [
					// Frame 0: both lines visible, status on target (index 1)
					{ slots: { extra: "shown" }, annotations: [new Status({ text: "doSomething()", status: "running" })] },
					// Frame 1: collapsible hidden, target is now index 0
					{ slots: { extra: "hidden" }, annotations: [new Status({ text: "doSomething()", status: "success" })] },
				],
			}

			const data = compileFrames(def)

			// Frame 0: target at index 1
			expect(data.frames[0].lines).toHaveLength(2)
			expect(data.frames[0].lines[1].lineId).toBe("target")
			expect(data.frames[0].status?.ranges[1]).toBeDefined()

			// Frame 1: target at index 0 (collapsed line gone)
			expect(data.frames[1].lines).toHaveLength(1)
			expect(data.frames[1].lines[0].lineId).toBe("target")
			expect(data.frames[1].status?.ranges[0]).toBeDefined()

			// allRanges should use LINE ID (string), not index
			// This is the bug fix - allRanges[lineId] should work
			expect(data.frames[0].status?.allRanges.target).toBeDefined()
			expect(data.frames[1].status?.allRanges.target).toBeDefined()
		})
	})

	describe("spotlight allRanges keyed by line ID", () => {
		it("allRanges uses line ID as key, not index", () => {
			const def = {
				animation: stack(
					slot("extra", {
						shown: line("collapsible", "// this line can collapse"),
					}),
					line("target", "doSomething()"),
				),
				snapshots: [
					// Frame 0: both lines visible, spotlight on target
					{ slots: { extra: "shown" }, annotations: [new Spotlight({ patterns: ["doSomething"] })] },
					// Frame 1: collapsible hidden, target is now index 0
					{ slots: { extra: "hidden" }, annotations: [new Spotlight({ patterns: ["doSomething"] })] },
				],
			}

			const data = compileFrames(def)

			// Frame 0: target at index 1
			expect(data.frames[0].lines).toHaveLength(2)
			expect(data.frames[0].lines[1].lineId).toBe("target")

			// Frame 1: target at index 0
			expect(data.frames[1].lines).toHaveLength(1)
			expect(data.frames[1].lines[0].lineId).toBe("target")

			// allRanges should use LINE ID (string), not index
			expect(data.frames[0].spotlight?.allRanges.target).toBeDefined()
			expect(data.frames[1].spotlight?.allRanges.target).toBeDefined()
		})
	})

	describe("line reappearing recovers annotations", () => {
		it("status works when line reappears at different index", () => {
			const def = {
				animation: stack(
					slot("extra", {
						shown: line("collapsible", "// this line can collapse"),
					}),
					line("target", "doSomething()"),
				),
				snapshots: [
					// Frame 0: both visible, status on target (index 1)
					{ slots: { extra: "shown" }, annotations: [new Status({ text: "doSomething()", status: "running" })] },
					// Frame 1: collapsed, target at index 0
					{ slots: { extra: "hidden" }, annotations: [new Status({ text: "doSomething()", status: "running" })] },
					// Frame 2: expanded again, target back at index 1
					{ slots: { extra: "shown" }, annotations: [new Status({ text: "doSomething()", status: "success" })] },
				],
			}

			const data = compileFrames(def)

			// All frames should have allRanges keyed by "target"
			expect(data.frames[0].status?.allRanges.target).toBeDefined()
			expect(data.frames[1].status?.allRanges.target).toBeDefined()
			expect(data.frames[2].status?.allRanges.target).toBeDefined()

			// Current ranges should use index (for current frame rendering)
			expect(data.frames[0].status?.ranges[1]).toBeDefined() // index 1
			expect(data.frames[1].status?.ranges[0]).toBeDefined() // index 0
			expect(data.frames[2].status?.ranges[1]).toBeDefined() // index 1
		})
	})
})
