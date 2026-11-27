/**
 * Minimal ElevenLabs client: forced alignment and text-to-speech with timestamps.
 *
 * The API key is read on each call (never at construction), so constructing this service needs no key.
 * Docs: https://elevenlabs.io/docs/api-reference/forced-alignment/create and
 * https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps
 *
 * @module
 */
import { ConfigProvider, Context, Effect, Layer, Option, Schema } from "effect"
import { charactersToWords, type TimedWord } from "../core/timings"
import { type MissingSettingError, requireSetting, setting } from "./env"

const API_BASE = "https://api.elevenlabs.io/v1"

/** Current flagship text-to-speech model (https://elevenlabs.io/docs/overview/models). Override with ELEVENLABS_MODEL_ID. */
export const DEFAULT_TTS_MODEL = "eleven_v4"

export class ElevenLabsError extends Schema.TaggedError<ElevenLabsError>()("ElevenLabsError", {
	message: Schema.String,
	status: Schema.optional(Schema.Finite),
}) {}

const AlignedWordSchema = Schema.Struct({
	text: Schema.String,
	start: Schema.Finite,
	end: Schema.Finite,
	loss: Schema.optional(Schema.Finite),
})

const ForcedAlignmentResponse = Schema.Struct({
	words: Schema.Array(AlignedWordSchema),
	loss: Schema.Finite,
})

const CharacterAlignment = Schema.Struct({
	characters: Schema.Array(Schema.String),
	character_start_times_seconds: Schema.Array(Schema.Finite),
	character_end_times_seconds: Schema.Array(Schema.Finite),
})

const SpeechWithTimestampsResponse = Schema.Struct({
	audio_base64: Schema.String,
	alignment: Schema.optional(Schema.NullOr(CharacterAlignment)),
	normalized_alignment: Schema.optional(Schema.NullOr(CharacterAlignment)),
})

export interface Alignment {
	readonly words: ReadonlyArray<TimedWord>
	readonly loss: number
}

export interface Speech {
	/** MP3 bytes (the endpoint's default output format) */
	readonly audio: Uint8Array
	readonly words: ReadonlyArray<TimedWord>
}

export interface SpeechOptions {
	readonly voiceId?: string | undefined
	readonly modelId?: string | undefined
}

export type ElevenLabsFailure = ElevenLabsError | MissingSettingError

/** The HTTP function the client calls; tests provide a fake. */
export class Fetch extends Context.Service<Fetch, (url: string, init: RequestInit) => Promise<Response>>()(
	"@effect-institute/authoring/Fetch",
) {
	static readonly layer = Layer.succeed(Fetch, (url: string, init: RequestInit) => globalThis.fetch(url, init))
}

export class ElevenLabs extends Context.Service<
	ElevenLabs,
	{
		/** Word timings for existing audio and its transcript. */
		readonly forcedAlignment: (
			audio: Uint8Array,
			fileName: string,
			transcript: string,
		) => Effect.Effect<Alignment, ElevenLabsFailure>
		/** Synthesized speech plus word timings. */
		readonly textToSpeech: (text: string, options?: SpeechOptions) => Effect.Effect<Speech, ElevenLabsFailure>
	}
>()("@effect-institute/authoring/ElevenLabs") {
	static readonly layer = Layer.effect(
		ElevenLabs,
		Effect.gen(function* () {
			const fetch = yield* Fetch
			// Capture where settings come from now; the values themselves are only read when a call runs.
			const provider = yield* ConfigProvider.ConfigProvider
			const withSettings = <A, E>(effect: Effect.Effect<A, E>) =>
				Effect.provideService(effect, ConfigProvider.ConfigProvider, provider)
			const apiKey = withSettings(requireSetting("ELEVENLABS_API_KEY", "ElevenLabs alignment and generation"))

			const execute = <S extends Schema.Codec<unknown, unknown>>(
				url: string,
				init: RequestInit,
				schema: S,
				operation: string,
			) =>
				Effect.gen(function* () {
					const response = yield* Effect.tryPromise({
						try: (signal) => fetch(url, { ...init, signal }),
						catch: (e) =>
							new ElevenLabsError({
								message: `${operation} request failed: ${e instanceof Error ? e.message : String(e)}`,
							}),
					})
					if (response.status < 200 || response.status >= 300) {
						const body = yield* Effect.promise(() => response.text().catch(() => ""))
						return yield* new ElevenLabsError({
							message: `${operation} failed (${response.status}): ${body.slice(0, 500)}`,
							status: response.status,
						})
					}
					const json = yield* Effect.tryPromise({
						try: () => response.json() as Promise<unknown>,
						catch: () => new ElevenLabsError({ message: `${operation} returned a response that is not JSON` }),
					})
					return yield* Schema.decodeUnknownEffect(schema)(json).pipe(
						Effect.mapError(
							(e) => new ElevenLabsError({ message: `${operation} returned an unexpected response: ${e.message}` }),
						),
					)
				})

			const forcedAlignment = Effect.fn("ElevenLabs.forcedAlignment")(function* (
				audio: Uint8Array,
				fileName: string,
				transcript: string,
			) {
				const key = yield* apiKey
				const form = new FormData()
				form.append("file", new Blob([new Uint8Array(audio)]), fileName)
				// Bracketed phrases otherwise come back as one timing entry.
				form.append("text", transcript.replace(/[()[\]{}]/g, ""))
				const response = yield* execute(
					`${API_BASE}/forced-alignment`,
					{ method: "POST", headers: { "xi-api-key": key }, body: form },
					ForcedAlignmentResponse,
					"Forced alignment",
				)
				return {
					words: response.words
						.map((w) => ({ word: w.text.trim(), start: w.start, end: w.end }))
						.filter((w) => w.word.length > 0),
					loss: response.loss,
				}
			})

			const textToSpeech = Effect.fn("ElevenLabs.textToSpeech")(function* (text: string, options?: SpeechOptions) {
				const key = yield* apiKey
				const voiceId =
					options?.voiceId ??
					(yield* withSettings(requireSetting("ELEVENLABS_VOICE_ID", "generating narration (or pass --voice)")))
				const modelId =
					options?.modelId ??
					Option.getOrElse(yield* withSettings(setting("ELEVENLABS_MODEL_ID")), () => DEFAULT_TTS_MODEL)
				const response = yield* execute(
					`${API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`,
					{
						method: "POST",
						headers: { "xi-api-key": key, "Content-Type": "application/json" },
						body: JSON.stringify({ text, model_id: modelId }),
					},
					SpeechWithTimestampsResponse,
					"Text to speech",
				)
				// "alignment" follows the submitted text; "normalized_alignment" may spell out numbers and break word matching.
				const alignment = response.alignment ?? response.normalized_alignment
				return {
					audio: new Uint8Array(Buffer.from(response.audio_base64, "base64")),
					words: alignment ? charactersToWords(alignment) : [],
				}
			})

			return ElevenLabs.of({ forcedAlignment, textToSpeech })
		}),
	)

	static readonly defaultLayer = ElevenLabs.layer.pipe(Layer.provide(Fetch.layer))
}
