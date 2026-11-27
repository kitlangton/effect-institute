import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect, FileSystem, Layer, Option } from "effect"
import { AppConfig } from "@/backend/services/AppConfig"
import { CourseService } from "@/backend/services/CourseService"
import { Audio } from "./Audio"
import { ElevenLabs } from "./ElevenLabs"
import { MissingSettingError } from "./env"
import { Narration } from "./Narration"

const contentImport = JSON.stringify(new URL("../../lib/content/index.ts", import.meta.url).pathname)

const fixture = `
import { chapter, line, on, section, stack } from ${contentImport}

export default chapter("fixture", "Fixture", [
	section("lesson", {
		transcript: "Effects are lazy. Run them explicitly.",
		code: { animation: stack(line("a", "const a = 1")), flow: [on("explicitly").focus("a")] },
	}),
])
`

const brokenFixture = `
import { chapter, line, on, section, stack } from ${contentImport}

export default chapter("broken", "Broken", [
	section("lesson", {
		transcript: "This flow points at a missing word.",
		code: { animation: stack(line("a", "const a = 1")), flow: [on("nowhere").focus("a")] },
	}),
])
`

/** Stand-in for ffmpeg: copies the input and reports a fixed duration. */
const fakeAudio = Layer.effect(
	Audio,
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem
		return Audio.of({
			process: (input, output) =>
				fs.copyFile(input, output).pipe(Effect.as({ durationSeconds: 3, customChain: false }), Effect.orDie),
			duration: () => Effect.succeed(3),
			ffmpegVersion: () => Effect.succeed(Option.some("ffmpeg fake")),
		})
	}),
)

/** Stand-in for ElevenLabs: without a key it fails like the real client; with one it aligns word by word. */
const fakeElevenLabs = (withKey: boolean) =>
	Layer.succeed(
		ElevenLabs,
		ElevenLabs.of({
			forcedAlignment: (_audio, _name, transcript) =>
				withKey
					? Effect.succeed({
							words: transcript.split(" ").map((word, i) => ({ word, start: i * 0.5, end: i * 0.5 + 0.4 })),
							loss: 0.1,
						})
					: Effect.fail(
							new MissingSettingError({ name: "ELEVENLABS_API_KEY", message: "ELEVENLABS_API_KEY is not set" }),
						),
			textToSpeech: (text) =>
				Effect.succeed({
					audio: new Uint8Array([9, 9, 9]),
					words: text.split(" ").map((word, i) => ({ word, start: i * 0.3, end: i * 0.3 + 0.25 })),
				}),
		}),
	)

const withProject = <A, E>(
	withKey: boolean,
	test: (narration: Narration["Service"], fs: FileSystem.FileSystem, root: string) => Effect.Effect<A, E>,
) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem
		const root = yield* fs.makeTempDirectoryScoped()
		const config = AppConfig.of({
			projectRoot: root,
			coursesDir: `${root}/content`,
			audioSourceDir: `${root}/assets/audio`,
			contentDir: `${root}/.authoring/content`,
			publishedContentDir: `${root}/public/content`,
		})
		yield* fs.makeDirectory(`${root}/content/fixture`, { recursive: true })
		yield* fs.writeFileString(`${root}/content/fixture/index.ts`, fixture)
		yield* fs.makeDirectory(`${root}/content/broken`, { recursive: true })
		yield* fs.writeFileString(`${root}/content/broken/index.ts`, brokenFixture)
		yield* fs.writeFile(`${root}/take.webm`, new Uint8Array([1, 2, 3]))

		const appConfig = Layer.succeed(AppConfig, config)
		const layer = Narration.layer.pipe(
			Layer.provide([fakeAudio, fakeElevenLabs(withKey), CourseService.layer.pipe(Layer.provide(appConfig))]),
			Layer.provide(appConfig),
			Layer.provide(NodeServices.layer),
		)
		return yield* Effect.gen(function* () {
			const narration = yield* Narration
			return yield* test(narration, fs, root)
		}).pipe(Effect.provide(layer))
	}).pipe(Effect.scoped, Effect.provide(NodeServices.layer))

const builtSection = (fs: FileSystem.FileSystem, root: string, section: string) =>
	Effect.gen(function* () {
		const manifest = JSON.parse(yield* fs.readFileString(`${root}/.authoring/content/fixture/manifest.json`))
		const entry = manifest.sections.find((s: { id: string }) => s.id === section)
		return JSON.parse(yield* fs.readFileString(`${root}/.authoring/content/fixture/${entry.file}`))
	})

