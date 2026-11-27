/**
 * Chapter OG image capture logic.
 * Captures screenshots of chapter OG pages via Playwright.
 */
import path from "node:path"
import { Console, Effect } from "effect"
import { OUTPUT_DIR } from "../config"
import { screenshotPage } from "../page"
import { TemplateServer } from "../template-server"
import type { ChapterSpec } from "./spec"

const CHAPTER_OG_ROUTE = "/og/chapter"

/** Capture a single chapter OG image, one per chapter at the root of og/ */
export const captureChapterOG = (spec: ChapterSpec) =>
	Effect.gen(function* () {
		const server = yield* TemplateServer
		const params = new URLSearchParams({ title: spec.title, description: spec.description })
		const templateURL = new URL(`${CHAPTER_OG_ROUTE}?${params}`, server.baseUrl).toString()
		return yield* screenshotPage(templateURL, path.join(OUTPUT_DIR, `${spec.id}.png`), "300 millis")
	})

/** Capture multiple chapters in parallel with a concurrency limit. A failed chapter yields null. */
export const captureChapters = (specs: readonly ChapterSpec[], concurrency = 4) =>
	Effect.forEach(
		specs,
		(spec) =>
			captureChapterOG(spec).pipe(
				Effect.tap((filePath) => Console.log(`  Generated: ${path.relative(process.cwd(), filePath)}`)),
				Effect.catch((error) => Console.error(`  Failed ${spec.id}: ${error.message}`).pipe(Effect.as(null))),
			),
		{ concurrency },
	)
