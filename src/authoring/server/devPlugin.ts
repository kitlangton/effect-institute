/**
 * Dev-only authoring endpoints under /__authoring/*, mounted on the Vite dev server.
 *
 * Only active for "vite dev" (apply: "serve"); "vite build" never runs it, so none of this reaches dist/.
 * It runs in the host Node process, not the Worker runtime, because recording needs the filesystem and ffmpeg.
 * The real work happens in the narrate CLI (spawned with Bun), so the browser and the terminal share one
 * implementation. After a successful run the chapter is rebuilt and the page refreshes through the
 * existing "narration-update" HMR event.
 *
 * This file is loaded by vite.config.ts, so it imports only Node built-ins (no "@/" aliases).
 *
 * @module
 */
import { spawn, spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { mkdir, readdir, stat, writeFile } from "node:fs/promises"
import type { IncomingMessage, ServerResponse } from "node:http"
import path from "node:path"
import type { Plugin, ViteDevServer } from "vite"
import { rejectCrossSite } from "./requestGuard"

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SAFE_TAKE = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024

const EXTENSIONS: Record<string, string> = {
	"audio/webm": ".webm",
	"audio/ogg": ".ogg",
	"audio/mp4": ".m4a",
	"audio/mpeg": ".mp3",
	"audio/wav": ".wav",
	"audio/x-wav": ".wav",
}

export interface AuthoringStatus {
	readonly ffmpeg: boolean
	readonly elevenLabsKey: boolean
	readonly voiceId: boolean
}

export interface Take {
	readonly id: string
	readonly createdAt: string
	readonly sizeBytes: number
}

class HttpError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message)
	}
}

/** Whether a setting has a non-empty value in the environment or the project's .env file. */
const hasSetting = (root: string, name: string): boolean => {
	if (process.env[name]?.trim()) return true
	const file = path.join(root, ".env")
	if (!existsSync(file)) return false
	return readFileSync(file, "utf8")
		.split("\n")
		.some((line) => {
			const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/)
			return match?.[1] === name && match[2].replace(/^["']|["']$/g, "").trim().length > 0
		})
}

const readBody = (req: IncomingMessage) =>
	new Promise<Buffer>((resolve, reject) => {
		const chunks: Buffer[] = []
		let size = 0
		req.on("data", (chunk: Buffer) => {
			size += chunk.length
			if (size > MAX_UPLOAD_BYTES) {
				reject(new HttpError(413, "Recording is too large"))
				req.destroy()
				return
			}
			chunks.push(chunk)
		})
		req.on("end", () => resolve(Buffer.concat(chunks)))
		req.on("error", reject)
	})

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
	res.statusCode = status
	res.setHeader("Content-Type", "application/json")
	res.end(JSON.stringify(body))
}

/** Run a narrate command with --json, echoing its output to the dev server terminal. */
const runNarrate = (root: string, args: ReadonlyArray<string>) =>
	new Promise<{ ok: boolean; result?: unknown; error?: string }>((resolve) => {
		const child = spawn("bun", ["src/lib/tooling/cli.ts", ...args, "--json"], { cwd: root })
		let stdout = ""
		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString()
			process.stdout.write(chunk)
		})
		child.stderr.on("data", (chunk: Buffer) => process.stderr.write(chunk))
		child.on("error", (error) => resolve({ ok: false, error: `Could not run bun: ${error.message}` }))
		child.on("close", (code) => {
			const last = stdout
				.trim()
				.split("\n")
				.reverse()
				.find((line) => line.startsWith('{"ok"'))
			if (last) {
				try {
					return resolve(JSON.parse(last))
				} catch {
					// fall through
				}
			}
			resolve({ ok: false, error: `bun narrate ${args[0]} exited with ${code}; see the dev server terminal` })
		})
	})