describe("Narration", () => {
	it.effect("records without a key: saves the take, estimates timings, and says how to align", () =>
		withProject(false, (narration, fs, root) =>
			Effect.gen(function* () {
				const result = yield* narration.record("fixture", "lesson", `${root}/take.webm`)
				expect(result.timingsSource).toBe("estimated")
				expect(result.notice).toContain("ELEVENLABS_API_KEY")
				expect(result.notice).toContain("bun narrate align -c fixture lesson")
				expect(result.takePath).toMatch(/^recordings\/fixture\/lesson\/.+\.webm$/)
				expect(yield* fs.exists(`${root}/${result.takePath}`)).toBe(true)
				expect(yield* fs.exists(`${root}/assets/audio/fixture/lesson.webm`)).toBe(true)

				const timings = JSON.parse(yield* fs.readFileString(`${root}/public/content/fixture/lesson.timings.json`))
				expect(timings.source).toBe("estimated")
				expect(timings.wordCount).toBe(6)

				const section = yield* builtSection(fs, root, "lesson")
				expect(section._debug.timingsStatus).toBe("matched")
				expect(section.audioFile).toMatch(/^lesson\.[a-f0-9]{8}\.webm$/)
				expect(section.stepTimes).toHaveLength(2)
			}),
		),
	)

	it.effect("records with a key: aligns the processed take", () =>
		withProject(true, (narration, fs, root) =>
			Effect.gen(function* () {
				const result = yield* narration.record("fixture", "lesson", `${root}/take.webm`)
				expect(result.timingsSource).toBe("aligned")
				expect(result.coverage).toBe(1)
				expect(result.notice).toBeUndefined()
				const timings = JSON.parse(yield* fs.readFileString(`${root}/public/content/fixture/lesson.timings.json`))
				expect(timings.wordTimings[1]).toMatchObject({ index: 1, word: "are", start: 0.5, end: 0.9 })
			}),
		),
	)

	it.effect("generates audio and timings", () =>
		withProject(true, (narration, fs, root) =>
			Effect.gen(function* () {
				const result = yield* narration.generate("fixture", "lesson", { voiceId: "v" })
				expect(result.timingsSource).toBe("generated")
				expect(yield* fs.exists(`${root}/assets/audio/fixture/lesson.webm`)).toBe(true)
			}),
		),
	)

	it.effect("align explains what to do when there is no audio yet", () =>
		withProject(true, (narration) =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(narration.align("fixture", "lesson"))
				expect(error.message).toContain("No audio at assets/audio/fixture/lesson.webm")
			}),
		),
	)

	it.effect("align surfaces the missing key", () =>
		withProject(false, (narration, fs, root) =>
			Effect.gen(function* () {
				yield* fs.makeDirectory(`${root}/assets/audio/fixture`, { recursive: true })
				yield* fs.writeFile(`${root}/assets/audio/fixture/lesson.webm`, new Uint8Array([1]))
				const error = yield* Effect.flip(narration.align("fixture", "lesson"))
				expect(error.message).toContain("ELEVENLABS_API_KEY")
			}),
		),
	)

	it.effect("restores the previous audio and timings when the rebuild fails", () =>
		withProject(true, (narration, fs, root) =>
			Effect.gen(function* () {
				yield* fs.makeDirectory(`${root}/assets/audio/broken`, { recursive: true })
				yield* fs.writeFile(`${root}/assets/audio/broken/lesson.webm`, new Uint8Array([7, 7]))
				const error = yield* Effect.flip(narration.record("broken", "lesson", `${root}/take.webm`))
				expect(error.message).toContain("bun narrate build broken")
				expect([...(yield* fs.readFile(`${root}/assets/audio/broken/lesson.webm`))]).toEqual([7, 7])
				expect(yield* fs.exists(`${root}/public/content/broken/lesson.timings.json`)).toBe(false)
				// The raw take is kept so it can be reused once the lesson builds again.
				expect((yield* fs.readDirectory(`${root}/recordings/broken/lesson`)).length).toBe(1)
			}),
		),
	)

	it.effect("rejects ids that could escape the content directory", () =>
		withProject(true, (narration) =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(narration.align("fixture", "../etc"))
				expect(error.message).toContain("Invalid chapter or section id")
			}),
		),
	)
})
