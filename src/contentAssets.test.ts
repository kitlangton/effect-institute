import { describe, expect, it } from "@effect/vitest"
import { parseRange, serveContentAsset } from "./contentAssets"

const audio = new Uint8Array(Array.from({ length: 100 }, (_, i) => i))

const assets = {
	fetch: async (request: Request) => {
		expect(request.headers.get("Range")).toBeNull()
		const { pathname } = new URL(request.url)
		if (pathname.endsWith(".webm")) {
			return new Response(audio, { headers: { "Content-Type": "video/webm", "Content-Length": "100" } })
		}
		if (pathname.endsWith(".json")) return new Response("{}", { headers: { "Content-Type": "application/json" } })
		return new Response("Not found", { status: 404 })
	},
}

const get = (path: string, headers: Record<string, string> = {}) =>
	serveContentAsset(new Request(`https://example.com${path}`, { headers }), assets)

describe("parseRange", () => {
	it("parses bounded, open-ended, and suffix ranges", () => {
		expect(parseRange("bytes=0-1", 100)).toEqual({ start: 0, end: 1 })
		expect(parseRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 })
		expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 })
		expect(parseRange("bytes=50-500", 100)).toEqual({ start: 50, end: 99 })
	})

	it("rejects out-of-bounds and ignores unsupported ranges", () => {
		expect(parseRange("bytes=100-", 100)).toBe("unsatisfiable")
		expect(parseRange("bytes=5-1", 100)).toBe("unsatisfiable")
		expect(parseRange("bytes=0-1,5-6", 100)).toBeUndefined()
		expect(parseRange("items=0-1", 100)).toBeUndefined()
	})
})

describe("serveContentAsset", () => {
	it("returns 206 with the requested bytes for audio ranges", async () => {
		const response = await get("/content/intro/welcome.619d8af5.webm", { Range: "bytes=10-19" })
		expect(response.status).toBe(206)
		expect(response.headers.get("Content-Range")).toBe("bytes 10-19/100")
		expect(response.headers.get("Content-Length")).toBe("10")
		expect(response.headers.get("Accept-Ranges")).toBe("bytes")
		expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
	})

	it("returns 416 for unsatisfiable ranges", async () => {
		const response = await get("/content/intro/welcome.619d8af5.webm", { Range: "bytes=200-" })
		expect(response.status).toBe(416)
		expect(response.headers.get("Content-Range")).toBe("bytes */100")
	})

	it("serves full audio without a range", async () => {
		const response = await get("/content/intro/welcome.619d8af5.webm")
		expect(response.status).toBe(200)
		expect(response.headers.get("Accept-Ranges")).toBe("bytes")
		expect((await response.arrayBuffer()).byteLength).toBe(100)
	})

	it("caches hashed files forever and revalidates manifests", async () => {
		expect((await get("/content/intro/welcome.619d8af5.webm")).headers.get("Cache-Control")).toContain("immutable")
		expect((await get("/content/intro/welcome.14b67512.json")).headers.get("Cache-Control")).toContain("immutable")
		expect((await get("/content/intro/manifest.json")).headers.get("Cache-Control")).toBe(
			"public, max-age=0, must-revalidate",
		)
	})

	it("passes through missing assets", async () => {
		expect((await get("/content/intro/missing.txt")).status).toBe(404)
	})
})
