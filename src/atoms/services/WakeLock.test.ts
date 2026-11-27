import { describe, expect, it, vi } from "@effect/vitest"
import { Effect, Exit, Layer, Scope, SubscriptionRef } from "effect"
import { AudioPlayer, type AudioPlayerState } from "./AudioPlayer"
import { WakeLockService } from "./WakeLock"

describe("WakeLockService", () => {
	it.effect("acquires on playing, releases on pause, and cleans up scoped fiber and visibility listener on close", () =>
		Effect.gen(function* () {
			const stateRef = yield* SubscriptionRef.make<AudioPlayerState>({
				playbackState: "idle",
				duration: 10,
				currentTime: 0,
				loadedSectionId: "s1",
			})

			const mockAudioLayer = Layer.succeed(
				AudioPlayer,
				AudioPlayer.of({
					changes: SubscriptionRef.changes(stateRef),
					stateRef,
					get: SubscriptionRef.get(stateRef),
					loadSection: () => Effect.void,
					preload: () => Effect.void,
					play: () => Effect.void,
					pause: () => Effect.void,
					toggle: () => Effect.void,
					restart: () => Effect.void,
					seekTo: () => Effect.void,
					seekBy: () => Effect.void,
					setPlaybackRate: () => Effect.void,
					setVolume: () => Effect.void,
				}),
			)

			const sentinelRelease = vi.fn(async () => {})
			const requestWakeLock = vi.fn(async () => ({
				released: false,
				type: "screen",
				release: sentinelRelease,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
				onrelease: null,
			}))

			const addDocListener = vi.fn()
			const removeDocListener = vi.fn()

			const originalNavigator = globalThis.navigator
			const originalDocument = globalThis.document

			Object.defineProperty(globalThis, "navigator", {
				value: { wakeLock: { request: requestWakeLock } },
				configurable: true,
			})
			Object.defineProperty(globalThis, "document", {
				value: {
					visibilityState: "visible",
					addEventListener: addDocListener,
					removeEventListener: removeDocListener,
				},
				configurable: true,
			})

			const scope = yield* Scope.make()
			yield* Effect.gen(function* () {
				const ctx = yield* Layer.buildWithScope(WakeLockService.layer.pipe(Layer.provide(mockAudioLayer)), scope)
				const wakeLock = ctx.mapUnsafe.get("WakeLockService") as WakeLockService.Service
				expect(wakeLock).toBeDefined()
				expect(addDocListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function))

				yield* wakeLock.acquire
				expect(requestWakeLock).toHaveBeenCalledWith("screen")
				expect(yield* wakeLock.isActive).toBe(true)

				yield* Scope.close(scope, Exit.void)

				expect(sentinelRelease).toHaveBeenCalledTimes(1)
				expect(removeDocListener).toHaveBeenCalledWith("visibilitychange", addDocListener.mock.calls[0][1])
			}).pipe(
				Effect.ensuring(
					Effect.sync(() => {
						Object.defineProperty(globalThis, "navigator", { value: originalNavigator, configurable: true })
						Object.defineProperty(globalThis, "document", { value: originalDocument, configurable: true })
					}),
				),
			)
		}),
	)
})
