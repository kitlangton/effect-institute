/**
 * Chapter DSL loading: imports `content/<chapter>/index.ts` and answers section questions.
 */

import { Effect } from "effect"
import type { ChapterDef } from "@/lib/content/dsl"
import { flattenSections } from "@/lib/content/dsl"
import { ChapterLoadError } from "@/lib/content/errors"
import { type CourseContext, courseError, FS_CONCURRENCY } from "./shared"

export const makeLoader = ({ fs, path, config }: CourseContext) => {
	// Cache loaded chapters (disabled in dev for HMR)
	const chapterCache = new Map<string, ChapterDef>()
	const isDev = process.env.NODE_ENV !== "production"

	const importChapter = (chapterId: string) => {
		const modulePath = path.join(config.coursesDir, chapterId, "index.ts")
		// Add a cache-busting query param in dev to force a fresh import
		const importPath = isDev ? `${modulePath}?t=${Date.now()}` : modulePath
		return {
			modulePath,
			load: () => import(/* @vite-ignore */ importPath) as Promise<{ default: ChapterDef }>,
		}
	}

	const loadChapter = Effect.fn("CourseService.loadChapter")(function* (chapterId: string) {
		if (!isDev) {
			const cached = chapterCache.get(chapterId)
			if (cached) return cached
		}
		const { load } = importChapter(chapterId)
		const mod = yield* Effect.tryPromise({
			try: load,
			catch: (e) => courseError(`Chapter not found: ${chapterId}`, e),
		})
		if (!isDev) chapterCache.set(chapterId, mod.default)
		return mod.default
	})

	/** Uncached load for builds, failing with the build error type. */
	const loadChapterForBuild = Effect.fn("CourseService.loadChapterForBuild")(function* (chapterId: string) {
		const { modulePath, load } = importChapter(chapterId)
		const mod = yield* Effect.tryPromise({
			try: load,
			catch: () => new ChapterLoadError({ chapterId, message: `Failed to import ${modulePath}` }),
		})
		return mod.default
	})

	const getSection = Effect.fn("CourseService.getSection")(function* (chapterId: string, sectionId: string) {
		const chapter = yield* loadChapter(chapterId)
		const section = flattenSections(chapter).find((s) => s.id === sectionId)
		if (!section) {
			return yield* courseError(`Section not found: ${chapterId}/${sectionId}`)
		}
		return section
	})

	const listSections = Effect.fn("CourseService.listSections")(function* (chapterId: string) {
		const chapter = yield* loadChapter(chapterId)
		return flattenSections(chapter).map((s) => s.id)
	})

	/** Chapter directories under `content/` that have an `index.ts`, in stable order. */
	const discoverChapters = Effect.fn("CourseService.discoverChapters")(function* () {
		const entries = yield* fs
			.readDirectory(config.coursesDir)
			.pipe(Effect.mapError((e) => courseError(`Failed to read content dir: ${e}`, e)))

		const sortedEntries = [...entries].sort((a, b) => a.localeCompare(b))
		const isChapter = yield* Effect.forEach(
			sortedEntries,
			(entry) =>
				Effect.gen(function* () {
					const entryPath = path.join(config.coursesDir, entry)
					const stat = yield* fs.stat(entryPath)
					return stat.type === "Directory" && (yield* fs.exists(path.join(entryPath, "index.ts")))
				}).pipe(Effect.mapError((e) => courseError(`Failed to stat ${entry}: ${e}`, e))),
			{ concurrency: FS_CONCURRENCY },
		)
		return sortedEntries.filter((_, index) => isChapter[index])
	})

	return {
		loadChapter,
		loadChapterForBuild,
		getSection,
		listSections,
		discoverChapters,
	}
}

export type Loader = ReturnType<typeof makeLoader>
