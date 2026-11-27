/**
 * Narration authoring: record (ingest a take), align, and generate.
 *
 * Every operation ends the same way: write assets/audio/<chapter>/<section>.webm and
 * public/content/<chapter>/<section>.timings.json, then rebuild the chapter. If the rebuild fails,
 * both files are restored, so a failed run never leaves a half-published section.
 *
 * Runs in Bun (the narrate CLI). The dev server reaches it by spawning the CLI.
 *
 * @module
 */
import { NodeServices } from "@effect/platform-node"
import { ConfigProvider, Context, Effect, FileSystem, Layer, Option, Path, Schema } from "effect"
import { AppConfig } from "@/backend/services/AppConfig"
import { CourseService } from "@/backend/services/CourseService"
import { parseTranscript } from "@/lib/content/compile"
import {
	coverage,
	estimateTimings,
	interpolateTimings,
	makeTimingsFile,
	mapAlignedToSource,
	type TimingsFileContent,
	type TimingsSource,
} from "../core/timings"
import { Audio } from "./Audio"
import { DEFAULT_TTS_MODEL, ElevenLabs, type SpeechOptions } from "./ElevenLabs"
import * as Env from "./env"

export class NarrationError extends Schema.TaggedError<NarrationError>()("NarrationError", {
	message: Schema.String,
}) {}

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Below this share of directly matched words, alignment is reported as suspect. */
const LOW_COVERAGE = 0.8

export interface NarrationResult {
	readonly chapter: string
	readonly section: string
	readonly audioPath: string
	readonly timingsPath: string
	readonly timingsSource: TimingsSource
	readonly wordCount: number
	readonly durationSeconds?: number
	/** Share of transcript words the aligner matched directly (aligned and generated only) */
	readonly coverage?: number
	/** Saved raw take (record only) */
	readonly takePath?: string
	/** Something the author should know, e.g. timings were estimated because no key is set */
	readonly notice?: string
}

export interface SectionPaths {
	readonly audio: string
	readonly timings: string
	readonly authoringTimings: string
	readonly takesDir: string
	readonly backupsDir: string
}

export interface AuthoringStatus {
	readonly ffmpeg: Option.Option<string>
	readonly dotEnv: boolean
	readonly elevenLabsKey: boolean
	readonly voiceId: boolean
	readonly modelId: string
	readonly audioChain: boolean
}

export class Narration extends Context.Service<
	Narration,
	{
		readonly paths: (chapter: string, section: string) => SectionPaths
		/** Which tools and settings are available. Reports presence only, never values. */
		readonly status: Effect.Effect<AuthoringStatus>
		/** Process an audio file as the section's narration. Aligns when a key is set, otherwise estimates timings. */
		readonly record: (chapter: string, section: string, file: string) => Effect.Effect<NarrationResult, NarrationError>
		/** Re-align the section's existing audio against its current transcript. Requires ELEVENLABS_API_KEY. */
		readonly align: (chapter: string, section: string) => Effect.Effect<NarrationResult, NarrationError>
		/** Generate narration with ElevenLabs. Requires ELEVENLABS_API_KEY and a voice. */
		readonly generate: (
			chapter: string,
			section: string,
			options?: SpeechOptions,
		) => Effect.Effect<NarrationResult, NarrationError>
	}
