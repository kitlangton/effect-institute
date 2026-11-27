/**
 * Portable narration audio processing with plain ffmpeg.
 *
 * Voice takes: mono 48 kHz, 80 Hz high-pass, leading/trailing silence trimmed, optional custom chain
 * (AUTHORING_AUDIO_CHAIN_CMD), gentle compression, two-pass EBU R128 loudness to -16 LUFS / -1 dBTP,
 * light de-essing, then Opus 64 kbps in WebM with cues at the front so byte-range seeking works.
 * Generated speech skips the clean-up stages and only gets loudness normalization and encoding.
 *
 * @module
 */
import { ConfigProvider, Context, Effect, FileSystem, Layer, Option, Path, Schema, Stream } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import { setting } from "./env"

export class AudioError extends Schema.TaggedError<AudioError>()("AudioError", {
	message: Schema.String,
}) {}

export interface ProcessOptions {
	/** Apply the voice clean-up stages (recorded takes). Generated speech passes false. */
	readonly voice: boolean
}

export interface ProcessResult {
	readonly durationSeconds: number
	/** Whether AUTHORING_AUDIO_CHAIN_CMD ran */
	readonly customChain: boolean
}

export const TARGET_LUFS = -16
const TRUE_PEAK = -1
const LOUDNESS_RANGE = 11
const OPUS_BITRATE = "64k"

/** Leading and trailing silence trim. Only removes silence at the edges, never pauses inside the take. */
const TRIM_SILENCE = [
	"silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15",
	"areverse",
	"silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.3",
	"areverse",
].join(",")

const COMPRESS = "acompressor=threshold=-21dB:ratio=2.5:attack=8:release=180:makeup=1.5"
const DEESS = "deesser=i=0.16:m=0.45:f=0.6"

const loudnormBase = `loudnorm=I=${TARGET_LUFS}:TP=${TRUE_PEAK}:LRA=${LOUDNESS_RANGE}`

interface LoudnessMeasurement {
	readonly input_i: string
	readonly input_tp: string
	readonly input_lra: string
	readonly input_thresh: string
	readonly target_offset: string
}

/** Pull the JSON block ffmpeg's loudnorm filter prints to stderr. */
export const parseLoudnorm = (stderr: string): LoudnessMeasurement | null => {
	const start = stderr.lastIndexOf("{")
	const end = stderr.lastIndexOf("}")
	if (start === -1 || end < start) return null
	try {
		const parsed = JSON.parse(stderr.slice(start, end + 1)) as Partial<LoudnessMeasurement>
		return parsed.input_i !== undefined && parsed.target_offset !== undefined ? (parsed as LoudnessMeasurement) : null
	} catch {
		return null
	}
}

export class Audio extends Context.Service<
	Audio,
	{
		/** Process any audio file ffmpeg can read into the course's WebM/Opus format. */
		readonly process: (
			input: string,
			output: string,
			options: ProcessOptions,
		) => Effect.Effect<ProcessResult, AudioError>
		/** Duration of an audio file in seconds. */
		readonly duration: (file: string) => Effect.Effect<number, AudioError>
		/** The installed ffmpeg version line, or None when ffmpeg is not on PATH. */
		readonly ffmpegVersion: () => Effect.Effect<Option.Option<string>>
	}
