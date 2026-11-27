import { describe, expect, it, vi } from "@effect/vitest"
import { AsyncResult, AtomRegistry } from "effect/reactivity"
import { courseChaptersAtom, courseManifestLoadedAtom, fetchCourseManifestAtom } from "./course"

describe("fetchCourseManifestAtom", () => {
	it("fetches, sorts, caches, and recovers on failure", async () => {
		const originalFetch = globalThis.fetch
		const registry = AtomRegistry.make()
		try {
			registry.set(courseChaptersAtom, null)
			expect(registry.get(courseManifestLoadedAtom)).toBe(false)

			// First attempt fails -> stays unloaded so retry works
			globalThis.fetch = vi.fn(async () => new Response(null, { status: 500 })) as typeof fetch
			await new Promise<void>((resolve) => {
				const unsub = registry.subscribe(fetchCourseManifestAtom, (result) => {
					if (AsyncResult.isSuccess(result) && !result.waiting) {
						unsub()
						resolve()
					}
				})
				registry.set(fetchCourseManifestAtom, undefined)
			})
			expect(registry.get(courseChaptersAtom)).toBeNull()
			expect(registry.get(courseManifestLoadedAtom)).toBe(false)

			// Second attempt succeeds -> sorted by order
			globalThis.fetch = vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							chapters: [
								{ id: "basics", title: "Basics", order: 2 },
								{ id: "intro", title: "Intro", order: 1 },
							],
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			) as typeof fetch

			await new Promise<void>((resolve) => {
				const unsub = registry.subscribe(fetchCourseManifestAtom, (result) => {
					if (AsyncResult.isSuccess(result) && !result.waiting) {
						unsub()
						resolve()
					}
				})
				registry.set(fetchCourseManifestAtom, undefined)
			})

			expect(registry.get(courseManifestLoadedAtom)).toBe(true)
			expect(registry.get(courseChaptersAtom)?.map((c) => c.id)).toEqual(["intro", "basics"])
		} finally {
			registry.set(courseChaptersAtom, null)
			registry.dispose()
			globalThis.fetch = originalFetch
		}
	})
})
