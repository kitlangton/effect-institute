import { spawn } from "node:child_process"
import { createReadStream, existsSync, promises as fs, readdirSync, type Stats } from "node:fs"
import path from "node:path"
import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { authoringPlugin } from "./src/authoring/server/devPlugin"
import { parseRange } from "./src/contentAssets"

/**
 * Watch content DSL files, compile on change, and trigger HMR updates.
 * Sends a single HMR event after build completes (rather than watching
 * output files, which would fire per-file and cause reload loops).
 */
function contentDslPlugin(): Plugin {
	let building = false

	async function buildContent(chapter: string | undefined, server: import("vite").ViteDevServer) {
		if (building) return
		building = true

		const args = ["narrate", "build"]
		if (chapter) args.push(chapter)

		return new Promise<void>((resolve) => {
			const proc = spawn("bun", args, { stdio: "inherit" })
			proc.on("close", (code) => {
				building = false
				if (code === 0) {
					console.log("[content-dsl] Build complete, notifying clients...")
					server.ws.send({
						type: "custom",
						event: "narration-update",
						data: { chapter },
					})
				}
				resolve()
			})
		})
	}

	return {
		name: "content-dsl",
		async configureServer(server) {
			if (process.env.VITEST) return

			server.watcher.add("content/**/*.ts")

			// Production builds publish a filtered artifact set. Restore full authoring output on dev startup.
			console.log("[content-dsl] Building authoring content and watching content/**/*.ts for changes...")
			await buildContent(undefined, server)

			const knownChapters = new Set<string>()
			const contentDir = path.join(process.cwd(), "content")
			if (existsSync(contentDir)) {
				for (const entry of readdirSync(contentDir, { withFileTypes: true })) {
					if (entry.isDirectory()) {
						knownChapters.add(entry.name)
					}
				}
			}

			async function handleContentChange(file: string, isNew: boolean) {
				if (!file.includes("/content/") || !file.endsWith(".ts")) return

				// Extract chapter from path: content/intro/section.ts -> intro
				const match = file.match(/content\/([^/]+)\//)
				const chapter = match?.[1]

				// If this is a new chapter (new index.ts in unknown directory), rebuild all
				// to regenerate the course manifest
				if (isNew && chapter && !knownChapters.has(chapter)) {
					knownChapters.add(chapter)
					console.log(`[content-dsl] New chapter "${chapter}" detected, rebuilding all...`)
					await buildContent(undefined, server)
				} else {
					console.log(`[content-dsl] ${file} changed, rebuilding${chapter ? ` ${chapter}` : ""}...`)
					await buildContent(chapter, server)
				}
			}

			server.watcher.on("change", (file) => handleContentChange(file, false))
			server.watcher.on("add", (file) => handleContentChange(file, true))
		},

		// Prevent Vite from issuing a full page reload when content DSL files
		// change. We rebuild JSON ourselves; the app picks up updates via custom
		// HMR events, so returning an empty array stops Vite's default reload.
		handleHotUpdate(ctx) {
			if (ctx.file.includes("/content/") && ctx.file.endsWith(".ts")) {
				return []
			}
		},
	}
}

async function resolveFirstExisting(
	roots: readonly string[],
	relativePath: string,
): Promise<{ filePath: string; stat: Stats } | null> {
	for (const root of roots) {
		const candidate = path.resolve(root, relativePath)
		try {
			return { filePath: candidate, stat: await fs.stat(candidate) }
		} catch {
			// Try the next content root.
		}
	}
	return null
}

function contentAssetsPlugin(): Plugin {
	return {
		name: "content-assets",
		configureServer(server) {
			const roots = [path.join(process.cwd(), ".authoring", "content"), path.join(process.cwd(), "public", "content")]
			server.middlewares.use(async (req, res, next) => {
				if (!req.url || (req.method !== "GET" && req.method !== "HEAD")) return next()

				const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname)
				const isWebm = pathname.endsWith(".webm")
				const isJson = pathname.endsWith(".json")
				if (!pathname.startsWith("/content/") || (!isWebm && !isJson)) return next()

				const relativePath = path.normalize(pathname.slice("/content/".length))
				if (relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
					res.statusCode = 403
					res.end()
					return
				}

				try {
					const found = await resolveFirstExisting(roots, relativePath)
					if (!found) return next()

					const { filePath, stat } = found
					const size = stat.size

					res.setHeader("Content-Type", isWebm ? "video/webm" : "application/json")
					if (isWebm) res.setHeader("Accept-Ranges", "bytes")

					const rangeHeader = isWebm && req.method === "GET" ? req.headers.range : undefined
					const parsedRange = rangeHeader ? parseRange(rangeHeader, size) : undefined

					if (parsedRange === "unsatisfiable") {
						res.statusCode = 416
						res.setHeader("Content-Range", `bytes */${size}`)
						res.end()
						return
					}

					if (parsedRange) {
						res.statusCode = 206
						res.setHeader("Content-Range", `bytes ${parsedRange.start}-${parsedRange.end}/${size}`)
						res.setHeader("Content-Length", parsedRange.end - parsedRange.start + 1)
						createReadStream(filePath, { start: parsedRange.start, end: parsedRange.end }).pipe(res)
						return
					}

					res.setHeader("Content-Length", size)
					if (req.method === "HEAD") {
						res.end()
						return
					}
					createReadStream(filePath).pipe(res)
				} catch {
					next()
				}
			})
		},
	}
}

const isVitest = Boolean(process.env.VITEST)

const config = defineConfig({
	// Keep prior console output (so Effect logs and stack traces aren't wiped each rebuild)
	clearScreen: false,
	resolve: {
		tsconfigPaths: true,
	},
	server: {
		watch: {
			// Ignore generated content files - we manage HMR ourselves via contentDslPlugin
			ignored: ["**/.authoring/content/**", "**/public/content/**"],
			// Vitest spins up a Vite server internally; polling avoids hitting macOS
			// file-watch limits (EMFILE: too many open files, watch).
			...(isVitest ? { usePolling: true, interval: 100 } : {}),
		},
	},
	plugins: [
		...(isVitest
			? []
			: [
					contentAssetsPlugin(),
					tailwindcss(),
					contentDslPlugin(),
					// Dev only (apply: "serve"): recording, alignment and generation endpoints under /__authoring/*.
					authoringPlugin(),
					cloudflare({ viteEnvironment: { name: "ssr" } }),
					tanstackStart(),
				]),
		viteReact(),
	],
})

export default config
