/**
 * OG image generation entry point.
 * Generates home page and chapter OG images in parallel.
 *
 * Usage:
 *   bun scripts/generate-og/main.ts
 *   bun og
 */
import { NodeServices } from "@effect/platform-node"
import { Console, Effect, FileSystem, Layer } from "effect"
import { CourseService } from "@/backend/services"
import { Browser } from "./browser"
import { captureOGImage } from "./capture"
import { OUTPUT_DIR } from "./config"
import { captureChapters } from "./sections/capture-section"
import { collectChapterSpecs } from "./sections/spec"
import { TemplateServer } from "./template-server"

const program = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem
	yield* fs.makeDirectory(OUTPUT_DIR, { recursive: true })

	const server = yield* TemplateServer
	yield* Console.log(`Using OG server at ${server.baseUrl}`)

	yield* Console.log("Collecting chapters...")
	const specs = yield* collectChapterSpecs
	yield* Console.log(`Found ${specs.length} chapters`)

	yield* Console.log("\nGenerating OG images...")
	const [, chapterResults] = yield* Effect.all([captureOGImage, captureChapters(specs, 8)], {
		concurrency: "unbounded",
	})

	const succeeded = chapterResults.filter((r) => r !== null).length
	const failed = chapterResults.length - succeeded
	yield* Console.log(`\nDone! Generated ${succeeded + 1} images${failed > 0 ? `, ${failed} failed` : ""}`)
})

const MainLayer = Layer.mergeAll(Browser.layer, TemplateServer.layer, CourseService.defaultLayer, NodeServices.layer)

Effect.runPromise(program.pipe(Effect.provide(MainLayer))).catch((error) => {
	console.error(error)
	process.exitCode = 1
})
