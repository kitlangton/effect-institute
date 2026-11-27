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
import { FetchHttpClient, HttpClient, HttpClientRequest, type HttpClientResponse } from "effect/http"
import { charactersToWords, type TimedWord } from "../core/timings"
import { type MissingSettingError, requireSetting, setting } from "./env"

const API_BASE = "https://api.elevenlabs.io/v1"

/** Current flagship text-to-speech model (https://elevenlabs.io/docs/overview/models). Override with ELEVENLABS_MODEL_ID. */
export const DEFAULT_TTS_MODEL = "eleven_v4"

export class ElevenLabsError extends Schema.TaggedError<ElevenLabsError>()("ElevenLabsError", {
	message: Schema.String,
	status: Schema.optional(Schema.Number),
}) {}

const AlignedWordSchema = Schema.Struct({
	text: Schema.String,
	start: Schema.Number,
	end: Schema.Number,
	loss: Schema.optional(Schema.Number),
})

const ForcedAlignmentResponse = Schema.Struct({
	words: Schema.Array(AlignedWordSchema),
	loss: Schema.Number,
})

const CharacterAlignment = Schema.Struct({
	characters: Schema.Array(Schema.String),
	character_start_times_seconds: Schema.Array(Schema.Number),
	character_end_times_seconds: Schema.Array(Schema.Number),
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
			const http = yield* HttpClient.HttpClient
			// Capture where settings come from now; the values themselves are only read when a call runs.
			const provider = yield* ConfigProvider.ConfigProvider
			const withSettings = <A, E>(effect: Effect.Effect<A, E>) =>
				Effect.provideService(effect, ConfigProvider.ConfigProvider, provider)
			const apiKey = withSettings(requireSetting("ELEVENLABS_API_KEY", "ElevenLabs alignment and generation"))

			const execute = <S extends Schema.Codec<unknown, unknown>>(
				request: HttpClientRequest.HttpClientRequest,
				schema: S,
				operation: string,
			) =>
				Effect.gen(function* () {
					const response: HttpClientResponse.HttpClientResponse = yield* http.execute(request)
					if (response.status < 200 || response.status >= 300) {
						const body = yield* response.text.pipe(Effect.orElseSucceed(() => ""))
						return yield* new ElevenLabsError({
							message: `${operation} failed (${response.status}): ${body.slice(0, 500)}`,
							status: response.status,
						})
					}
					const json = yield* response.json
					return yield* Schema.decodeUnknownEffect(schema)(json)
				}).pipe(
					Effect.catchTag("SchemaError", (e) =>
						Effect.fail(new ElevenLabsError({ message: `${operation} returned an unexpected response: ${e.message}` })),
					),
					Effect.catchTag("HttpClientError", (e) =>
						Effect.fail(new ElevenLabsError({ message: `${operation} request failed: ${e.message}` })),
					),
				)

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
				const request = HttpClientRequest.post(`${API_BASE}/forced-alignment`).pipe(
					HttpClientRequest.setHeader("xi-api-key", key),
					HttpClientRequest.bodyFormData(form),
				)
				const response = yield* execute(request, ForcedAlignmentResponse, "Forced alignment")
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
				const request = HttpClientRequest.post(
					`${API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`,
				).pipe(
					HttpClientRequest.setHeader("xi-api-key", key),
					HttpClientRequest.bodyJsonUnsafe({ text, model_id: modelId }),
				)
				const response = yield* execute(request, SpeechWithTimestampsResponse, "Text to speech")
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

	static readonly defaultLayer = ElevenLabs.layer.pipe(Layer.provide(FetchHttpClient.layer))
}