export function authoringPlugin(): Plugin {
	return {
		name: "authoring",
		apply: "serve",
		configureServer(server: ViteDevServer) {
			if (process.env.VITEST) return
			const root = server.config.root
			// One operation per chapter at a time: each one rebuilds the chapter.
			const queues = new Map<string, Promise<unknown>>()
			const serialized = <A>(chapter: string, task: () => Promise<A>): Promise<A> => {
				const next = (queues.get(chapter) ?? Promise.resolve()).then(task, task)
				queues.set(
					chapter,
					next.catch(() => undefined),
				)
				return next
			}

			let ffmpeg: boolean | undefined
			const status = (): AuthoringStatus => {
				ffmpeg ??= spawnSync("ffmpeg", ["-version"]).status === 0
				return {
					ffmpeg,
					elevenLabsKey: hasSetting(root, "ELEVENLABS_API_KEY"),
					voiceId: hasSetting(root, "ELEVENLABS_VOICE_ID"),
				}
			}

			const takesDir = (chapter: string, section: string) => path.join(root, "recordings", chapter, section)

			const listTakes = async (chapter: string, section: string): Promise<Take[]> => {
				const dir = takesDir(chapter, section)
				if (!existsSync(dir)) return []
				const takes = await Promise.all(
					(await readdir(dir))
						.filter((name) => SAFE_TAKE.test(name))
						.map(async (name) => {
							const info = await stat(path.join(dir, name))
							return { id: name, createdAt: info.mtime.toISOString(), sizeBytes: info.size }
						}),
				)
				return takes.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
			}

			const publish = async (chapter: string, args: ReadonlyArray<string>) => {
				const outcome = await serialized(chapter, () => runNarrate(root, args))
				if (outcome.ok) server.ws.send({ type: "custom", event: "narration-update", data: { chapter } })
				return outcome
			}

			server.middlewares.use("/__authoring", async (req, res) => {
				try {
					const refusal = rejectCrossSite({ method: req.method, headers: req.headers })
					if (refusal) throw new HttpError(403, refusal)
					const url = new URL(req.url ?? "/", "http://localhost")
					const route = `${req.method} ${url.pathname}`
					if (route === "GET /status") return sendJson(res, 200, status())

					const chapter = url.searchParams.get("chapter") ?? ""
					const section = url.searchParams.get("section") ?? ""
					if (!SAFE_ID.test(chapter) || !SAFE_ID.test(section)) {
						throw new HttpError(400, "chapter and section must be lowercase, dash-separated IDs")
					}
					const target = ["-c", chapter, section]

					switch (route) {
						case "GET /takes":
							return sendJson(res, 200, { takes: await listTakes(chapter, section) })
						case "POST /record": {
							const audio = await readBody(req)
							if (audio.length === 0) throw new HttpError(400, "Empty recording")
							const type = (req.headers["content-type"] ?? "audio/webm").split(";")[0].trim()
							const dir = takesDir(chapter, section)
							await mkdir(dir, { recursive: true })
							const file = path.join(
								dir,
								`${new Date().toISOString().replace(/[:.]/g, "-")}${EXTENSIONS[type] ?? ".webm"}`,
							)
							await writeFile(file, audio)
							return sendJson(res, 200, await publish(chapter, ["record", ...target, "--file", file]))
						}
						case "POST /takes/use": {
							const take = url.searchParams.get("take") ?? ""
							const file = path.join(takesDir(chapter, section), take)
							if (!SAFE_TAKE.test(take) || !existsSync(file)) throw new HttpError(404, `Take not found: ${take}`)
							return sendJson(res, 200, await publish(chapter, ["record", ...target, "--file", file]))
						}
						case "POST /align":
							return sendJson(res, 200, await publish(chapter, ["align", ...target]))
						case "POST /generate":
							return sendJson(res, 200, await publish(chapter, ["generate", ...target]))
						default:
							throw new HttpError(404, `Unknown authoring route: ${route}`)
					}
				} catch (error) {
					const status = error instanceof HttpError ? error.status : 500
					sendJson(res, status, { ok: false, error: error instanceof Error ? error.message : String(error) })
				}
			})
		},
	}
}
