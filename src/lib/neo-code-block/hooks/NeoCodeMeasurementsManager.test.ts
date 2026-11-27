import { afterEach, describe, expect, it, vi } from "vitest"
import { NeoCodeMeasurementsManager } from "./NeoCodeMeasurementsManager"

describe("NeoCodeMeasurementsManager", () => {
	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})

	it("does not schedule transition polling without measured overlays", () => {
		const requestAnimationFrame = vi.fn(() => 1)
		vi.stubGlobal("requestAnimationFrame", requestAnimationFrame)

		const manager = new NeoCodeMeasurementsManager()
		manager.activateFor(800)

		expect(requestAnimationFrame).not.toHaveBeenCalled()
	})

	it("schedules measurement when an overlay subscribes during an active transition", () => {
		const requestAnimationFrame = vi.fn(() => 1)
		vi.stubGlobal("requestAnimationFrame", requestAnimationFrame)

		const manager = new NeoCodeMeasurementsManager()
		manager.activateFor(800)
		manager.subscribe("cursor", { lineId: "line", lineText: "value", start: 0, end: 5 }, () => undefined)

		expect(requestAnimationFrame).toHaveBeenCalledOnce()
	})

	it("stops transition polling once overlay geometry stays stable", () => {
		let now = 0
		const callbacks: FrameRequestCallback[] = []
		const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
			callbacks.push(callback)
			return callbacks.length
		})
		vi.stubGlobal("requestAnimationFrame", requestAnimationFrame)
		vi.spyOn(performance, "now").mockImplementation(() => now)

		const manager = new NeoCodeMeasurementsManager()
		const measureAll = vi.fn(() => {
			Reflect.set(manager, "dirty", false)
			return false
		})
		Reflect.set(manager, "codeBlockEl", {})
		Reflect.set(manager, "measureAll", measureAll)
		manager.subscribe("cursor", { lineId: "line", lineText: "value", start: 0, end: 5 }, () => undefined)
		manager.activateFor(800)

		for (const frameTime of [16, 32, 48, 64, 80, 96]) {
			now = frameTime
			callbacks.shift()?.(frameTime)
			expect(callbacks).toHaveLength(1)
		}

		now = 112
		callbacks.shift()?.(now)

		expect(now).toBeLessThan(800)
		expect(callbacks).toHaveLength(0)
		expect(measureAll).toHaveBeenCalledTimes(7)
	})

	it("continues polling until changed overlay geometry stabilizes again", () => {
		let now = 0
		const callbacks: FrameRequestCallback[] = []
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			callbacks.push(callback)
			return callbacks.length
		})
		vi.spyOn(performance, "now").mockImplementation(() => now)

		const manager = new NeoCodeMeasurementsManager()
		Reflect.set(manager, "codeBlockEl", {})
		Reflect.set(
			manager,
			"measureAll",
			vi.fn(() => {
				Reflect.set(manager, "dirty", false)
				return now === 112
			}),
		)
		manager.subscribe("cursor", { lineId: "line", lineText: "value", start: 0, end: 5 }, () => undefined)
		manager.activateFor(800)

		for (const frameTime of [16, 32, 48, 64, 80, 96, 112, 128, 144]) {
			now = frameTime
			callbacks.shift()?.(frameTime)
			expect(callbacks).toHaveLength(1)
		}

		now = 160
		callbacks.shift()?.(now)

		expect(callbacks).toHaveLength(0)
	})
})
