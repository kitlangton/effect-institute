/**
 * Audio player atoms.
 * Service is defined in services/AudioPlayer.ts to avoid circular dependency.
 */

import { Effect, Schema } from "effect"
import { Atom, AsyncResult as Result } from "effect/reactivity"
import { frontendKeyValueRuntime, frontendRuntime } from "./runtime"
import { AudioPlayer, type PlaybackRate, type PlaybackState } from "./services"

export {
	AudioPlayer,
	type AudioPlayerState,
	PLAYBACK_RATES,
	type PlaybackRate,
	type PlaybackState,
} from "./services"

const PlaybackRateSchema = Schema.Union([
	Schema.Literal(0.5),
	Schema.Literal(0.75),
	Schema.Literal(1),
	Schema.Literal(1.25),
	Schema.Literal(1.5),
	Schema.Literal(2),
	Schema.Literal(2.5),
	Schema.Literal(3),
])

// =============================================================================
// Playback Rate Atom (persisted)
// =============================================================================

export const playbackRateAtom = Atom.kvs({
	runtime: frontendKeyValueRuntime,
	key: "effect-institute:playback-rate",
	schema: PlaybackRateSchema,
	defaultValue: () => 1 as PlaybackRate,
})

// Non-persisted temporary override (for demos, etc.)
export const playbackRateOverrideAtom = Atom.make<PlaybackRate | null>(null)

// Effective rate: override takes precedence over persisted
export const effectivePlaybackRateAtom = Atom.readable((get) => {
	const override = get(playbackRateOverrideAtom)
	const persisted = get(playbackRateAtom)
	return override ?? persisted
})

// =============================================================================
// State Atoms (reactive RAF pattern)
// =============================================================================

export const audioStateAtom = frontendRuntime.subscriptionRef(Effect.map(AudioPlayer, (player) => player.stateRef))

export const playbackStateAtom = Atom.map(audioStateAtom, (result) =>
	Result.isSuccess(result) ? result.value.playbackState : ("idle" as PlaybackState),
)

export const isFinishedAtom = Atom.map(audioStateAtom, (result) =>
	Result.isSuccess(result) ? result.value.playbackState === "finished" : false,
)

export const loadedSectionIdAtom = Atom.map(audioStateAtom, (result) =>
	Result.isSuccess(result) ? result.value.loadedSectionId : null,
)

// =============================================================================
// Per-Section Playback State (Atom.family)
// =============================================================================

export interface SectionPlaybackState {
	readonly playbackState: PlaybackState
	readonly currentTime: number
}

export const IDLE_PLAYBACK: SectionPlaybackState = Object.freeze({
	playbackState: "idle" as PlaybackState,
	currentTime: 0,
})

/**
 * Per-section view of playback state using Atom.family.
 * Each section sees its own isolated state:
 * - If this section's audio is loaded: returns real playback state
 * - Otherwise: returns shared frozen IDLE_PLAYBACK (zero allocations per RAF tick)
 */
export const sectionPlaybackAtom = Atom.family((sectionId: string) =>
	Atom.readable((get): SectionPlaybackState => {
		const result = get(audioStateAtom)
		if (Result.isSuccess(result) && result.value.loadedSectionId === sectionId) {
			return {
				playbackState: result.value.playbackState,
				currentTime: result.value.currentTime,
			}
		}
		return IDLE_PLAYBACK
	}).pipe(
		Atom.withEquality<SectionPlaybackState>(
			(a, b) => a === b || (a.playbackState === b.playbackState && a.currentTime === b.currentTime),
		),
	),
)

// =============================================================================
// Recent Seek Tracking (for fast animation mode)
// =============================================================================

/** When true, word animations should snap quickly instead of slow fade */
export const recentSeekAtom = Atom.make(false)

// =============================================================================
// Action Atoms
// =============================================================================

export const loadSectionAtom = frontendRuntime.fn(
	(args: { sectionId: string; chapter: string; audioFile: string | undefined }) =>
		Effect.gen(function* () {
			const player = yield* AudioPlayer
			yield* player.loadSection(args.sectionId, args.chapter, args.audioFile)
		}),
)

export const preloadSectionAtom = frontendRuntime.fn((args: { chapter: string; audioFile: string }) =>
	Effect.gen(function* () {
		const player = yield* AudioPlayer
		yield* player.preload(args.chapter, args.audioFile)
	}),
)

export const playAtom = frontendRuntime.fn(() =>
	Effect.gen(function* () {
		const player = yield* AudioPlayer
		yield* player.play()
	}),
)

export const pauseAtom = frontendRuntime.fn(() =>
	Effect.gen(function* () {
		const player = yield* AudioPlayer
		yield* player.pause()
	}),
)

export const toggleAtom = frontendRuntime.fn(() =>
	Effect.gen(function* () {
		const player = yield* AudioPlayer
		yield* player.toggle()
	}),
)

export const seekToAtom = frontendRuntime.fn((timeSec: number) =>
	Effect.gen(function* () {
		const player = yield* AudioPlayer
		yield* player.seekTo(timeSec)
	}),
)

export const seekByAtom = frontendRuntime.fn((deltaSec: number) =>
	Effect.gen(function* () {
		const player = yield* AudioPlayer
		yield* player.seekBy(deltaSec)
	}),
)

export const setPlaybackRateAtom = frontendRuntime.fn((rate: PlaybackRate) =>
	Effect.gen(function* () {
		const player = yield* AudioPlayer
		yield* player.setPlaybackRate(rate)
	}),
)

export const restartAtom = frontendRuntime.fn(() =>
	Effect.gen(function* () {
		const player = yield* AudioPlayer
		yield* player.restart()
	}),
)

export const setVolumeAtom = frontendRuntime.fn((volume: number) =>
	Effect.gen(function* () {
		const player = yield* AudioPlayer
		yield* player.setVolume(volume)
	}),
)

/** Read exact playback position for imperative commands without subscribing React to RAF updates. */
export const getCurrentTimeAtom = frontendRuntime.fn(() =>
	Effect.gen(function* () {
		const player = yield* AudioPlayer
		return (yield* player.get).currentTime
	}),
)
