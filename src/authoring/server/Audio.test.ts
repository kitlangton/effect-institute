import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { ConfigProvider, Effect, Layer } from "effect"
import { afterAll } from "vitest"
import { Audio, parseLoudnorm, TARGET_LUFS } from "./Audio"

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0
const dir = mkdtempSync(path.join(tmpdir(), "audio-test-"))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const layerWith = (env: Record<string, string>) =>
	Audio.layer.pipe(
		Layer.provide(NodeServices.layer),
		Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
	)

/** 1 s silence, 3 s tone with a little noise, 1 s silence: stands in for a take with dead air at both ends. */
const synthesizeTake = (file: string) =>
	execFileSync("ffmpeg", [
		"-hide_banner",
		"-loglevel",
		"error",
		"-y",
		"-f",
		"lavfi",
		"-i",
		"sine=frequency=220:sample_rate=44100:duration=3,volume=0.3",
		"-f",
		"lavfi",
		"-i",
		"anoisesrc=r=44100:a=0.02:d=3",
		"-filter_complex",
		"[0][1]amix=inputs=2:normalize=0,adelay=1000:all=1,apad=pad_dur=1",
		"-c:a",
		"libopus",
		file,
	])

const probe = (file: string) =>
	JSON.parse(
		execFileSync("ffprobe", [
			"-v",
			"error",
			"-show_entries",
			"stream=codec_name,sample_rate,channels:format=format_name,duration",
			"-of",
			"json",
			file,
		]).toString(),
	) as {
		streams: Array<{ codec_name: string; sample_rate: string; channels: number }>
		format: { format_name: string; duration: string }
	}

const integratedLoudness = (file: string) => {
	const result = spawnSync("ffmpeg", [
		"-hide_banner",
		"-nostats",
		"-i",
		file,
		"-af",
		"loudnorm=print_format=json",
		"-f",
		"null",
		"-",
	])
	return Number(parseLoudnorm(result.stderr.toString())?.input_i)
}

describe("parseLoudnorm", () => {
	it("reads the measurement block from ffmpeg output", () => {
		const stderr =
			'noise\n[Parsed_loudnorm_0 @ 0x1]\n{\n\t"input_i" : "-23.1",\n\t"input_tp" : "-4.0",\n\t"input_lra" : "3.2",\n\t"input_thresh" : "-33.5",\n\t"target_offset" : "0.2"\n}\n'
		expect(parseLoudnorm(stderr)?.input_i).toBe("-23.1")
		expect(parseLoudnorm("no json here")).toBeNull()
	})
})

describe.skipIf(!hasFfmpeg)("Audio.process (ffmpeg)", () => {
	it.effect(
		"encodes a voice take to mono Opus WebM at the target loudness with edge silence trimmed",
		() =>
			Effect.gen(function* () {
				const input = path.join(dir, "take.webm")
				const output = path.join(dir, "out", "section.webm")
				synthesizeTake(input)
				const audio = yield* Audio
				const result = yield* audio.process(input, output, { voice: true })

				const info = probe(output)
				expect(info.format.format_name).toContain("webm")
				expect(info.streams[0]).toMatchObject({ codec_name: "opus", sample_rate: "48000", channels: 1 })
				expect(result.durationSeconds).toBeGreaterThan(2.8)
				expect(result.durationSeconds).toBeLessThan(4)
				expect(result.customChain).toBe(false)
				expect(Math.abs(integratedLoudness(output) - TARGET_LUFS)).toBeLessThan(1.5)
			}).pipe(Effect.provide(layerWith({}))),
		30_000,
	)

	it.effect(
		"runs AUTHORING_AUDIO_CHAIN_CMD on the intermediate WAV",
		() =>
			Effect.gen(function* () {
				const input = path.join(dir, "take2.webm")
				const output = path.join(dir, "out", "chained.webm")
				const marker = path.join(dir, "chain-ran")
				synthesizeTake(input)
				const audio = yield* Audio.pipe(
					Effect.provide(
						layerWith({
							AUTHORING_AUDIO_CHAIN_CMD: `cp "$AUTHORING_AUDIO_IN" "$AUTHORING_AUDIO_OUT" && touch "${marker}"`,
						}),
					),
				)
				const result = yield* audio.process(input, output, { voice: true })
				expect(result.customChain).toBe(true)
				expect(existsSync(marker)).toBe(true)
				expect(probe(output).streams[0].codec_name).toBe("opus")
			}),
		30_000,
	)

	it.effect(
		"normalizes generated speech without trimming it",
		() =>
			Effect.gen(function* () {
				const input = path.join(dir, "take3.webm")
				const output = path.join(dir, "out", "generated.webm")
				synthesizeTake(input)
				const audio = yield* Audio
				const result = yield* audio.process(input, output, { voice: false })
				expect(result.durationSeconds).toBeGreaterThan(4.8)
			}).pipe(Effect.provide(layerWith({}))),
		30_000,
	)

	it.effect("reports a clear error for unreadable input", () =>
		Effect.gen(function* () {
			const audio = yield* Audio
			const error = yield* Effect.flip(
				audio.process(path.join(dir, "missing.webm"), path.join(dir, "x.webm"), { voice: true }),
			)
			expect(error._tag).toBe("AudioError")
			expect(error.message).toContain("ffmpeg exited")
		}).pipe(Effect.provide(layerWith({}))),
	)
})
