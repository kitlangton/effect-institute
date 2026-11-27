/**
 * Removes artifacts a build no longer references. Each function runs only after the replacement manifest is
 * installed, so a failed build never deletes what the committed manifest points at.
 */

import { Effect } from "effect"
import type { ChapterManifest } from "@/lib/tooling/types"
import { type CourseContext, escapeRegExp, HASHED_ARTIFACT, readDirectoryIfExists, removeFiles } from "./shared"

export const makePruner = (ctx: CourseContext) => {
	const { fs, path } = ctx

	const retainedFiles = (manifest: ChapterManifest, audioHashMap?: ReadonlyMap<string, string>) =>
		new Set<string>([...manifest.sections.map((section) => section.file), ...(audioHashMap?.values() ?? [])])

	/** Authoring builds: drop older hashes of the sections this build wrote. */
	const pruneSupersededHashedArtifacts = Effect.fn("CourseService.pruneSupersededHashedArtifacts")(function* (
		contentOutputDir: string,
		chapterId: string,
		manifest: ChapterManifest,
		audioHashMap?: ReadonlyMap<string, string>,
	) {
		const chapterDir = path.join(contentOutputDir, chapterId)
		const retained = retainedFiles(manifest, audioHashMap)
		const sectionIds = new Set<string>([
			...manifest.sections.map((section) => section.id),
			...(audioHashMap?.keys() ?? []),
		])
		const hashedNames = [...sectionIds].map(
			(sectionId) => new RegExp(`^${escapeRegExp(sectionId)}\\.[a-f0-9]{8}\\.(?:json|webm)$`),
		)
		const files = yield* readDirectoryIfExists(fs, chapterDir)
		const stale = files.filter((file) => !retained.has(file) && hashedNames.some((pattern) => pattern.test(file)))
		yield* removeFiles(ctx, chapterDir, stale, "stale artifact")
	})

	/** Published builds: drop every hashed delivery file the new manifest does not reference. */
	const pruneUnreferencedDeliveryArtifacts = Effect.fn("CourseService.pruneUnreferencedDeliveryArtifacts")(function* (
		contentOutputDir: string,
		chapterId: string,
		manifest: ChapterManifest,
		audioHashMap?: ReadonlyMap<string, string>,
	) {
		const chapterDir = path.join(contentOutputDir, chapterId)
		const retained = retainedFiles(manifest, audioHashMap)
		retained.add("manifest.json")
		const files = yield* readDirectoryIfExists(fs, chapterDir)
		const stale = files.filter((file) => !retained.has(file) && HASHED_ARTIFACT.test(file))
		yield* removeFiles(ctx, chapterDir, stale, "stale delivery artifact")
	})

	/** Published builds: remove delivery files of draft sections. Their timings sidecars stay for later recording. */
	const removeSectionArtifacts = Effect.fn("CourseService.removeSectionArtifacts")(function* (
		contentOutputDir: string,
		chapterId: string,
		sectionIds: readonly string[],
	) {
		if (sectionIds.length === 0) return
		const chapterDir = path.join(contentOutputDir, chapterId)
		const files = yield* readDirectoryIfExists(fs, chapterDir)
		const stale = files.filter((file) =>
			sectionIds.some(
				(sectionId) =>
					file !== `${sectionId}.timings.json` &&
					(file === `${sectionId}.json` || file === `${sectionId}.webm` || file.startsWith(`${sectionId}.`)),
			),
		)
		yield* removeFiles(ctx, chapterDir, stale, "unpublished artifact")
	})

	/**
	 * Published builds: remove `<id>.timings.json` for sections that no longer exist in the chapter DSL at all.
	 * Draft sections keep theirs, and preview sidecars (`preview-*`) are never touched.
	 */
	const pruneOrphanedTimings = Effect.fn("CourseService.pruneOrphanedTimings")(function* (
		contentOutputDir: string,
		chapterId: string,
		knownSectionIds: ReadonlySet<string>,
	) {
		const chapterDir = path.join(contentOutputDir, chapterId)
		const files = yield* readDirectoryIfExists(fs, chapterDir)
		const orphaned = files.filter((file) => {
			if (!file.endsWith(".timings.json") || file.startsWith("preview-")) return false
			return !knownSectionIds.has(file.slice(0, -".timings.json".length))
		})
		if (orphaned.length > 0) {
			yield* Effect.log(`  Removing ${orphaned.length} orphaned timings file(s) for removed sections`)
		}
		yield* removeFiles(ctx, chapterDir, orphaned, "orphaned timings")
	})

	/** Published builds: a chapter that became a draft loses its manifest and delivery files. */
	const removeChapterDeliveryArtifacts = Effect.fn("CourseService.removeChapterDeliveryArtifacts")(function* (
		contentOutputDir: string,
		chapterId: string,
	) {
		const chapterDir = path.join(contentOutputDir, chapterId)
		const files = yield* readDirectoryIfExists(fs, chapterDir)
		const delivery = files.filter((file) => file === "manifest.json" || HASHED_ARTIFACT.test(file))
		yield* removeFiles(ctx, chapterDir, delivery, "draft chapter artifact")
	})

	return {
		pruneSupersededHashedArtifacts,
		pruneUnreferencedDeliveryArtifacts,
		removeSectionArtifacts,
		pruneOrphanedTimings,
		removeChapterDeliveryArtifacts,
	}
}
