import { describe, expect, it } from "@effect/vitest"
import { ConfigProvider, Effect, Layer } from "effect"
import { HttpClient, type HttpClientRequest, HttpClientResponse } from "effect/http"
import { DEFAULT_TTS_MODEL, ElevenLabs } from "./ElevenLabs"

interface Captured {
	url: string
	headers: Record<string, string>
	request: HttpClientRequest.HttpClientRequest
}

/** An ElevenLabs layer whose HTTP client returns canned responses and records each request. */
const mocked = (env: Record<string, string>, respond: (url: string) => { status: number; body: unknown }) => {
	const captured: Captured[] = []
	const client = HttpClient.make((request, url) => {
		captured.push({ url: url.toString(), headers: { ...request.headers }, request })
		const { status, body } = respond(url.toString())
		return Effect.succeed(
			HttpClientResponse.fromWeb(
				request,
				new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
			),
		)
	})
	const layer = ElevenLabs.layer.pipe(
		Layer.provide(Layer.succeed(HttpClient.HttpClient, client)),
		Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
	)
	return { layer, captured }
}

// Shapes from https://elevenlabs.io/docs/api-reference/forced-alignment/create
const alignmentResponse = {
	characters: [
		{ text: "H", start: 0.1, end: 0.15 },
		{ text: "i", start: 0.15, end: 0.2 },
	],
	words: [
		{ text: "Hi", start: 0.1, end: 0.2, loss: 0.3 },
		{ text: " ", start: 0.2, end: 0.25, loss: 0 },
		{ text: "there.", start: 0.25, end: 0.6, loss: 0.2 },
	],
	loss: 0.25,
}

// Shape from https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps
const chars = [..."Hi there"]
const speechResponse = {
	audio_base64: Buffer.from("fake-mp3").toString("base64"),
	alignment: {
		characters: chars,
		character_start_times_seconds: chars.map((_, i) => i * 0.1),
		character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.1),
	},
	normalized_alignment: null,
}

describe("ElevenLabs", () => {
	it.effect("sends audio and transcript to forced alignment and drops whitespace entries", () => {
		const { layer, captured } = mocked({ ELEVENLABS_API_KEY: "test-key" }, () => ({
			status: 200,
			body: alignmentResponse,
		}))
		return Effect.gen(function* () {
			const elevenLabs = yield* ElevenLabs
			const result = yield* elevenLabs.forcedAlignment(new Uint8Array([1, 2, 3]), "take.webm", "Hi (there).")
			expect(result.words.map((w) => w.word)).toEqual(["Hi", "there."])
			expect(result.loss).toBe(0.25)

			const [call] = captured
			expect(call.url).toBe("https://api.elevenlabs.io/v1/forced-alignment")
			expect(call.headers["xi-api-key"]).toBe("test-key")
			const body = call.request.body
			expect(body._tag).toBe("FormData")
			if (body._tag === "FormData") {
				expect(body.formData.get("text")).toBe("Hi there.")
				expect(body.formData.get("file")).toBeInstanceOf(Blob)
			}
		}).pipe(Effect.provide(layer))
	})

	it.effect("generates speech with the configured voice and default model", () => {
		const { layer, captured } = mocked({ ELEVENLABS_API_KEY: "k", ELEVENLABS_VOICE_ID: "voice123" }, () => ({
			status: 200,
			body: speechResponse,
		}))
		return Effect.gen(function* () {
			const elevenLabs = yield* ElevenLabs
			const speech = yield* elevenLabs.textToSpeech("Hi there")
			expect(new TextDecoder().decode(speech.audio)).toBe("fake-mp3")
			expect(speech.words.map((w) => w.word)).toEqual(["Hi", "there"])
			expect(captured[0].url).toBe("https://api.elevenlabs.io/v1/text-to-speech/voice123/with-timestamps")
			const body = captured[0].request.body
			if (body._tag !== "Uint8Array") throw new Error(`unexpected body ${body._tag}`)
			expect(JSON.parse(new TextDecoder().decode(body.body))).toEqual({ text: "Hi there", model_id: DEFAULT_TTS_MODEL })
		}).pipe(Effect.provide(layer))
	})

	it.effect("prefers explicit voice and model over settings", () => {
		const { layer, captured } = mocked({ ELEVENLABS_API_KEY: "k", ELEVENLABS_MODEL_ID: "from-env" }, () => ({
			status: 200,
			body: speechResponse,
		}))
		return Effect.gen(function* () {
			const elevenLabs = yield* ElevenLabs
			yield* elevenLabs.textToSpeech("Hi there", { voiceId: "cli-voice", modelId: "cli-model" })
			expect(captured[0].url).toContain("/text-to-speech/cli-voice/")
			const body = captured[0].request.body
			if (body._tag !== "Uint8Array") throw new Error("unexpected body")
			expect(JSON.parse(new TextDecoder().decode(body.body)).model_id).toBe("cli-model")
		}).pipe(Effect.provide(layer))
	})

	it.effect("fails with a setup hint when the API key is missing, without calling the API", () => {
		const { layer, captured } = mocked({}, () => ({ status: 200, body: alignmentResponse }))
		return Effect.gen(function* () {
			const elevenLabs = yield* ElevenLabs
			const error = yield* Effect.flip(elevenLabs.forcedAlignment(new Uint8Array(), "a.webm", "x"))
			expect(error._tag).toBe("MissingSettingError")
			expect(error.message).toContain("ELEVENLABS_API_KEY")
			expect(error.message).toContain(".env.example")
			expect(captured).toHaveLength(0)
		}).pipe(Effect.provide(layer))
	})

	it.effect("fails generation with a hint when no voice is configured", () => {
		const { layer } = mocked({ ELEVENLABS_API_KEY: "k" }, () => ({ status: 200, body: speechResponse }))
		return Effect.gen(function* () {
			const elevenLabs = yield* ElevenLabs
			const error = yield* Effect.flip(elevenLabs.textToSpeech("x"))
			expect(error.message).toContain("ELEVENLABS_VOICE_ID")
		}).pipe(Effect.provide(layer))
	})

	it.effect("reports API errors with status and body", () => {
		const { layer } = mocked({ ELEVENLABS_API_KEY: "bad" }, () => ({
			status: 401,
			body: { detail: { status: "invalid_api_key", message: "Invalid API key" } },
		}))
		return Effect.gen(function* () {
			const elevenLabs = yield* ElevenLabs
			const error = yield* Effect.flip(elevenLabs.forcedAlignment(new Uint8Array(), "a.webm", "x"))
			expect(error._tag).toBe("ElevenLabsError")
			if (error._tag === "ElevenLabsError") {
				expect(error.status).toBe(401)
				expect(error.message).toContain("invalid_api_key")
			}
		}).pipe(Effect.provide(layer))
	})
})
