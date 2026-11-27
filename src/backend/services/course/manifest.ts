/**
 * Course and chapter manifests: chapter metadata and hashed section artifact reads.
 * Reads the mutable authoring root first and falls back to the tracked published root.
 */

import { Effect } from "effect"
import { ChapterManifest, type ChapterMetadata, CourseManifest, SectionData } from "@/lib/tooling/types"
import { type CourseContext, courseError, readJsonFile } from "./shared"

export const makeManifests = (ctx: CourseContext) => {
	const { fs, path, config } = ctx

	/** Try the authoring root, then the published one; report the authoring error if both fail. */
	const authoringThenPublished = <A, E>(read: (contentDir: string) => Effect.Effect<A, E>) =>
		read(config.contentDir).pipe(
			Effect.catch((authoringError) =>
				read(config.publishedContentDir).pipe(Effect.catch(() => Effect.fail(authoringError))),
			),
		)

	const readCourseManifest = Effect.fn("CourseService.readCourseManifest")(function* () {
		return yield* authoringThenPublished((contentDir) =>
			readJsonFile(fs, path.join(contentDir, "manifest.json"), CourseManifest, "course manifest"),
		)
	})

	const listChapters = Effect.fn("CourseService.listChapters")(function* () {
		const manifest = yield* readCourseManifest()
		return [...manifest.chapters].sort((a: ChapterMetadata, b: ChapterMetadata) => a.order - b.order)
	})

	/** The hashed JSON path for a section, from its chapter manifest (authoring first, then published). */
	const getHashedSectionPath = Effect.fn("CourseService.getHashedSectionPath")(function* (
		chapterId: string,
		sectionId: string,
	) {
		return yield* authoringThenPublished((contentDir) =>
			Effect.gen(function* () {
				const manifestPath = path.join(contentDir, chapterId, "manifest.json")
				const manifest = yield* readJsonFile(fs, manifestPath, ChapterManifest, "manifest")
				const entry = manifest.sections.find((s) => s.id === sectionId)
				if (!entry) {
					return yield* courseError(`Section ${sectionId} not found in manifest`)
				}
				return path.join(contentDir, chapterId, entry.file)
			}),
		)
	})

	const readSection = Effect.fn("CourseService.readSection")(function* (chapterId: string, sectionId: string) {
		const filePath = yield* getHashedSectionPath(chapterId, sectionId)
		return yield* readJsonFile(fs, filePath, SectionData)
	})

	return { listChapters, readSection }
}
