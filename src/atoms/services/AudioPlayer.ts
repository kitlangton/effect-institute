/**
 * Audio player service using HTMLAudioElement for streaming.
 *
 * Uses WebAudioFader (MediaElementAudioSourceNode) for click-free fades and
 * AudioPreloader for bounded LRU HTTP cache warming.
 */
import { Context, Effect, Layer, type Stream, SubscriptionRef } from "effect"
import { WebAudioFader } from "./audio-player/fader"
import { AudioPreloader, buildAudioUrl } from "./audio-player/preloader"

// =============================================================================
// Types
// =============================================================================

export type PlaybackState = "idle" | "loading" | "playing" | "paused" | "finished" | "unavailable"
export type PlaybackRate = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2 | 2.5 | 3

export const PLAYBACK_RATES: PlaybackRate[] = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]

export interface AudioPlayerState {
	playbackState: PlaybackState
	duration: number
	currentTime: number
	/** Which section this audio belongs to (for per-section isolation) */
	loadedSectionId: string | null
}

const INITIAL_STATE: AudioPlayerState = {
	playbackState: "idle",
	duration: 0,
	currentTime: 0,
	loadedSectionId: null,
}

const clampTime = (timeSec: number, duration: number | null) => {
	if (!duration || !Number.isFinite(duration) || duration <= 0) return Math.max(0, timeSec)
	return Math.max(0, Math.min(timeSec, duration))
}

// =============================================================================
// Service
// =============================================================================

export declare namespace AudioPlayer {
	export interface Service {
		readonly changes: Stream.Stream<AudioPlayerState>
		readonly stateRef: SubscriptionRef.SubscriptionRef<AudioPlayerState>
		readonly get: Effect.Effect<AudioPlayerState>
		readonly loadSection: (sectionId: string, chapter: string, audioFile: string | undefined) => Effect.Effect<void>
		readonly preload: (chapter: string, audioFile: string) => Effect.Effect<void>
		readonly play: () => Effect.Effect<void>
		readonly pause: () => Effect.Effect<void>
		readonly toggle: () => Effect.Effect<void>
		readonly restart: () => Effect.Effect<void>
		readonly seekTo: (timeSec: number) => Effect.Effect<void>
		readonly seekBy: (deltaSec: number) => Effect.Effect<void>
		readonly setPlaybackRate: (rate: PlaybackRate) => Effect.Effect<void>
		readonly setVolume: (volume: number) => Effect.Effect<void>
	}
}

