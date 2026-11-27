import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { KeyValueStore } from "effect/persistence"
import { ProgressService } from "./ProgressService"

const makeTestLayer = (kvsLayer: Layer.Layer<KeyValueStore.KeyValueStore> = KeyValueStore.layerMemory) =>
	ProgressService.layer.pipe(Layer.provideMerge(kvsLayer))

describe("ProgressService", () => {
	it.effect("persists, deduplicates, lists, and resets local progress via KeyValueStore", () =>
		Effect.gen(function* () {
			const progress = yield* ProgressService

			expect(yield* progress.loadProgress("intro")).toEqual([])
			expect(yield* progress.loadAllProgress()).toEqual({})

			yield* progress.markCompleted("intro", "s1")
			yield* progress.markCompleted("intro", "s1")
			yield* progress.markCompleted("intro", "s2")
			yield* progress.markCompleted("basics", "b1")

			expect(yield* progress.loadProgress("intro")).toEqual(["s1", "s2"])
			expect(yield* progress.loadAllProgress()).toEqual({
				intro: ["s1", "s2"],
				basics: ["b1"],
			})

			yield* progress.resetAll()
			expect(yield* progress.loadProgress("intro")).toEqual([])
			expect(yield* progress.loadAllProgress()).toEqual({})
		}).pipe(Effect.provide(makeTestLayer())),
	)

	it.effect("migrates legacy per-chapter keys into the unified KeyValueStore entry", () =>
		Effect.gen(function* () {
			const kvs = yield* KeyValueStore.KeyValueStore
			const progress = yield* ProgressService

			yield* kvs.set("effect-institute:progress:intro", JSON.stringify(["legacy-1", "legacy-2"]))

			const loaded = yield* progress.loadProgress("intro")
			expect(loaded).toEqual(["legacy-1", "legacy-2"])

			expect(yield* kvs.get("effect-institute:progress:intro")).toBeUndefined()
			expect(yield* progress.loadAllProgress()).toEqual({
				intro: ["legacy-1", "legacy-2"],
			})
		}).pipe(Effect.provide(makeTestLayer())),
	)

	it.effect("recovers cleanly from corrupt local storage data", () =>
		Effect.gen(function* () {
			const kvs = yield* KeyValueStore.KeyValueStore
			const progress = yield* ProgressService

			yield* kvs.set("effect-institute:progress", "{not-valid-json")

			expect(yield* progress.loadProgress("intro")).toEqual([])
			expect(yield* progress.loadAllProgress()).toEqual({})
		}).pipe(Effect.provide(makeTestLayer())),
	)
})
