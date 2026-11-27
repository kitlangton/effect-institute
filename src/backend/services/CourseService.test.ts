import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect, FileSystem, Layer } from "effect"
import { hash } from "@/lib/content/compile"
import { AppConfig, type AppConfigShape } from "./AppConfig"
import { CourseService } from "./CourseService"

const dslImportPath = new URL("../../lib/content/dsl.ts", import.meta.url).pathname

const fixtureSource = `
import { chapter, group, section } from ${JSON.stringify(dslImportPath)}

export default chapter("fixture", "Fixture", [
	group("published", "Published", [section("lesson", { transcript: "Hello world.", code: "const x = 1" })]),
	group("draft", "Draft", [section("draft-lesson", { transcript: "Draft only.", code: "const y = 2" })], { draft: true }),
])
`

const brokenFixtureSource = `
throw new Error("broken chapter definition")
`

const withCourse = <A, E>(
	test: (course: CourseService["Service"], fs: FileSystem.FileSystem, config: AppConfigShape) => Effect.Effect<A, E>,
) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem
		const root = yield* fs.makeTempDirectoryScoped()
		const config = AppConfig.of({
			coursesDir: `${root}/content`,
			audioSourceDir: `${root}/assets/audio`,
			contentDir: `${root}/.authoring/content`,
			publishedContentDir: `${root}/public/content`,
		})
		yield* fs.makeDirectory(`${config.coursesDir}/fixture`, { recursive: true })
		yield* fs.writeFileString(`${config.coursesDir}/fixture/index.ts`, fixtureSource)
		yield* fs.makeDirectory(`${config.audioSourceDir}/fixture`, { recursive: true })
		yield* fs.writeFile(`${config.audioSourceDir}/fixture/lesson.webm`, new Uint8Array([1, 2, 3]))

		const layer = CourseService.layer.pipe(
			Layer.provide(Layer.succeed(AppConfig, config)),
			Layer.provide(NodeServices.layer),
		)
		return yield* Effect.gen(function* () {
			const course = yield* CourseService
			return yield* test(course, fs, config)
		}).pipe(Effect.provide(layer))
	}).pipe(Effect.scoped, Effect.provide(NodeServices.layer))

const chapterManifest = (fs: FileSystem.FileSystem, config: AppConfigShape) =>
	fs.readFileString(`${config.contentDir}/fixture/manifest.json`).pipe(Effect.map((content) => JSON.parse(content)))

const publishedChapterManifest = (fs: FileSystem.FileSystem, config: AppConfigShape) =>
	fs
		.readFileString(`${config.publishedContentDir}/fixture/manifest.json`)
		.pipe(Effect.map((content) => JSON.parse(content)))