export class AudioPlayer extends Context.Service<AudioPlayer, AudioPlayer.Service>()("AudioPlayer") {
	static readonly layer = Layer.effect(
		AudioPlayer,
		Effect.gen(function* () {
			const stateRef = yield* SubscriptionRef.make<AudioPlayerState>(INITIAL_STATE)

			if (typeof window === "undefined") {
				return AudioPlayer.of({
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
				})
			}

			const context = yield* Effect.context<never>()
			const runSync = Effect.runSyncWith(context)

			const fader = new WebAudioFader()
			const preloader = new AudioPreloader()

			const element = new Audio()
			element.preload = "auto"
			element.crossOrigin = "anonymous"
			element.setAttribute("playsinline", "true")
			fader.attach(element)

			let currentRate: PlaybackRate = 1
			let loadSequence = 0
			let currentLoadId = 0
			let currentUrl: string | null = null
			let rafId: number | null = null
			let lastPlaybackState: PlaybackState = "idle"
			const pending = {
				loadId: null as number | null,
				play: false,
				seekTime: null as number | null,
			}

			const getCurrentTime = (): number => element.currentTime ?? 0

			const setPending = (next: Partial<typeof pending>) => {
				if (pending.loadId !== currentLoadId) {
					pending.loadId = currentLoadId
				}
				Object.assign(pending, next)
			}

			const clearPendingPlay = () => {
				pending.play = false
			}

			const clearPendingSeek = () => {
				pending.seekTime = null
			}

			const updateState = (f: (s: AudioPlayerState) => AudioPlayerState) =>
				SubscriptionRef.update(stateRef, (s) => {
					const next = f(s)
					lastPlaybackState = next.playbackState
					return next
				})

			const updateCurrentTime = () =>
				runSync(
					updateState((s) => ({
						...s,
						currentTime: getCurrentTime(),
					})),
				)

			const startRaf = () => {
				if (rafId !== null) return
				const loop = () => {
					updateCurrentTime()
					rafId = requestAnimationFrame(loop)
				}
				rafId = requestAnimationFrame(loop)
			}

			const stopRaf = () => {
				if (rafId === null) return
				cancelAnimationFrame(rafId)
				rafId = null
			}

			const markPendingSeek = (timeSec: number) => {
				setPending({ seekTime: timeSec })
			}

			const seekBaseTime = () =>
				pending.seekTime !== null && pending.loadId === currentLoadId ? pending.seekTime : getCurrentTime()

			const tryApplyPendingSeek = () => {
				if (pending.seekTime === null || pending.loadId !== currentLoadId) return
				if (!element.src || element.readyState < HTMLMediaElement.HAVE_METADATA) return

				const duration = Number.isFinite(element.duration) ? element.duration : null
				const target = clampTime(pending.seekTime, duration)

				try {
					element.currentTime = target
					clearPendingSeek()
				} catch {
					// Keep pending until media is ready to accept seeks.
				}
			}

			// -----------------------------------------------------------------------
			// DOM Event Listeners (cleaned up via Effect.addFinalizer)
			// -----------------------------------------------------------------------

			const listeners: Array<readonly [string, EventListener]> = []
			const on = (event: string, listener: EventListener) => {
				element.addEventListener(event, listener)
				listeners.push([event, listener])
			}

			on("loadedmetadata", () => {
				const duration = Number.isFinite(element.duration) ? element.duration : 0
				tryApplyPendingSeek()
				runSync(
					updateState((s) => ({
						...s,
						duration,
						currentTime: getCurrentTime(),
						playbackState: s.playbackState === "loading" ? "idle" : s.playbackState,
					})),
				)
			})

			on("playing", () => {
				runSync(
					updateState((s) => ({
						...s,
						playbackState: "playing",
						currentTime: getCurrentTime(),
					})),
				)
				startRaf()
			})

			on("pause", () => {
				if (element.ended) return
				if (lastPlaybackState === "loading") return
				runSync(
					updateState((s) => ({
						...s,
						playbackState: "paused",
						currentTime: getCurrentTime(),
					})),
				)
				stopRaf()
			})

			on("loadeddata", tryApplyPendingSeek)
			on("canplay", tryApplyPendingSeek)
			on("progress", tryApplyPendingSeek)

			on("ended", () => {
				runSync(
					updateState((s) => ({
						...s,
						playbackState: "finished",
						currentTime: getCurrentTime(),
					})),
				)
				stopRaf()
			})

			on("error", () => {
				clearPendingPlay()
				clearPendingSeek()
				runSync(
					updateState((s) => ({
						...s,
						playbackState: "unavailable",
						duration: 0,
						currentTime: 0,
					})),
				)
				stopRaf()
			})

			yield* Effect.addFinalizer(() =>
				Effect.sync(() => {
					stopRaf()
					for (const [event, listener] of listeners) {
						element.removeEventListener(event, listener)
					}
					listeners.length = 0
					element.pause()
					element.removeAttribute("src")
					fader.dispose()
					preloader.clear()
				}),
			)

			// -----------------------------------------------------------------------
			// Transport operations
			// -----------------------------------------------------------------------

			const play = Effect.fn("AudioPlayer.play")(function* () {
				fader.attach(element)
				const state = yield* SubscriptionRef.get(stateRef)
				if (state.playbackState === "unavailable") return

				if (!element.src) {
					setPending({ play: true })
					return
				}

				clearPendingPlay()
				yield* fader.resumeIfSuspended()

				const fadeToken = fader.preparePlay()

				// playbackRate is set in loadSection() - don't set again here (triggers Safari pause bug)
				yield* Effect.tryPromise(() => element.play()).pipe(
					Effect.matchEffect({
						onFailure: () => Effect.sync(() => fader.cancelPlayFade(fadeToken)),
						onSuccess: () =>
							Effect.gen(function* () {
								fader.fadeInPlay(fadeToken)
								yield* updateState((s) => ({ ...s, playbackState: "playing" }))
							}),
					}),
				)
			})

			const pause = Effect.fn("AudioPlayer.pause")(function* () {
				fader.attach(element)
				fader.fadePause(element)
				yield* updateState((s) => ({ ...s, playbackState: "paused" }))
			})

			const applyPending = Effect.fn("AudioPlayer.applyPending")(function* () {
				if (pending.loadId !== currentLoadId) {
					clearPendingPlay()
					clearPendingSeek()
					pending.loadId = currentLoadId
					return
				}

				if (pending.play) {
					clearPendingPlay()
					yield* play()
				}

				tryApplyPendingSeek()
			})

			const seekTo = Effect.fn("AudioPlayer.seekTo")(function* (timeSec: number) {
				fader.attach(element)
				const duration = Number.isFinite(element.duration) ? element.duration : null
				const nextTime = clampTime(timeSec, duration)

				if (!element.src || element.readyState < HTMLMediaElement.HAVE_METADATA) {
					markPendingSeek(nextTime)
					return
				}

				try {
					fader.fadeSeek(element, nextTime, () => markPendingSeek(nextTime))
				} catch {
					markPendingSeek(nextTime)
					return
				}

				const state = yield* SubscriptionRef.get(stateRef)
				if (state.playbackState === "finished" && duration !== null && nextTime < duration) {
					yield* updateState((s) => ({
						...s,
						playbackState: "paused",
						currentTime: nextTime,
					}))
				} else {
					yield* updateState((s) => ({
						...s,
						currentTime: nextTime,
					}))
				}
			})

			// -----------------------------------------------------------------------
			// Public API
			// -----------------------------------------------------------------------

			return AudioPlayer.of({
				changes: SubscriptionRef.changes(stateRef),
				stateRef,
				get: SubscriptionRef.get(stateRef),

				loadSection: Effect.fn("AudioPlayer.loadSection")(function* (
					sectionId: string,
					chapter: string,
					audioFile: string | undefined,
				) {
					fader.attach(element)
					if (!audioFile) {
						currentUrl = null
						element.pause()
						element.removeAttribute("src")
						stopRaf()
						clearPendingPlay()
						clearPendingSeek()
						yield* updateState((s) => ({
							...s,
							playbackState: "unavailable",
							duration: 0,
							currentTime: 0,
							loadedSectionId: sectionId,
						}))
						return
					}

					const url = buildAudioUrl(chapter, audioFile)
					if (currentUrl === url) return

					currentUrl = url
					const loadId = ++loadSequence
					currentLoadId = loadId
					clearPendingSeek()
					pending.loadId = loadId

					element.pause()
					stopRaf()
					element.src = url
					element.preload = "auto"
					element.playbackRate = currentRate
					element.load()

					yield* updateState((s) => ({
						...s,
						playbackState: "loading",
						duration: 0,
						currentTime: 0,
						loadedSectionId: sectionId,
					}))

					yield* applyPending()
				}),

				preload: Effect.fn("AudioPlayer.preload")(function* (chapter: string, audioFile: string) {
					yield* preloader.preload(buildAudioUrl(chapter, audioFile))
				}),

				play,
				pause,

				toggle: Effect.fn("AudioPlayer.toggle")(function* () {
					const state = yield* SubscriptionRef.get(stateRef)
					if (state.playbackState === "playing") {
						yield* pause()
					} else {
						yield* play()
					}
				}),

				restart: Effect.fn("AudioPlayer.restart")(function* () {
					element.currentTime = 0
					yield* play()
				}),

				seekTo,

				seekBy: (deltaSec: number) => seekTo(seekBaseTime() + deltaSec),

				setPlaybackRate: (rate: PlaybackRate) =>
					Effect.sync(() => {
						currentRate = rate
						element.playbackRate = rate
					}),

				setVolume: (volume: number) =>
					Effect.sync(() => {
						fader.setVolume(volume, element)
					}),
			})
		}),
	)
}