>()("@effect-institute/authoring/Narration") {
	static readonly layer = Layer.effect(
		Narration,
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem
			const path = yield* Path.Path
			const config = yield* AppConfig
			const course = yield* CourseService
			const audio = yield* Audio
			const elevenLabs = yield* ElevenLabs
			const provider = yield* ConfigProvider.ConfigProvider

			const fail = (message: string) => Effect.fail(new NarrationError({ message }))
			const relative = (file: string) => path.relative(config.projectRoot, file)

			const paths = (chapter: string, section: string): SectionPaths => ({
				audio: path.join(config.audioSourceDir, chapter, `${section}.webm`),
				timings: path.join(config.publishedContentDir, chapter, `${section}.timings.json`),
				authoringTimings: path.join(config.contentDir, chapter, `${section}.timings.json`),
				takesDir: path.join(config.projectRoot, "recordings", chapter, section),
				backupsDir: path.join(config.projectRoot, "backups", chapter),
			})

			const transcriptOf = Effect.fn("Narration.transcriptOf")(function* (chapter: string, section: string) {
				if (!SAFE_ID.test(chapter) || !SAFE_ID.test(section)) {
					return yield* fail(`Invalid chapter or section id: ${chapter}/${section}`)
				}
				const def = yield* course.getSection(chapter, section)
				const { text, words } = parseTranscript(def.transcript)
				if (words.length === 0) return yield* fail(`${chapter}/${section} has an empty transcript`)
				return { text, words }
			})

			/** Write audio (optional) and timings, rebuild, and restore both files if anything fails. */
			const publish = Effect.fn("Narration.publish")(function* (
				chapter: string,
				section: string,
				timings: TimingsFileContent,
				newAudio?: string,
			) {
				const target = paths(chapter, section)
				const backupDir = yield* fs.makeTempDirectory({ prefix: "narrate-publish-" })
				const files = newAudio ? [target.audio, target.timings] : [target.timings]
				const snapshots = yield* Effect.forEach(files, (file, i) =>
					Effect.gen(function* () {
						const existed = yield* fs.exists(file)
						const copy = path.join(backupDir, String(i))
						if (existed) yield* fs.copyFile(file, copy)
						return { file, copy, existed }
					}),
				)
				const restore = Effect.forEach(
					snapshots,
					(s) => (s.existed ? fs.copyFile(s.copy, s.file) : fs.remove(s.file, { force: true })),
					{ discard: true },
				).pipe(Effect.ignore)

				yield* Effect.gen(function* () {
					if (newAudio) {
						const previous = snapshots[0]
						if (previous?.existed) {
							yield* fs.makeDirectory(target.backupsDir, { recursive: true })
							const stamp = new Date().toISOString().replace(/[:.]/g, "-")
							yield* fs.copyFile(previous.copy, path.join(target.backupsDir, `${section}.${stamp}.webm`))
						}
						yield* fs.makeDirectory(path.dirname(target.audio), { recursive: true })
						yield* fs.copyFile(newAudio, target.audio)
					}
					yield* fs.makeDirectory(path.dirname(target.timings), { recursive: true })
					yield* fs.writeFileString(target.timings, `${JSON.stringify(timings, null, "\t")}\n`)
					// The authoring build prefers .authoring timings over published ones; never let a stale copy win.
					yield* fs.remove(target.authoringTimings, { force: true })
					yield* course.build(chapter, { failOnError: true }).pipe(
						Effect.mapError(
							(e) =>
								new NarrationError({
									message: `${e.message}. The previous audio and timings were kept. Fix the errors above (bun narrate build ${chapter}) and try again.`,
								}),
						),
					)
				}).pipe(
					Effect.onError(() => restore),
					Effect.ensuring(fs.remove(backupDir, { recursive: true, force: true }).pipe(Effect.ignore)),
				)
				return target
			})

			const alignFile = Effect.fn("Narration.alignFile")(function* (
				file: string,
				text: string,
				words: ReadonlyArray<{ readonly word: string }>,
			) {
				const bytes = yield* fs.readFile(file)
				const result = yield* elevenLabs.forcedAlignment(bytes, path.basename(file), text)
				const mapped = mapAlignedToSource(result.words, words)
				if (mapped.length === 0) {
					return yield* fail("Alignment matched none of the transcript words. Does the audio match the transcript?")
				}
				return { spans: interpolateTimings(mapped, words.length), coverage: coverage(mapped, words.length) }
			})

			const coverageNotice = (value: number) =>
				value < LOW_COVERAGE
					? { notice: `Only ${Math.round(value * 100)}% of words were matched directly; check the highlighting.` }
					: {}

			const record = Effect.fn("Narration.record")(function* (chapter: string, section: string, file: string) {
				const { text, words } = yield* transcriptOf(chapter, section)
				const target = paths(chapter, section)
				const input = path.resolve(file)
				if (!(yield* fs.exists(input))) return yield* fail(`Audio file not found: ${file}`)

				// Keep every raw take under recordings/ (gitignored) so it can be reprocessed later.
				const insideTakes = path.relative(target.takesDir, input)
				let takePath = input
				if (insideTakes.startsWith("..") || path.isAbsolute(insideTakes)) {
					yield* fs.makeDirectory(target.takesDir, { recursive: true })
					const stamp = new Date().toISOString().replace(/[:.]/g, "-")
					takePath = path.join(target.takesDir, `${stamp}${path.extname(input) || ".webm"}`)
					yield* fs.copyFile(input, takePath)
				}

				const work = yield* fs.makeTempDirectoryScoped({ prefix: "narrate-record-" })
				const processed = path.join(work, `${section}.webm`)
				yield* Effect.logInfo(`Processing ${relative(takePath)}`)
				const { durationSeconds } = yield* audio.process(takePath, processed, { voice: true })

				const aligned = yield* alignFile(processed, text, words).pipe(Effect.result)
				let timings: TimingsFileContent
				let extra: Partial<NarrationResult>
				if (aligned._tag === "Success") {
					timings = makeTimingsFile(words, aligned.success.spans, "aligned")
					extra = { coverage: aligned.success.coverage, ...coverageNotice(aligned.success.coverage) }
				} else {
					const reason =
						aligned.failure._tag === "MissingSettingError"
							? "No ELEVENLABS_API_KEY is set"
							: `Alignment failed (${aligned.failure.message})`
					timings = makeTimingsFile(words, estimateTimings(words, durationSeconds), "estimated")
					extra = {
						notice: `${reason}, so word timings were estimated from the take's length. Set the key and run: bun narrate align -c ${chapter} ${section}`,
					}
				}

				yield* publish(chapter, section, timings, processed)
				return {
					chapter,
					section,
					audioPath: relative(target.audio),
					timingsPath: relative(target.timings),
					timingsSource: timings.source,
					wordCount: words.length,
					durationSeconds,
					takePath: relative(takePath),
					...extra,
				} satisfies NarrationResult
			}, Effect.scoped)

			const align = Effect.fn("Narration.align")(function* (chapter: string, section: string) {
				const { text, words } = yield* transcriptOf(chapter, section)
				const target = paths(chapter, section)
				if (!(yield* fs.exists(target.audio))) {
					return yield* fail(
						`No audio at ${relative(target.audio)}. Record it (bun dev), generate it (bun narrate generate), or put your own .webm there first.`,
					)
				}
				const { spans, coverage: matched } = yield* alignFile(target.audio, text, words)
				const timings = makeTimingsFile(words, spans, "aligned")
				yield* publish(chapter, section, timings)
				return {
					chapter,
					section,
					audioPath: relative(target.audio),
					timingsPath: relative(target.timings),
					timingsSource: timings.source,
					wordCount: words.length,
					durationSeconds: yield* audio.duration(target.audio),
					coverage: matched,
					...coverageNotice(matched),
				} satisfies NarrationResult
			})

			const generate = Effect.fn("Narration.generate")(function* (
				chapter: string,
				section: string,
				options?: SpeechOptions,
			) {
				const { text, words } = yield* transcriptOf(chapter, section)
				const target = paths(chapter, section)
				yield* Effect.logInfo(`Generating speech for ${chapter}/${section} (${words.length} words)`)
				const speech = yield* elevenLabs.textToSpeech(text, options)
				const mapped = mapAlignedToSource(speech.words, words)
				if (mapped.length === 0) return yield* fail("Generated speech returned no timings that match the transcript")
				const matched = coverage(mapped, words.length)

				const work = yield* fs.makeTempDirectoryScoped({ prefix: "narrate-generate-" })
				const mp3 = path.join(work, "speech.mp3")
				const processed = path.join(work, `${section}.webm`)
				yield* fs.writeFile(mp3, speech.audio)
				const { durationSeconds } = yield* audio.process(mp3, processed, { voice: false })

				const timings = makeTimingsFile(words, interpolateTimings(mapped, words.length), "generated")
				yield* publish(chapter, section, timings, processed)
				return {
					chapter,
					section,
					audioPath: relative(target.audio),
					timingsPath: relative(target.timings),
					timingsSource: timings.source,
					wordCount: words.length,
					durationSeconds,
					coverage: matched,
					...coverageNotice(matched),
				} satisfies NarrationResult
			}, Effect.scoped)

			const status = Effect.gen(function* () {
				const isSet = (name: string) => Env.setting(name).pipe(Effect.map(Option.isSome))
				return {
					ffmpeg: yield* audio.ffmpegVersion,
					dotEnv: yield* fs.exists(path.join(config.projectRoot, ".env")).pipe(Effect.orElseSucceed(() => false)),
					elevenLabsKey: yield* isSet("ELEVENLABS_API_KEY"),
					voiceId: yield* isSet("ELEVENLABS_VOICE_ID"),
					modelId: Option.getOrElse(yield* Env.setting("ELEVENLABS_MODEL_ID"), () => DEFAULT_TTS_MODEL),
					audioChain: yield* isSet("AUTHORING_AUDIO_CHAIN_CMD"),
				}
			}).pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider))

			const toNarrationError = <A, E extends { readonly message: string }, R>(effect: Effect.Effect<A, E, R>) =>
				Effect.mapError(effect, (e) => (e instanceof NarrationError ? e : new NarrationError({ message: e.message })))

			return Narration.of({
				paths,
				status,
				record: (chapter, section, file) => toNarrationError(record(chapter, section, file)),
				align: (chapter, section) => toNarrationError(align(chapter, section)),
				generate: (chapter, section, options) => toNarrationError(generate(chapter, section, options)),
			})
		}),
	)

	/** Everything the CLI needs, settings read from the environment and <project>/.env. */
	static readonly defaultLayer = Layer.unwrap(
		Effect.gen(function* () {
			const config = yield* AppConfig
			const path = yield* Path.Path
			return Narration.layer.pipe(
				Layer.provide([ElevenLabs.defaultLayer, Audio.layer]),
				// Also reaches Narration itself, which reads settings for status.
				Layer.provide(Env.layer(path.join(config.projectRoot, ".env"))),
				Layer.provide(CourseService.defaultLayer),
				Layer.provide(AppConfig.defaultLayer),
				Layer.provide(NodeServices.layer),
			)
		}),
	).pipe(Layer.provide(AppConfig.defaultLayer), Layer.provide(NodeServices.layer))
}
