/**
 * Compiles chapter DSL into hashed delivery artifacts: copies audio with content hashes, writes section JSON,
 * installs the chapter and course manifests atomically, then prunes what the new manifests no longer reference.
 *
 * Authoring builds (`includeDrafts`, the default) write to `.authoring/content`; published builds write the
 * full, draft-free course to `public/content` and always fail on error.
 */

import { Effect, Schema } from "effect"
import { type AnimationDef, stack } from "@/lib/animated-code/animation"
import { compileAndTokenize } from "@/lib/animated-code/animation/compile-with-tokens"
import type { StepRef } from "@/lib/animated-code/flow"
import { compileChapter, compileSectionsWithGroups } from "@/lib/content/compile"
import { type ChapterDef, flattenPublishedSections, flattenSections } from "@/lib/content/dsl"
import {
	type BuildError,
	ChapterLoadError,
	LineIdNotFoundError,
	PatternNotFoundError,
	SectionBuildError,
	SlotNotFoundError,
	WordNotFoundError,
} from "@/lib/content/errors"
import { isNarratedComponentName } from "@/lib/content/narrated-components"
import { resolveStepTimes } from "@/lib/content/resolve-steps"
import { mergeTimings } from "@/lib/content/timing-merge"
import { compress } from "@/lib/neo-code-block/compress"
import type { TemplateSlideshowData } from "@/lib/neo-code-block/types"
import { ChapterManifest, type ChapterMetadata, CourseManifest, SectionData } from "@/lib/tooling/types"
import type { Loader } from "./loader"
import type { makePruner } from "./pruner"
import {
	type BuildOptions,
	type CourseContext,
	computeContentHash,
	courseError,
	FS_CONCURRENCY,
	writeJsonAtomically,
} from "./shared"

const decodeSectionData = Schema.decodeUnknownEffect(SectionData)
const decodeChapterManifest = Schema.decodeUnknownEffect(ChapterManifest)
const decodeCourseManifest = Schema.decodeUnknownEffect(CourseManifest)

type CompiledSectionInput = ReturnType<typeof compileSectionsWithGroups>[number]
type FlowWarning = NonNullable<CompiledSectionInput["warnings"]>[number]

interface SectionBuildResult {
	readonly sectionId: string
	readonly hashedFilename: string
	readonly errors: readonly BuildError[]
}

interface ChapterBuildResult {
	readonly chapter: string
	readonly sections: readonly string[]
	readonly sectionsCount: number
	readonly errors: readonly BuildError[]
}

function formatBuildError(err: BuildError): string {
	switch (err._tag) {
		case "WordNotFoundError": {
			const suggestions = err.suggestions?.slice(0, 3).join(", ") || "none"
			return `[${err.sectionId}] Step "${err.stepName}": word "${err.word}" not in transcript. Suggestions: ${suggestions}`
		}
		case "PatternNotFoundError":
			return `[${err.sectionId}] Step "${err.stepName}": pattern "${err.pattern}" not found for ${err.annotation}`
		case "SlotNotFoundError": {
			const slots = err.availableSlots.join(", ") || "none"
			return `[${err.sectionId}] Step "${err.stepName}": slot "${err.slotName}" not found. Available: ${slots}`
		}
		case "LineIdNotFoundError":
			return `[${err.sectionId}] Step "${err.stepName}": line ID "${err.lineId}" not found`
		case "SectionBuildError":
			return `[${err.sectionId}] Build failed: ${err.message}`
		case "ChapterLoadError":
			return `[${err.chapterId}] Load failed: ${err.message}`
	}
}

/** Typed build errors for the DSL warnings an animation flow produced. */
const flowWarningError = (sectionId: string, w: FlowWarning): BuildError | null => {
	switch (w.type) {
		case "word-not-found":
			return new WordNotFoundError({
				sectionId,
				stepName: w.stepName,
				word: w.word ?? "",
				suggestions: w.suggestions,
			})
		case "pattern-not-found":
			return new PatternNotFoundError({
				sectionId,
				stepName: w.stepName,
				pattern: w.pattern ?? "",
				annotation: w.annotation ?? "",
			})
		case "slot-not-found":
			return new SlotNotFoundError({
				sectionId,
				stepName: w.stepName,
				slotName: w.slotName ?? "",
				availableSlots: w.availableSlots ?? [],
			})
		case "line-id-not-found":
			return new LineIdNotFoundError({ sectionId, stepName: w.stepName, lineId: w.lineId ?? "" })
		default:
			return null
	}
}

