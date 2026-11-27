import type { Application, BlurFilter } from "pixi.js"
import { describe, expect, it } from "vitest"
import { destroyBlurFilter, isPixiApplicationUsable, isPixiRendererDestroyed } from "./application"
import { buildArrowsKey } from "./PixiRowEngine"

describe("buildArrowsKey", () => {
	it("changes when only arrow direction changes", () => {
		const rightKey = buildArrowsKey([{ afterIndex: 0, direction: "right" }])
		const leftKey = buildArrowsKey([{ afterIndex: 0, direction: "left" }])

		expect(leftKey).not.toBe(rightKey)
	})
})

describe("Pixi application lifecycle", () => {
	it("treats a missing renderer as already destroyed", () => {
		const app = { renderer: null } as unknown as Application

		expect(isPixiRendererDestroyed(app)).toBe(true)
		expect(isPixiApplicationUsable(app)).toBe(false)
	})

	it("destroys owned blur passes before the parent filter", () => {
		const destroyed: string[] = []
		const filter = {
			blurXFilter: { destroy: () => destroyed.push("x") },
			blurYFilter: { destroy: () => destroyed.push("y") },
			destroy: () => destroyed.push("parent"),
		} as unknown as BlurFilter

		destroyBlurFilter(filter)

		expect(destroyed).toEqual(["x", "y", "parent"])
	})
})