>()("@effect-institute/authoring/Audio") {
	static readonly layer = Layer.effect(
		Audio,
		Effect.gen(function* () {
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
			const fs = yield* FileSystem.FileSystem
			const path = yield* Path.Path
			const provider = yield* ConfigProvider.ConfigProvider

			const collect = <E>(stream: Stream.Stream<Uint8Array, E>) => Stream.mkString(Stream.decodeText(stream))

			const run = (command: ChildProcess.Command, label: string) =>
				Effect.scoped(
					Effect.gen(function* () {
						const handle = yield* spawner.spawn(command)
						const [stdout, stderr, exitCode] = yield* Effect.all(
							[collect(handle.stdout), collect(handle.stderr), handle.exitCode],
							{ concurrency: "unbounded" },
						)
						if (exitCode !== 0) {
							return yield* new AudioError({ message: `${label} exited with ${exitCode}:\n${stderr.slice(-1500)}` })
						}
						return { stdout, stderr }
					}),
				).pipe(
					Effect.catchTag("PlatformError", (e) =>
						Effect.fail(
							new AudioError({
								message: e.message.includes("ENOENT")
									? `${label} not found. Install ffmpeg (macOS: brew install ffmpeg, Debian/Ubuntu: apt install ffmpeg).`
									: `${label} failed: ${e.message}`,
							}),
						),
					),
				)

			const ffmpeg = (args: ReadonlyArray<string>) =>
				run(ChildProcess.make("ffmpeg", ["-hide_banner", "-nostdin", "-y", ...args]), "ffmpeg")

			const duration = Effect.fn("Audio.duration")(function* (file: string) {
				const { stdout } = yield* run(
					ChildProcess.make("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]),
					"ffprobe",
				)
				const seconds = Number.parseFloat(stdout.trim())
				if (!Number.isFinite(seconds)) return yield* new AudioError({ message: `Could not read duration of ${file}` })
				return seconds
			})

			const process = Effect.fn("Audio.process")(
				function* (input: string, output: string, options: ProcessOptions) {
					const dir = yield* fs.makeTempDirectoryScoped({ prefix: "narrate-audio-" })
					const decoded = path.join(dir, "decoded.wav")
					const chained = path.join(dir, "chained.wav")
					const shaped = path.join(dir, "shaped.wav")
					const encoded = path.join(dir, "final.webm")

					yield* ffmpeg([
						"-i",
						input,
						"-vn",
						"-ac",
						"1",
						"-ar",
						"48000",
						...(options.voice ? ["-af", `highpass=f=80,${TRIM_SILENCE}`] : []),
						decoded,
					])

					const chainCommand = yield* setting("AUTHORING_AUDIO_CHAIN_CMD").pipe(
						Effect.provideService(ConfigProvider.ConfigProvider, provider),
					)
					let current = decoded
					if (options.voice && Option.isSome(chainCommand)) {
						yield* Effect.logInfo(`Running AUTHORING_AUDIO_CHAIN_CMD on ${decoded}`)
						yield* run(
							ChildProcess.make(chainCommand.value, {
								shell: "/bin/sh",
								extendEnv: true,
								env: { AUTHORING_AUDIO_IN: decoded, AUTHORING_AUDIO_OUT: chained },
							}),
							"AUTHORING_AUDIO_CHAIN_CMD",
						)
						if (!(yield* fs.exists(chained))) {
							return yield* new AudioError({
								message: "AUTHORING_AUDIO_CHAIN_CMD finished without writing $AUTHORING_AUDIO_OUT",
							})
						}
						current = chained
					}

					if (options.voice) {
						yield* ffmpeg(["-i", current, "-af", COMPRESS, shaped])
						current = shaped
					}

					// Two-pass loudnorm: measure, then apply linearly so the gain does not pump.
					const { stderr } = yield* ffmpeg([
						"-nostats",
						"-i",
						current,
						"-af",
						`${loudnormBase}:print_format=json`,
						"-f",
						"null",
						"-",
					])
					const measured = parseLoudnorm(stderr)
					if (!measured) return yield* new AudioError({ message: "Could not parse ffmpeg loudnorm measurement" })
					const loudnorm = [
						loudnormBase,
						`measured_I=${measured.input_i}`,
						`measured_TP=${measured.input_tp}`,
						`measured_LRA=${measured.input_lra}`,
						`measured_thresh=${measured.input_thresh}`,
						`offset=${measured.target_offset}`,
						"linear=true",
					].join(":")

					yield* ffmpeg([
						"-i",
						current,
						"-af",
						options.voice ? `${loudnorm},${DEESS}` : loudnorm,
						"-ar",
						"48000",
						"-c:a",
						"libopus",
						"-b:a",
						OPUS_BITRATE,
						"-cues_to_front",
						"1",
						encoded,
					])

					yield* fs.makeDirectory(path.dirname(output), { recursive: true })
					yield* fs.copyFile(encoded, output)
					return {
						durationSeconds: yield* duration(output),
						customChain: options.voice && Option.isSome(chainCommand),
					}
				},
				(effect) =>
					effect.pipe(
						Effect.scoped,
						Effect.catchTag("PlatformError", (e) => Effect.fail(new AudioError({ message: e.message }))),
					),
			)

			const ffmpegVersion = () =>
				run(ChildProcess.make("ffmpeg", ["-version"]), "ffmpeg").pipe(
					Effect.map(({ stdout }) => Option.some(stdout.split("\n")[0] ?? "ffmpeg")),
					Effect.orElseSucceed(() => Option.none<string>()),
				)

			return Audio.of({ process, duration, ffmpegVersion })
		}),
	)
}