/** Static code becomes a one-snapshot animation so every section renders through the same player. */
export const slideshowFor = (compiled: CompiledSectionInput) => {
	if (compiled.animation) {
		const animDef: AnimationDef = {
			animation: compiled.animation.animation as AnimationDef["animation"],
			snapshots: compiled.animation.snapshots as AnimationDef["snapshots"],
		}
		return Effect.promise(() => compileAndTokenize(animDef, "typescript")).pipe(
			Effect.map((raw) => ({ slideshowData: compress(raw), steps: compiled.animation?.steps })),
		)
	}
	if (compiled.code) {
		const animDef: AnimationDef = { animation: stack(...compiled.code.split("\n")), snapshots: [{}] }
		return Effect.promise(() => compileAndTokenize(animDef, "typescript")).pipe(
			Effect.map((raw) => ({
				slideshowData: compress(raw),
				steps: [{ name: "start", at: "start" as const }] as readonly StepRef[],
			})),
		)
	}
	return Effect.succeed({ slideshowData: undefined as TemplateSlideshowData | undefined, steps: undefined })
}

export const makeBuilder = (ctx: CourseContext, loader: Loader, pruner: ReturnType<typeof makePruner>) => {
	const { fs, path, config } = ctx

	/**
	 * Copy audio from `assets/audio/<chapter>/` into a content root with content-hashed filenames.
	 * Returns sectionId → hashed filename.
	 */
	const copyAudioFiles = Effect.fn("CourseService.copyAudioFiles")(function* (
		contentOutputDir: string,
		chapterId: string,
		includedSectionIds?: ReadonlySet<string>,
	) {
		const sourceDir = path.join(config.audioSourceDir, chapterId)
		const destDir = path.join(contentOutputDir, chapterId)
		const hashMap = new Map<string, string>()
		if (!(yield* fs.exists(sourceDir).pipe(Effect.orElseSucceed(() => false)))) return hashMap

		yield* fs
			.makeDirectory(destDir, { recursive: true })
			.pipe(Effect.mapError((e) => courseError(`Failed to create dir: ${e}`, e)))

		const files = yield* fs
			.readDirectory(sourceDir)
			.pipe(Effect.mapError((e) => courseError(`Failed to read source dir: ${e}`, e)))
		const audioFiles = files.filter((file) => {
			if (!file.endsWith(".webm") || file.endsWith(".processing.webm")) return false
			return includedSectionIds?.has(file.slice(0, -".webm".length)) ?? true
		})

		const copied = yield* Effect.forEach(
			audioFiles,
			(audioFile) =>
				Effect.gen(function* () {
					const src = path.join(sourceDir, audioFile)
					const content = yield* fs.readFile(src)
					const sectionId = audioFile.slice(0, -".webm".length)
					const hashedFilename = `${sectionId}.${computeContentHash(content)}.webm`
					yield* fs.writeFile(path.join(destDir, hashedFilename), content)
					return [sectionId, hashedFilename] as const
				}).pipe(Effect.mapError((e) => courseError(`Failed to copy audio ${audioFile}: ${e}`, e))),
			{ concurrency: FS_CONCURRENCY },
		)
		for (const [sectionId, hashedFilename] of copied) hashMap.set(sectionId, hashedFilename)
		return hashMap
	})

	/** Read the section's timings sidecar. Authoring builds fall back to the tracked published copy. */
	const readTimings = (contentOutputDir: string, chapterId: string, sectionId: string) => {
		const readIfExists = (filePath: string) =>
			fs.exists(filePath).pipe(
				Effect.flatMap((exists) => (exists ? fs.readFileString(filePath) : Effect.succeed(null))),
				Effect.orElseSucceed(() => null),
			)
		const own = readIfExists(path.join(contentOutputDir, chapterId, `${sectionId}.timings.json`))
		if (contentOutputDir === config.publishedContentDir) return own
		const published = path.join(config.publishedContentDir, chapterId, `${sectionId}.timings.json`)
		return own.pipe(Effect.flatMap((content) => (content === null ? readIfExists(published) : Effect.succeed(content))))
	}

	/** Build one section's JSON artifact. Never fails: problems are returned as typed build errors. */
	const buildSection = (
		contentOutputDir: string,
		chapterId: string,
		compiled: CompiledSectionInput,
		/** Hashed audio filename from copyAudioFiles, if available */
		audioFile: string | undefined,
		validatePublishedArtifacts: boolean,
	): Effect.Effect<SectionBuildResult> =>
		Effect.gen(function* () {
			const sectionId = compiled.id
			const failed = (errors: readonly BuildError[]): SectionBuildResult => ({ sectionId, hashedFilename: "", errors })
			const failWith = (message: string) =>
				Effect.gen(function* () {
					const err = new SectionBuildError({ sectionId, message })
					yield* Effect.logError(`[${sectionId}] ${err.message}`)
					return failed([...errors, err])
				})

			const errors: BuildError[] = []
			for (const warning of compiled.warnings ?? []) {
				const err = flowWarningError(sectionId, warning)
				if (err) {
					yield* Effect.logError(`[${sectionId}] ${err.message}`)
					errors.push(err)
				}
			}

			// Merge the timings sidecar with the DSL's parsed words.
			const timingResult = mergeTimings(
				yield* readTimings(contentOutputDir, chapterId, sectionId),
				compiled.parsedWords,
			)
			const { wordTimings, status: timingsStatus } = timingResult
			if (timingsStatus === "mismatched" && timingResult.mismatch) {
				const { reason, timingsWordCount, dslWordCount } = timingResult.mismatch
				if (reason === "word-count") {
					yield* Effect.logWarning(
						`${sectionId}: Transcript word count changed! Timings has ${timingsWordCount} words, DSL has ${dslWordCount}. Re-record to fix.`,
					)
				} else if (reason === "content-changed") {
					yield* Effect.logWarning(
						`${sectionId}: Transcript content changed (same word count but different words). Re-record to fix.`,
					)
				}
			}

			// Prepare output (exclude helper fields)
			const { parsedWords: _parsedWords, warnings: _warnings, animation: _animation, ...rest } = compiled

			if (validatePublishedArtifacts && !audioFile) {
				return yield* failWith("Published narrated section has no audio artifact")
			}
			if (validatePublishedArtifacts && rest.componentFlow && !isNarratedComponentName(rest.componentFlow.name)) {
				return yield* failWith(`Unknown narrated component: ${rest.componentFlow.name}`)
			}

			const { slideshowData, steps } = yield* slideshowFor(compiled)

			// Precompute step times when timings match the transcript
			let stepTimes: number[] | undefined
			let componentStepTimes: number[] | undefined
			if (timingsStatus === "matched") {
				if (steps && steps.length > 0) stepTimes = resolveStepTimes(steps, wordTimings)
				const componentSteps = rest.componentFlow?.steps as StepRef[] | undefined
				if (componentSteps && componentSteps.length > 0) {
					componentStepTimes = resolveStepTimes(componentSteps, wordTimings)
				}
			}

			const output = {
				...rest,
				wordTimings,
				...(slideshowData ? { slideshowData } : {}),
				...(steps ? { steps } : {}),
				...(stepTimes ? { stepTimes } : {}),
				...(componentStepTimes ? { componentStepTimes } : {}),
				...(audioFile ? { audioFile } : {}),
				_debug: {
					timingsStatus,
					dslWordCount: compiled.parsedWords.length,
					...(timingsStatus === "mismatched" && {
						message: "Transcript changed. Re-record audio to fix word highlighting.",
					}),
					...(timingsStatus === "none" && { message: "No audio recorded yet." }),
				},
			}

			const validated = yield* decodeSectionData(output).pipe(Effect.result)
			if (validated._tag === "Failure") {
				return yield* failWith(`Invalid emitted section artifact: ${validated.failure}`)
			}

			const jsonContent = JSON.stringify(validated.success, null, "\t")
			const hashedFilename = `${sectionId}.${computeContentHash(jsonContent)}.json`
			const written = yield* fs
				.writeFileString(path.join(contentOutputDir, chapterId, hashedFilename), jsonContent)
				.pipe(Effect.result)
			if (written._tag === "Failure") {
				return yield* failWith(`Failed to write: ${written.failure}`)
			}

			return { sectionId, hashedFilename, errors }
		})

	const buildChapter = Effect.fn("CourseService.buildChapter")(function* (
		contentOutputDir: string,
		chapterId: string,
		chapter: ChapterDef,
		audioHashMap: ReadonlyMap<string, string>,
		includeDrafts: boolean,
	) {
		const chapterDir = path.join(contentOutputDir, chapterId)
		yield* fs.makeDirectory(chapterDir, { recursive: true }).pipe(Effect.ignore)

		const compiledSections = yield* Effect.try({
			try: () => compileSectionsWithGroups(chapter, { includeDrafts }),
			catch: (cause) => new ChapterLoadError({ chapterId, message: `Invalid chapter definition: ${cause}` }),
		}).pipe(Effect.result)
		if (compiledSections._tag === "Failure") {
			return { chapter: chapterId, sections: [], sectionsCount: 0, errors: [compiledSections.failure] }
		}

		const sectionResults = yield* Effect.forEach(
			compiledSections.success,
			(compiled) => buildSection(contentOutputDir, chapterId, compiled, audioHashMap.get(compiled.id), !includeDrafts),
			{ concurrency: FS_CONCURRENCY },
		)
		const errors = sectionResults.flatMap((result) => result.errors)
		const built = sectionResults.filter((result) => result.errors.length === 0)
		const result: ChapterBuildResult = {
			chapter: chapterId,
			sections: built.map((section) => section.sectionId),
			sectionsCount: compiledSections.success.length,
			errors,
		}
		if (errors.length > 0) return result

		// Install the chapter manifest, then prune what it no longer references.
		const jsonHashMap = new Map(built.map((section) => [section.sectionId, section.hashedFilename]))
		const manifest = yield* decodeChapterManifest(compileChapter(chapter, jsonHashMap, { includeDrafts })).pipe(
			Effect.mapError((cause) => courseError(`Invalid chapter manifest for ${chapterId}: ${cause}`, cause)),
		)
		yield* writeJsonAtomically(fs, path.join(chapterDir, "manifest.json"), JSON.stringify(manifest, null, "\t"))

		if (includeDrafts) {
			yield* pruner.pruneSupersededHashedArtifacts(contentOutputDir, chapterId, manifest, audioHashMap)
		} else {
			yield* pruner.pruneUnreferencedDeliveryArtifacts(contentOutputDir, chapterId, manifest, audioHashMap)
			const allIds = flattenSections(chapter).map((section) => section.id)
			const publishedIds = new Set(flattenPublishedSections(chapter).map((section) => section.id))
			yield* pruner.removeSectionArtifacts(
				contentOutputDir,
				chapterId,
				allIds.filter((sectionId) => !publishedIds.has(sectionId)),
			)
			yield* pruner.pruneOrphanedTimings(contentOutputDir, chapterId, new Set(allIds))
		}

		return result
	})

	/** Explicit `order` first (ascending), then alphabetically. */
	const sortChapters = Effect.fn("CourseService.sortChapters")(function* (chapterIds: readonly string[]) {
		const withOrder = yield* Effect.forEach(
			chapterIds,
			(id) =>
				loader.loadChapterForBuild(id).pipe(
					Effect.map((def) => ({ id, order: def.order })),
					Effect.orElseSucceed(() => ({ id, order: undefined as number | undefined })),
				),
			{ concurrency: FS_CONCURRENCY },
		)
		return withOrder
			.sort((a, b) => {
				if (a.order !== undefined && b.order !== undefined) return a.order - b.order
				if (a.order !== undefined) return -1
				if (b.order !== undefined) return 1
				return a.id.localeCompare(b.id)
			})
			.map((chapter) => chapter.id)
	})

	const build = Effect.fn("CourseService.build")(function* (chapterFilter?: string, options?: BuildOptions) {
		const includeDrafts = options?.includeDrafts !== false
		const failOnError = options?.failOnError === true || !includeDrafts
		const contentOutputDir = includeDrafts ? config.contentDir : config.publishedContentDir
		if (!includeDrafts && chapterFilter) {
			return yield* courseError("Published builds must build the full course manifest")
		}

		const chapters = yield* sortChapters(chapterFilter ? [chapterFilter] : yield* loader.discoverChapters())
		yield* Effect.log(`Building ${chapters.length} chapter(s)...`)

		// Copy audio, compile sections and return the chapter's manifest entry (null when skipped or failed)
		const buildOneChapter = Effect.fn("CourseService.buildOneChapter")(function* (
			chapterId: string,
			orderIndex: number,
		) {
			const chapterDef = yield* loader
				.loadChapterForBuild(chapterId)
				.pipe(
					Effect.catch((error) =>
						failOnError
							? Effect.fail(courseError(`Failed to load chapter ${chapterId}: ${error.message}`, error))
							: Effect.succeed(null),
					),
				)
			if (!chapterDef) return null
			if (!includeDrafts && chapterDef.draft) {
				yield* Effect.log(`Skipping draft chapter in published build: ${chapterId}`)
				return null
			}

			// Copy audio first so section JSON can reference the hashed filenames
			const includedSectionIds = includeDrafts
				? undefined
				: new Set(flattenPublishedSections(chapterDef).map((section) => section.id))
			const copyAudio = copyAudioFiles(contentOutputDir, chapterId, includedSectionIds)
			const audioHashMap = yield* failOnError
				? copyAudio.pipe(
						Effect.mapError((e) => courseError(`Failed to publish audio for ${chapterId}: ${e.message}`, e)),
					)
				: copyAudio.pipe(Effect.orElseSucceed(() => new Map<string, string>()))
			if (audioHashMap.size > 0) {
				yield* Effect.log(`  Copied ${audioHashMap.size} audio file(s) with content hashes`)
			}

			const result = yield* buildChapter(contentOutputDir, chapterId, chapterDef, audioHashMap, includeDrafts)

			if (result.errors.length > 0) {
				yield* Effect.logError(`[${chapterId}] Errors:`)
				for (const err of result.errors) {
					yield* Effect.logError(`  - ${formatBuildError(err)}`)
				}
				if (failOnError) {
					return yield* courseError(
						includeDrafts
							? `Strict authoring build failed for ${chapterId}`
							: `Published build failed for ${chapterId}`,
					)
				}
				return null
			}

			yield* Effect.log(`[${chapterId}] Built ${result.sections.length} section(s): ${result.sections.join(", ")}`)

			return {
				id: chapterDef.id,
				title: chapterDef.title,
				...(chapterDef.description && { description: chapterDef.description }),
				order: orderIndex + 1,
				...(chapterDef.draft && { draft: true }),
				...(chapterDef.comingSoon && { comingSoon: true }),
				sectionsCount: result.sectionsCount,
			} satisfies ChapterMetadata
		})

		const chapterResults = yield* Effect.forEach(chapters, (id, index) => buildOneChapter(id, index), {
			concurrency: FS_CONCURRENCY,
		})
		const builtChapters = chapterResults.filter((chapter) => chapter !== null)

		// A filtered build only refreshes one chapter; the course manifest needs every chapter.
		if (chapterFilter) return

		const courseManifest = yield* decodeCourseManifest({ chapters: builtChapters }).pipe(
			Effect.mapError((cause) => courseError(`Invalid course manifest: ${cause}`, cause)),
		)
		yield* writeJsonAtomically(
			fs,
			path.join(contentOutputDir, "manifest.json"),
			JSON.stringify(courseManifest, null, "\t"),
		)
		if (!includeDrafts) {
			const builtIds = new Set<string>(builtChapters.map((chapter) => chapter.id))
			yield* Effect.forEach(
				chapters.filter((chapterId) => !builtIds.has(chapterId)),
				(chapterId) => pruner.removeChapterDeliveryArtifacts(contentOutputDir, chapterId),
				{ concurrency: FS_CONCURRENCY, discard: true },
			)
		}
	})

	return { build }
}
