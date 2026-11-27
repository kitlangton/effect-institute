import { type AssetFetcher, serveContentAsset } from "./contentAssets"

type FetchHandler = (request: Request, env: unknown, ctx: unknown) => Response | Promise<Response>

interface WorkerModule {
	default?: WorkerModule
	fetch?: FetchHandler
}

function installConsoleCreateTaskShim() {
	try {
		const descriptor = Object.getOwnPropertyDescriptor(console, "createTask")
		if (typeof descriptor?.value === "function") return
	} catch {
		// workerd exposes Console.createTask as an unimplemented native accessor.
	}

	Object.defineProperty(console, "createTask", {
		configurable: true,
		value: () => null,
	})
}

installConsoleCreateTaskShim()

let serverEntryPromise: Promise<WorkerModule> | undefined

function getServerEntry() {
	serverEntryPromise ??= import("@tanstack/react-start/server-entry") as Promise<WorkerModule>
	return serverEntryPromise
}

const APEX_HOST = "effect.institute"
const CANONICAL_HOST = "www.effect.institute"

function getAssets(env: unknown): AssetFetcher | undefined {
	if (typeof env !== "object" || env === null || !("ASSETS" in env)) return undefined
	return env.ASSETS as AssetFetcher
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url)
		if (url.hostname === APEX_HOST) {
			url.hostname = CANONICAL_HOST
			return Response.redirect(url.toString(), 307)
		}

		const assets = getAssets(env)
		if (assets && url.pathname.startsWith("/content/")) {
			return serveContentAsset(request, assets)
		}

		const serverEntry = await getServerEntry()
		const fetch = serverEntry.fetch ?? serverEntry.default?.fetch
		if (!fetch) {
			return new Response("TanStack Start server entry is missing a fetch handler", { status: 500 })
		}
		return fetch(request, env, ctx)
	},
} satisfies WorkerModule
