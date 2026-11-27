/**
 * Unified frontend runtime for all atoms and non-React Effect entry points.
 *
 * Consolidates all service layers onto a single shared MemoMap so every service
 * is strictly a singleton across React atoms, kvs atoms, and standalone Promise helpers:
 * - BrowserKeyValueStore (localStorage persistence)
 * - AudioPlayer (audio playback)
 * - ProgressService (local progress tracking, depends on KeyValueStore)
 * - WakeLockService (prevents screen dimming during playback)
 */

import { BrowserKeyValueStore } from "@effect/platform-browser"
import { Layer, ManagedRuntime } from "effect"
import { Atom } from "effect/reactivity"
import { AudioPlayer, ProgressService, WakeLockService } from "./services"

const FrontendBase = Layer.mergeAll(BrowserKeyValueStore.layerLocalStorage, AudioPlayer.layer)

const FrontendLive = Layer.mergeAll(ProgressService.layer, WakeLockService.layer).pipe(Layer.provideMerge(FrontendBase))

const frontendMemoMap = Layer.makeMemoMapUnsafe()
const frontendRuntimeFactory = Atom.context({ memoMap: frontendMemoMap })

const sharedManagedRuntime = ManagedRuntime.make(FrontendLive, { memoMap: frontendMemoMap })

/** KeyValueStore AtomRuntime sharing the unified MemoMap for sync localStorage reads. */
export const frontendKeyValueRuntime = frontendRuntimeFactory(BrowserKeyValueStore.layerLocalStorage)

/** Unified frontend AtomRuntime for all services. */
export const frontendRuntime = frontendRuntimeFactory(FrontendLive)

/** Run an Effect against the unified frontend services outside React. */
export const runFrontendPromise: typeof sharedManagedRuntime.runPromise = (effect, options) =>
	sharedManagedRuntime.runPromise(effect, options)
