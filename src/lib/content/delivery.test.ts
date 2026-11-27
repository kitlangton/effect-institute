import { describe, expect, it, vi } from "vitest"
import { ChapterId, ChapterMetadata } from "@/lib/tooling/types"
import { fetchChapterManifest, fetchChapterManifestMap, fetchChapterSections, fetchCourseManifest } from "./delivery"

describe("content delivery client", () => {
	it("resolves origin-relative course manifests", async () => {
		const urls: string[] = []
		const fetchImpl: typeof fetch = async (input) => {
			urls.push(String(input))
			return new Response(
				JSON.stringify({
					chapters: [
						{ id: "draft", title: "Draft", order: 1, draft: true },
						{ id: "intro", title: "Intro", order: 2 },
					],
				}),
				{ headers: { "Content-Type": "application/json" } },
			)
		}

		const manifest = await fetchCourseManifest({ origin: "http://localhost:3000", fetch: fetchImpl })
		expect(manifest.chapters.map((c) => c.id)).toEqual(["draft", "intro"])
		expect(urls).toEqual(["http://localhost:3000/content/manifest.json"])
	})

	it("loads sections by manifest-selected hashed filename", async () => {
		const calls: Array<{ url: string; cache?: RequestCache }> = []
		const fetchImpl: typeof fetch = async (input, init) => {
			const url = String(input)
			calls.push({ url, ...(init?.cache !== undefined ? { cache: init.cache } : {}) })
			const payload = url.endsWith("/manifest.json")
				? {
						id: "intro",
						title: "Intro",
						sections: [{ id: "welcome", file: "welcome.abcdef12.json" }],
						groups: [{ id: "public", title: "Public", sectionIds: ["welcome"] }],
					}
				: {
						id: "welcome",
						text: "Welcome.",
						code: "",
						contentHash: "hash",
						wordTimings: [{ word: "Welcome", start: 0, end: 1 }],
					}
			return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } })
		}

		const manifest = await fetchChapterManifest("intro", { fetch: fetchImpl })
		const sections = await fetchChapterSections("intro", manifest, { fetch: fetchImpl, cache: "no-store" })

		expect(sections.map((section) => section.id)).toEqual(["welcome"])
		expect(calls).toEqual([
			{ url: "/content/intro/manifest.json", cache: undefined },
			{ url: "/content/intro/welcome.abcdef12.json", cache: "no-store" },
		])
	})

	it("keeps other chapters when one manifest fails, and warns with the chapter ID", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
		try {
			const fetchImpl: typeof fetch = async (input) => {
				const url = String(input)
				if (url.includes("/broken/")) return new Response("nope", { status: 404 })
				return new Response(JSON.stringify({ id: "intro", title: "Intro", sections: [] }), {
					headers: { "Content-Type": "application/json" },
				})
			}

			const map = await fetchChapterManifestMap(
				[
					new ChapterMetadata({ id: ChapterId.make("intro"), title: "Intro", order: 1 }),
					new ChapterMetadata({ id: ChapterId.make("broken"), title: "Broken", order: 2 }),
				],
				{ fetch: fetchImpl },
			)

			expect([...map.keys()]).toEqual(["intro"])
			expect(warn).toHaveBeenCalledTimes(1)
			expect(warn.mock.calls[0]?.[0]).toContain('"broken"')
			expect(String(warn.mock.calls[0]?.[1])).toContain("404")
		} finally {
			warn.mockRestore()
		}
	})
})
