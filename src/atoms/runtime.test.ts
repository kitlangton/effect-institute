import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { KeyValueStore } from "effect/persistence"
import { AsyncResult, AtomRegistry } from "effect/reactivity"
import { frontendKeyValueRuntime, frontendRuntime, runFrontendPromise } from "./runtime"
import { AudioPlayer, ProgressService } from "./services"

const readAsyncAtom = <A, E>(
	registry: AtomRegistry.AtomRegistry,
	atom: import("effect/reactivity/Atom").Atom<AsyncResult.AsyncResult<A, E>>,
): Promise<A> =>
	new Promise((resolve, reject) => {
		const initial = registry.get(atom)
		if (AsyncResult.isSuccess(initial)) {
			resolve(initial.value)
			return
		}
		if (AsyncResult.isFailure(initial)) {
			reject(initial.cause)
			return
		}
		const unsubscribe = registry.subscribe(atom, (result) => {
			if (AsyncResult.isSuccess(result)) {
				unsubscribe()
				resolve(result.value)
			} else if (AsyncResult.isFailure(result)) {
				unsubscribe()
				reject(result.cause)
			}
		})
	})

describe("frontend runtime unification", () => {
	it("shares singleton AudioPlayer, ProgressService, and KeyValueStore instances across runtimes", async () => {
		const registry = AtomRegistry.make()
		try {
			const servicesAtom = frontendRuntime.atom(
				Effect.gen(function* () {
					const player = yield* AudioPlayer
					const progress = yield* ProgressService
					const kvs = yield* KeyValueStore.KeyValueStore
					return { player, progress, kvs }
				}),
			)
			const kvsOnlyAtom = frontendKeyValueRuntime.atom(KeyValueStore.KeyValueStore)

			const [fromAtom, fromManaged, fromKvsRuntime] = await Promise.all([
				readAsyncAtom(registry, servicesAtom),
				runFrontendPromise(
					Effect.gen(function* () {
						const player = yield* AudioPlayer
						const progress = yield* ProgressService
						const kvs = yield* KeyValueStore.KeyValueStore
						return { player, progress, kvs }
					}),
				),
				readAsyncAtom(registry, kvsOnlyAtom),
			])

			expect(fromAtom.player).toBe(fromManaged.player)
			expect(fromAtom.progress).toBe(fromManaged.progress)
			expect(fromAtom.kvs).toBe(fromManaged.kvs)
			expect(fromKvsRuntime).toBe(fromAtom.kvs)
		} finally {
			registry.dispose()
		}
	})
})
