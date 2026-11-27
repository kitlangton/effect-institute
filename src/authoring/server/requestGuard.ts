/**
 * Cross-site request guard for the dev-only /__authoring endpoints.
 *
 * While "bun dev" runs, any page open in the author's browser could send a simple cross-origin POST to
 * localhost (no preflight), spending ElevenLabs credits or replacing narration. Two checks close that:
 *
 * - Every non-GET request must carry the AUTHORING_HEADER. A custom header forces a CORS preflight,
 *   which Vite refuses for other sites, so a page elsewhere cannot send it.
 * - Any request whose Sec-Fetch-Site is present and not "same-origin" or "none", or whose Origin is
 *   present and does not match Host, is refused. Vite's default CORS policy does approve preflights from
 *   other localhost ports, so this check is what stops another local dev server's page. It also covers
 *   GET routes, which reveal whether keys are set and list takes.
 *
 * Imports nothing, so vite.config.ts can load it under Node.
 *
 * @module
 */

export const AUTHORING_HEADER = "x-authoring"

export type HeaderValue = string | ReadonlyArray<string> | undefined

export interface GuardRequest {
	readonly method: string | undefined
	/** Lower-case header names, as Node's IncomingMessage provides them. */
	readonly headers: Readonly<Record<string, HeaderValue>>
}

const first = (value: HeaderValue): string | undefined => (typeof value === "string" ? value : value?.[0])

const sameHost = (origin: string, host: string | undefined): boolean => {
	if (!host) return false
	try {
		return new URL(origin).host.toLowerCase() === host.toLowerCase()
	} catch {
		return false
	}
}

/** Why the request must be refused, or null when it may proceed. */
export function rejectCrossSite(request: GuardRequest): string | null {
	const fetchSite = first(request.headers["sec-fetch-site"])
	if (fetchSite !== undefined && fetchSite !== "same-origin" && fetchSite !== "none") {
		return `Authoring endpoints only accept same-origin requests (Sec-Fetch-Site: ${fetchSite})`
	}
	const origin = first(request.headers.origin)
	if (origin !== undefined && !sameHost(origin, first(request.headers.host))) {
		return `Authoring endpoints only accept requests from this dev server (Origin: ${origin})`
	}
	const method = (request.method ?? "GET").toUpperCase()
	if (method !== "GET" && method !== "HEAD" && first(request.headers[AUTHORING_HEADER]) !== "1") {
		return `Authoring requests must send the "${AUTHORING_HEADER}: 1" header`
	}
	return null
}
