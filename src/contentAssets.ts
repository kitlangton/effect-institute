/**
 * Serves `/content/*` through the Workers static assets binding with the two
 * behaviors the asset handler lacks: byte-range responses (Safari refuses to
 * play media without 206 support) and long-lived caching for hashed files.
 */

export interface AssetFetcher {
	fetch(request: Request): Promise<Response>
}

const HASHED_ASSET = /\.[a-f0-9]{8}\.(json|webm)$/
const IMMUTABLE = "public, max-age=31536000, immutable"
const REVALIDATE = "public, max-age=0, must-revalidate"

export type ByteRange = { readonly start: number; readonly end: number }

/** Parses a single `bytes=` range. Returns undefined for unsupported (multi-range) or malformed headers, and "unsatisfiable" when out of bounds. */
export function parseRange(header: string, size: number): ByteRange | "unsatisfiable" | undefined {
	const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
	if (!match) return undefined
	const [, rawStart, rawEnd] = match
	if (rawStart === "" && rawEnd === "") return undefined

	if (rawStart === "") {
		const suffix = Number(rawEnd)
		if (suffix === 0) return "unsatisfiable"
		return { start: Math.max(0, size - suffix), end: size - 1 }
	}

	const start = Number(rawStart)
	const end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1)
	if (start >= size || start > end) return "unsatisfiable"
	return { start, end }
}

export async function serveContentAsset(request: Request, assets: AssetFetcher): Promise<Response> {
	const { pathname } = new URL(request.url)
	const rangeHeader = request.headers.get("Range")

	const assetRequest = new Request(request.url, { method: request.method, headers: request.headers })
	assetRequest.headers.delete("Range")
	const asset = await assets.fetch(assetRequest)
	if (!asset.ok) return asset

	const headers = new Headers(asset.headers)
	headers.set("Cache-Control", HASHED_ASSET.test(pathname) ? IMMUTABLE : REVALIDATE)

	if (!pathname.endsWith(".webm")) {
		return new Response(asset.body, { status: asset.status, headers })
	}

	headers.set("Accept-Ranges", "bytes")
	if (!rangeHeader || request.method !== "GET") {
		return new Response(asset.body, { status: asset.status, headers })
	}

	const bytes = new Uint8Array(await asset.arrayBuffer())
	const range = parseRange(rangeHeader, bytes.byteLength)
	if (range === undefined) {
		headers.set("Content-Length", String(bytes.byteLength))
		return new Response(bytes, { status: 200, headers })
	}
	if (range === "unsatisfiable") {
		headers.delete("Content-Length")
		headers.set("Content-Range", `bytes */${bytes.byteLength}`)
		return new Response(null, { status: 416, headers })
	}

	const slice = bytes.subarray(range.start, range.end + 1)
	headers.set("Content-Range", `bytes ${range.start}-${range.end}/${bytes.byteLength}`)
	headers.set("Content-Length", String(slice.byteLength))
	return new Response(slice, { status: 206, headers })
}
