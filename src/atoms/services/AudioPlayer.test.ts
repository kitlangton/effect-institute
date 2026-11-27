import { describe, expect, it, vi } from "@effect/vitest"
import { Effect, Exit, Layer, Scope } from "effect"
import { AudioPlayer } from "./AudioPlayer"
import { WebAudioFader } from "./audio-player/fader"
import { AudioPreloader, buildAudioUrl } from "./audio-player/preloader"

describe("AudioPlayer (SSR)", () => {
	it.effect("returns a safe no-op service when window is undefined", () =>
		Effect.gen(function* () {
			const player = yield* AudioPlayer
			const initial = yield* player.get
			expect(initial).toEqual({
				playbackState: "idle",
				duration: 0,
				currentTime: 0,
				loadedSectionId: null,
			})

			yield* player.loadSection("s1", "intro", "s1.webm")
			yield* player.preload("intro", "s1.webm")
			yield* player.play()
			yield* player.pause()
			yield* player.toggle()
			yield* player.restart()
			yield* player.seekTo(5)
			yield* player.seekBy(2)
			yield* player.setPlaybackRate(1.5)
			yield* player.setVolume(0.5)

			expect(yield* player.get).toEqual(initial)
		}).pipe(Effect.provide(AudioPlayer.layer)),
	)
})

describe("AudioPreloader", () => {
	it("builds audio URLs from chapter and hashed filename", () => {
		expect(buildAudioUrl("intro", "clip.a1b2c3d4.webm")).toBe("/content/intro/clip.a1b2c3d4.webm")
	})

	it.effect("deduplicates cached URLs, enforces LRU bound, and handles fetch failures cleanly", () => {
		const originalFetch = globalThis.fetch
		const fetched: string[] = []
		globalThis.fetch = vi.fn(async (input) => {
			const url = String(input)
			fetched.push(url)
			if (url.includes("missing")) {
				return new Response(null, { status: 404, statusText: "Not Found" })
			}
			if (url.includes("throws")) {
				throw new Error("network down")
			}
			return new Response(new Uint8Array([1, 2, 3]), { status: 200 })
		}) as typeof fetch

		return Effect.gen(function* () {
			const preloader = new AudioPreloader(2)

			yield* preloader.preload("/a.webm")
			yield* preloader.preload("/a.webm") // cached hit
			yield* preloader.preload("/b.webm")
			yield* preloader.preload("/c.webm") // evicts /a.webm
			yield* preloader.preload("/a.webm") // fetched again after eviction

			yield* preloader.preload("/missing.webm")
			yield* preloader.preload("/throws.webm")

			expect(fetched).toEqual(["/a.webm", "/b.webm", "/c.webm", "/a.webm", "/missing.webm", "/throws.webm"])
		}).pipe(Effect.ensuring(Effect.sync(() => (globalThis.fetch = originalFetch))))
	})
})

describe("WebAudioFader", () => {
	it("clamps volume to [0, 1] and updates element volume without AudioContext", () => {
		const fader = new WebAudioFader()
		const fakeEl = { volume: 1, paused: true, currentTime: 0, pause: vi.fn() } as unknown as HTMLAudioElement

		fader.setVolume(1.8, fakeEl)
		expect(fakeEl.volume).toBe(1)

		fader.setVolume(-0.5, fakeEl)
		expect(fakeEl.volume).toBe(0)

		fader.setVolume(0.4, fakeEl)
		expect(fakeEl.volume).toBe(0.4)

		fader.fadePause(fakeEl)
		expect(fakeEl.pause).toHaveBeenCalledTimes(1)

		fader.dispose()
	})
})

describe("AudioPlayer (browser lifecycle)", () => {
	it.effect("removes all DOM listeners and cancels RAF when its layer scope closes", () =>
		Effect.gen(function* () {
			const added = new Map<string, Set<EventListener>>()
			const removed: Array<[string, EventListener]> = []
			const pause = vi.fn()
			const removeAttribute = vi.fn()
			const load = vi.fn()
			const setAttribute = vi.fn()

			class FakeAudio {
				preload = ""
				crossOrigin = ""
				src = ""
				currentTime = 0
				duration = 12
				playbackRate = 1
				volume = 1
				paused = true
				ended = false
				readyState = 4
				pause = pause
				play = vi.fn(async () => {})
				load = load
				setAttribute = setAttribute
				removeAttribute = removeAttribute
				addEventListener(event: string, fn: EventListener) {
					if (!added.has(event)) added.set(event, new Set())
					added.get(event)!.add(fn)
				}
				removeEventListener(event: string, fn: EventListener) {
					removed.push([event, fn])
					added.get(event)?.delete(fn)
				}
			}

			const rafCancel = vi.fn()
			const rafRequest = vi.fn(() => 42)

			const originalWindow = globalThis.window
			const originalAudio = globalThis.Audio
			const originalRaf = globalThis.requestAnimationFrame
			const originalCancelRaf = globalThis.cancelAnimationFrame
			const originalAudioCtx = globalThis.AudioContext

			Object.defineProperty(globalThis, "window", { value: {}, configurable: true })
			Object.defineProperty(globalThis, "Audio", { value: FakeAudio, configurable: true })
			Object.defineProperty(globalThis, "requestAnimationFrame", { value: rafRequest, configurable: true })
			Object.defineProperty(globalThis, "cancelAnimationFrame", { value: rafCancel, configurable: true })
			Object.defineProperty(globalThis, "AudioContext", { value: undefined, configurable: true })

			const scope = yield* Scope.make()
			yield* Effect.gen(function* () {
				yield* Layer.buildWithScope(AudioPlayer.layer, scope)

				// Trigger "playing" event to start RAF
				for (const fn of added.get("playing") ?? []) {
					fn(new Event("playing"))
				}
				expect(rafRequest).toHaveBeenCalled()

				const totalAdded = Array.from(added.values()).reduce((sum, set) => sum + set.size, 0)
				expect(totalAdded).toBe(8)

				yield* Scope.close(scope, Exit.void)

				expect(rafCancel).toHaveBeenCalledWith(42)
				expect(removed.length).toBe(totalAdded)
				for (const remaining of added.values()) {
					expect(remaining.size).toBe(0)
				}
				expect(pause).toHaveBeenCalled()
				expect(removeAttribute).toHaveBeenCalledWith("src")
			}).pipe(
				Effect.ensuring(
					Effect.sync(() => {
						Object.defineProperty(globalThis, "window", { value: originalWindow, configurable: true })
						Object.defineProperty(globalThis, "Audio", { value: originalAudio, configurable: true })
						Object.defineProperty(globalThis, "requestAnimationFrame", { value: originalRaf, configurable: true })
						Object.defineProperty(globalThis, "cancelAnimationFrame", { value: originalCancelRaf, configurable: true })
						Object.defineProperty(globalThis, "AudioContext", { value: originalAudioCtx, configurable: true })
					}),
				),
			)
		}),
	)
})
