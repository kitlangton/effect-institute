import { type ChildProcess, spawn } from "node:child_process"
import net from "node:net"
import { Console, Context, Effect, Layer, Schedule } from "effect"
import { getBaseUrl, TEMPLATE_ROUTE } from "./config"
import { OgError } from "./errors"

/** Find an available port by binding to port 0 */
const getRandomPort = Effect.callback<number, OgError>((resume) => {
	const server = net.createServer()
	server.listen(0, "localhost", () => {
		const address = server.address()
		const port = typeof address === "object" && address ? address.port : 0
		server.close(() => resume(Effect.succeed(port)))
	})
	server.on("error", (cause) => resume(Effect.fail(new OgError({ message: "Failed to find a free port", cause }))))
})

const isServerReady = (url: string) =>
	Effect.tryPromise({
		try: () => fetch(url).then((res) => res.ok),
		catch: () => false,
	}).pipe(Effect.orElseSucceed(() => false))

const waitForServer = (url: string) =>
	isServerReady(url).pipe(
		Effect.filterOrFail(
			(ready) => ready,
			() => new OgError({ message: "Server not ready" }),
		),
		Effect.retry(Schedule.spaced("500 millis")),
		Effect.timeoutOrElse({
			duration: "45 seconds",
			orElse: () => Effect.fail(new OgError({ message: `Timed out waiting for dev server at ${url}` })),
		}),
	)

/** Start `vite dev` on `port`; the scope's finalizer stops it. */
const startDevServer = Effect.fn("TemplateServer.startDevServer")(function* (port: number) {
	const baseUrl = `http://localhost:${port}`
	yield* Console.log(`Starting temporary Vite server on ${baseUrl}...`)

	const proc: ChildProcess = spawn("bunx", ["vite", "dev", "--port", String(port)], {
		cwd: process.cwd(),
		env: { ...process.env, BROWSER: "none", VITE_DISABLE_REACT_GRAB: "true" },
		stdio: ["ignore", "pipe", "inherit"],
	})
	yield* Effect.addFinalizer(() => Effect.sync(() => proc.kill()))
	proc.stdout?.on("data", (chunk: Buffer) => process.stdout.write(`[og-dev] ${chunk.toString()}`))

	yield* waitForServer(new URL(TEMPLATE_ROUTE, baseUrl).toString())
	return baseUrl
})

/** The site that renders the OG templates: `OG_BASE_URL` if set, otherwise a temporary Vite dev server. */
export class TemplateServer extends Context.Service<TemplateServer, { readonly baseUrl: string }>()(
	"@effect-institute/og/TemplateServer",
) {
	static readonly layer = Layer.effect(
		TemplateServer,
		Effect.gen(function* () {
			const explicitBaseUrl = getBaseUrl()
			if (explicitBaseUrl) return { baseUrl: explicitBaseUrl }
			// Always start our own server on a random port to avoid cross-project contamination
			const baseUrl = yield* startDevServer(yield* getRandomPort)
			return { baseUrl }
		}),
	)
}