describe("CourseService publication", () => {
	it.effect("prunes superseded authoring hashes after installing the replacement manifest", () =>
		withCourse((course, fs, config) =>
			Effect.gen(function* () {
				yield* course.build("fixture")
				const firstManifest = yield* chapterManifest(fs, config)
				const firstSection = firstManifest.sections.find((section: { id: string }) => section.id === "lesson")
				const firstArtifact = firstSection.file as string
				const firstBuilt = yield* course.readSection("fixture", "lesson")
				const firstAudio = firstBuilt.audioFile as string

				yield* fs.writeFile(`${config.audioSourceDir}/fixture/lesson.webm`, new Uint8Array([4, 5, 6]))
				yield* course.build("fixture")
				const nextManifest = yield* chapterManifest(fs, config)
				const nextSection = nextManifest.sections.find((section: { id: string }) => section.id === "lesson")
				const nextBuilt = yield* course.readSection("fixture", "lesson")

				expect(nextSection.file).not.toBe(firstArtifact)
				expect(nextBuilt.audioFile).not.toBe(firstAudio)
				expect(yield* fs.exists(`${config.contentDir}/fixture/${firstArtifact}`)).toBe(false)
				expect(yield* fs.exists(`${config.contentDir}/fixture/${firstAudio}`)).toBe(false)
				expect(yield* fs.exists(`${config.contentDir}/fixture/${nextSection.file}`)).toBe(true)
				expect(yield* fs.exists(`${config.contentDir}/fixture/${nextBuilt.audioFile}`)).toBe(true)
			}),
		),
	)

	it.effect("published cleanup preserves preview and timing sidecars while removing draft delivery", () =>
		withCourse((course, fs, config) =>
			Effect.gen(function* () {
				const chapterDir = `${config.publishedContentDir}/fixture`
				yield* fs.makeDirectory(chapterDir, { recursive: true })
				yield* fs.writeFileString(`${chapterDir}/preview-lesson-take.webm`, "preview")
				yield* fs.writeFileString(`${chapterDir}/preview-lesson-take.timings.json`, "{}")
				yield* fs.writeFileString(`${chapterDir}/draft-lesson.timings.json`, "{}")
				yield* fs.writeFileString(`${chapterDir}/draft-lesson.aaaaaaaa.json`, "{}")
				yield* fs.writeFileString(`${chapterDir}/draft-lesson.aaaaaaaa.webm`, "draft")

				yield* course.build(undefined, { includeDrafts: false })
				const manifest = yield* publishedChapterManifest(fs, config)

				expect(manifest.sections.map((section: { id: string }) => section.id)).toEqual(["lesson"])
				expect(yield* fs.exists(`${chapterDir}/preview-lesson-take.webm`)).toBe(true)
				expect(yield* fs.exists(`${chapterDir}/preview-lesson-take.timings.json`)).toBe(true)
				expect(yield* fs.exists(`${chapterDir}/draft-lesson.timings.json`)).toBe(true)
				expect(yield* fs.exists(`${chapterDir}/draft-lesson.aaaaaaaa.json`)).toBe(false)
				expect(yield* fs.exists(`${chapterDir}/draft-lesson.aaaaaaaa.webm`)).toBe(false)
			}),
		),
	)

	it.effect("failed published rebuild leaves the committed manifest artifacts available", () =>
		withCourse((course, fs, config) =>
			Effect.gen(function* () {
				yield* course.build(undefined, { includeDrafts: false })
				const committed = yield* publishedChapterManifest(fs, config)
				const section = committed.sections[0]
				const built = yield* course.readSection("fixture", "lesson")
				yield* fs.remove(`${config.audioSourceDir}/fixture/lesson.webm`)

				const result = yield* Effect.exit(course.build(undefined, { includeDrafts: false }))
				const retained = yield* publishedChapterManifest(fs, config)

				expect(result._tag).toBe("Failure")
				expect(retained.sections[0].file).toBe(section.file)
				expect(yield* fs.exists(`${config.publishedContentDir}/fixture/${section.file}`)).toBe(true)
				expect(yield* fs.exists(`${config.publishedContentDir}/fixture/${built.audioFile}`)).toBe(true)
			}),
		),
	)

	it.effect("published build removes timings sidecars of sections deleted from the DSL", () =>
		withCourse((course, fs, config) =>
			Effect.gen(function* () {
				const chapterDir = `${config.publishedContentDir}/fixture`
				yield* fs.makeDirectory(chapterDir, { recursive: true })
				yield* fs.writeFileString(`${chapterDir}/removed-lesson.timings.json`, "{}")
				yield* fs.writeFileString(`${chapterDir}/lesson.timings.json`, "{}")

				yield* course.build(undefined, { includeDrafts: false })

				expect(yield* fs.exists(`${chapterDir}/removed-lesson.timings.json`)).toBe(false)
				expect(yield* fs.exists(`${chapterDir}/lesson.timings.json`)).toBe(true)
			}),
		),
	)

	it.effect("authoring rebuild can read tracked published timings as a fallback", () =>
		withCourse((course, fs, config) =>
			Effect.gen(function* () {
				const publishedChapterDir = `${config.publishedContentDir}/fixture`
				yield* fs.makeDirectory(publishedChapterDir, { recursive: true })
				yield* fs.writeFileString(
					`${publishedChapterDir}/lesson.timings.json`,
					JSON.stringify(
						{
							wordTimings: [
								{ index: 0, word: "Hello", start: 1, end: 1.5 },
								{ index: 1, word: "world", start: 1.5, end: 2 },
							],
							textHash: hash("Hello world."),
							wordCount: 2,
						},
						null,
						"\t",
					),
				)

				yield* course.build("fixture")
				const built = yield* course.readSection("fixture", "lesson")

				expect(built._debug?.timingsStatus).toBe("matched")
				expect(built.wordTimings[0].start).toBe(1)
			}),
		),
	)

	it.effect("strict authoring rebuild fails when requested chapter artifacts are invalid", () =>
		withCourse((course, fs, config) =>
			Effect.gen(function* () {
				yield* fs.writeFileString(`${config.coursesDir}/fixture/index.ts`, brokenFixtureSource)

				const result = yield* Effect.exit(course.build("fixture", { failOnError: true }))

				expect(result._tag).toBe("Failure")
			}),
		),
	)
})
