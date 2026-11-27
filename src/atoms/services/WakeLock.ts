/**
 * Wake Lock service to prevent screen dimming during audio playback.
 *
 * Uses the Screen Wake Lock API to keep the screen active while content is playing.
 * Automatically acquires/releases based on AudioPlayer state.
 */
import { Context, Effect, Layer, Stream } from "effect"
import { AudioPlayer } from "./AudioPlayer"

const isSupported = () => typeof navigator !== "undefined" && "wakeLock" in navigator

export declare namespace WakeLockService {
	export interface Service {
		readonly acquire: Effect.Effect<void>
		readonly release: Effect.Effect<void>
		readonly isActive: Effect.Effect<boolean>
	}
}

export class WakeLockService extends Context.Service<WakeLockService, WakeLockService.Service>()("WakeLockService") {
	static readonly layer = Layer.effect(
		WakeLockService,
		Effect.gen(function* () {
			const audioPlayer = yield* AudioPlayer
			const context = yield* Effect.context<never>()
			const runFork = Effect.runForkWith(context)
			let wakeLock: WakeLockSentinel | null = null

			const acquire = Effect.gen(function* () {
				if (!isSupported()) return
				if (wakeLock !== null) return

				const sentinel = yield* Effect.tryPromise(() => navigator.wakeLock.request("screen")).pipe(
					Effect.catch(() => Effect.succeed(null)),
				)

				if (sentinel) {
					wakeLock = sentinel
					sentinel.addEventListener("release", () => {
						wakeLock = null
					})
				}
			})

			const release = Effect.sync(() => {
				if (wakeLock) {
					void wakeLock.release()
					wakeLock = null
				}
			})

			yield* Effect.addFinalizer(() => release)

			// Watch playback state and acquire/release accordingly within the layer scope
			yield* audioPlayer.changes.pipe(
				Stream.runForEach((state) => (state.playbackState === "playing" ? acquire : release)),
				Effect.forkScoped,
			)

			// Re-acquire when document becomes visible (wake lock releases on tab switch)
			if (typeof document !== "undefined") {
				const onVisibilityChange = () => {
					if (document.visibilityState === "visible") {
						runFork(
							audioPlayer.get.pipe(
								Effect.flatMap((state) => (state.playbackState === "playing" ? acquire : Effect.void)),
							),
						)
					}
				}
				document.addEventListener("visibilitychange", onVisibilityChange)
				yield* Effect.addFinalizer(() =>
					Effect.sync(() => document.removeEventListener("visibilitychange", onVisibilityChange)),
				)
			}

			return WakeLockService.of({
				acquire,
				release,
				isActive: Effect.sync(() => wakeLock !== null),
			})
		}),
	)
}
