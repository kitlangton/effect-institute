/**
 * Bounded LRU preloader that warms the HTTP cache for upcoming narration audio files.
 */
import { Effect } from "effect"
import { ChapterPaths } from "@/lib/chapter-paths"

const DEFAULT_MAX_PRELOAD_CACHE = 20

export const buildAudioUrl = (chapter: string, audioFile: string): string => ChapterPaths.audioUrl(chapter, audioFile)

export class AudioPreloader {
	private readonly cache = new Set<string>()
	private readonly inFlight = new Set<string>()
	private readonly maxCache: number

	constructor(maxCache = DEFAULT_MAX_PRELOAD_CACHE) {
		this.maxCache = maxCache
	}

	private remember(url: string): void {
		if (this.cache.has(url)) {
			this.cache.delete(url)
		}
		this.cache.add(url)
		if (this.cache.size <= this.maxCache) return
		const oldest = this.cache.values().next().value
		if (oldest) this.cache.delete(oldest)
	}

	preload(url: string): Effect.Effect<void> {
		const self = this
		return Effect.gen(function* () {
			if (self.cache.has(url) || self.inFlight.has(url)) return
			self.inFlight.add(url)

			yield* Effect.gen(function* () {
				const response = yield* Effect.tryPromise(() => fetch(url, { cache: "force-cache" })).pipe(
					Effect.tapError((error) => Effect.logWarning("[AudioPlayer] preload fetch failed", error)),
					Effect.orElseSucceed(() => null),
				)

				if (response === null) return

				if (!response.ok) {
					yield* Effect.logWarning(`[AudioPlayer] preload fetch failed: ${response.status} ${response.statusText}`)
					return
				}

				yield* Effect.tryPromise(() => response.arrayBuffer()).pipe(Effect.catch(() => Effect.void))
				self.remember(url)
			}).pipe(
				Effect.ensuring(
					Effect.sync(() => {
						self.inFlight.delete(url)
					}),
				),
			)
		})
	}

	clear(): void {
		this.cache.clear()
		this.inFlight.clear()
	}
}
