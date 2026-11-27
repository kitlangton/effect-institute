/**
 * Local lesson progress service backed by Effect KeyValueStore (localStorage).
 * Separate from atoms to avoid circular dependency with runtime.
 */
import { Context, Effect, Layer, Option, Schema } from "effect"
import { KeyValueStore } from "effect/persistence"

const LOCAL_PROGRESS_KEY = "effect-institute:progress"
const LEGACY_LOCAL_STORAGE_PREFIX = "effect-institute:progress:"

const SectionIdsSchema = Schema.Array(Schema.String)
const LocalProgressMapSchema = Schema.Record(Schema.String, SectionIdsSchema)

function mergeProgress(...sets: ReadonlyArray<readonly string[]>): string[] {
	return [...new Set(sets.flat())]
}

type ProgressServiceApi = {
	/** Load progress for a chapter. Returns section IDs. */
	readonly loadProgress: (chapter: string) => Effect.Effect<string[]>
	/** Load progress for all chapters. Returns a map of chapter → section IDs. */
	readonly loadAllProgress: () => Effect.Effect<Record<string, string[]>>
	/** Mark a section as completed. */
	readonly markCompleted: (chapter: string, sectionId: string) => Effect.Effect<void>
	/** Reset all progress. */
	readonly resetAll: () => Effect.Effect<void>
}

export declare namespace ProgressService {
	export interface Service extends ProgressServiceApi {}
}

export class ProgressService extends Context.Service<ProgressService, ProgressService.Service>()("ProgressService") {
	static readonly layer = Layer.effect(
		ProgressService,
		Effect.gen(function* () {
			const kvs = yield* KeyValueStore.KeyValueStore

			const progressStore = KeyValueStore.toSchemaStore(kvs, LocalProgressMapSchema)
			const legacyChapterStore = KeyValueStore.toSchemaStore(
				KeyValueStore.prefix(kvs, LEGACY_LOCAL_STORAGE_PREFIX),
				SectionIdsSchema,
			)

			const readLocalMap = (): Effect.Effect<Record<string, string[]>> =>
				progressStore.get(LOCAL_PROGRESS_KEY).pipe(
					Effect.map((opt) =>
						Option.match(opt, {
							onNone: () => ({}) as Record<string, string[]>,
							onSome: (record) => {
								const out: Record<string, string[]> = {}
								for (const [chapter, ids] of Object.entries(record)) {
									out[chapter] = [...ids]
								}
								return out
							},
						}),
					),
					Effect.catch((error) =>
						Effect.logWarning("[Progress] Failed to read local progress", error).pipe(
							Effect.as({} as Record<string, string[]>),
						),
					),
				)

			const writeLocalMap = (next: Record<string, readonly string[]>): Effect.Effect<void> =>
				progressStore
					.set(LOCAL_PROGRESS_KEY, next)
					.pipe(Effect.catch((error) => Effect.logWarning("[Progress] Failed to write local progress", error)))

			const readLegacyChapter = (chapter: string): Effect.Effect<string[]> =>
				legacyChapterStore.get(chapter).pipe(
					Effect.map((opt) =>
						Option.match(opt, {
							onNone: () => [] as string[],
							onSome: (ids) => [...ids],
						}),
					),
					Effect.catch(() => Effect.succeed([] as string[])),
				)

			const removeLegacyChapter = (chapter: string): Effect.Effect<void> =>
				legacyChapterStore.remove(chapter).pipe(Effect.catch(() => Effect.void))

			const loadProgress: ProgressServiceApi["loadProgress"] = (chapter) =>
				Effect.gen(function* () {
					const map = yield* readLocalMap()
					const legacy = yield* readLegacyChapter(chapter)
					const merged = mergeProgress(map[chapter] ?? [], legacy)
					if (legacy.length > 0) {
						yield* writeLocalMap({ ...map, [chapter]: merged })
						yield* removeLegacyChapter(chapter)
					}
					return merged
				})

			const loadAllProgress: ProgressServiceApi["loadAllProgress"] = () => readLocalMap()

			const markCompleted: ProgressServiceApi["markCompleted"] = (chapter, sectionId) =>
				Effect.gen(function* () {
					const map = yield* readLocalMap()
					const legacy = yield* readLegacyChapter(chapter)
					const current = mergeProgress(map[chapter] ?? [], legacy)
					if (!current.includes(sectionId) || legacy.length > 0) {
						yield* writeLocalMap({
							...map,
							[chapter]: mergeProgress(current, [sectionId]),
						})
						if (legacy.length > 0) {
							yield* removeLegacyChapter(chapter)
						}
					}
				})

			const resetAll: ProgressServiceApi["resetAll"] = () =>
				Effect.gen(function* () {
					const map = yield* readLocalMap()
					yield* progressStore
						.remove(LOCAL_PROGRESS_KEY)
						.pipe(Effect.catch((error) => Effect.logWarning("[Progress] Failed to clear local progress", error)))
					for (const chapter of Object.keys(map)) {
						yield* removeLegacyChapter(chapter)
					}
				})

			return ProgressService.of({
				loadProgress,
				loadAllProgress,
				markCompleted,
				resetAll,
			} satisfies ProgressServiceApi)
		}),
	)
}
