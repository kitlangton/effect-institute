import { describe, expect, it } from "@effect/vitest"
import { AtomRegistry } from "effect/reactivity"
import { IDLE_PLAYBACK, sectionPlaybackAtom } from "./audioPlayer"
import { createStepAtom, narrationAtom } from "./narration"

describe("audioPlayer & narration atoms", () => {
	it("returns the shared frozen IDLE_PLAYBACK reference for inactive sections", () => {
		expect(Object.isFrozen(IDLE_PLAYBACK)).toBe(true)
		expect(IDLE_PLAYBACK).toEqual({ playbackState: "idle", currentTime: 0 })

		const registry = AtomRegistry.make()
		try {
			const a = registry.get(sectionPlaybackAtom("section-a"))
			const b = registry.get(sectionPlaybackAtom("section-b"))
			expect(a).toBe(IDLE_PLAYBACK)
			expect(b).toBe(IDLE_PLAYBACK)
		} finally {
			registry.dispose()
		}
	})

	it("computes step 0 for inactive sections without allocating intermediate state", () => {
		const registry = AtomRegistry.make()
		try {
			registry.set(narrationAtom, {
				chapter: "intro",
				sections: [],
				activeIndex: 1,
			})
			const inactiveStepAtom = createStepAtom("section-0", 0, [0, 2, 5])
			expect(registry.get(inactiveStepAtom)).toBe(0)
		} finally {
			registry.dispose()
		}
	})
})
