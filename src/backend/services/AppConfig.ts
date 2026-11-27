import { NodeServices } from "@effect/platform-node"
import { Context, Effect, FileSystem, Layer, Path } from "effect"

const CONTENT_DIR_NAME = "content"

/**
 * Walk up from a starting directory until we find package.json.
 * Falls back to process.cwd() in bundled environments.
 */
const findProjectRoot = (startDir: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem
		const path = yield* Path.Path

		let dir = startDir
		while (dir !== path.dirname(dir)) {
			if (yield* fs.exists(path.join(dir, "package.json"))) {
				return dir
			}
			dir = path.dirname(dir)
		}
		yield* Effect.logDebug(`Could not find project root from ${startDir}, using cwd`)
		return process.cwd()
	})

export interface AppConfigShape {
	/** Repository root (the directory holding package.json) */
	readonly projectRoot: string
	/** Filesystem path to authored chapter DSL directory (content/) */
	readonly coursesDir: string
	/** Filesystem path to source narration audio directory (assets/audio/) */
	readonly audioSourceDir: string
	/** Filesystem path to mutable authoring content output (.authoring/content/) */
	readonly contentDir: string
	/** Filesystem path to tracked published content output (public/content/) */
	readonly publishedContentDir: string
}

export class AppConfig extends Context.Service<AppConfig, AppConfigShape>()("@effect-institute/AppConfig") {
	static readonly layer = Layer.effect(
		AppConfig,
		Effect.gen(function* () {
			const path = yield* Path.Path
			const projectRoot = yield* findProjectRoot(import.meta.dirname)
			return AppConfig.of({
				projectRoot,
				coursesDir: path.join(projectRoot, CONTENT_DIR_NAME),
				audioSourceDir: path.join(projectRoot, "assets", "audio"),
				contentDir: path.join(projectRoot, ".authoring", CONTENT_DIR_NAME),
				publishedContentDir: path.join(projectRoot, "public", CONTENT_DIR_NAME),
			})
		}),
	)

	static readonly defaultLayer = AppConfig.layer.pipe(Layer.provide(NodeServices.layer))
}
