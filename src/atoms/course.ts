/**
 * Course-level state atoms for cross-chapter navigation.
 */
import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { fetchCourseManifest } from "@/lib/content/delivery"
import type { ChapterMetadata } from "@/lib/tooling/types"
import { chapterAtom, narrationAtom } from "./narration"

// --- Course Manifest ---

/** Ordered list of chapters, or null until a successful load. */
export const courseChaptersAtom = Atom.make<ChapterMetadata[] | null>(null).pipe(Atom.keepAlive)
export const courseManifestLoadedAtom = Atom.readable((get) => get(courseChaptersAtom) !== null)

/** Action atom to fetch the course manifest */
export const fetchCourseManifestAtom = Atom.fn(
	Effect.fnUntraced(function* () {
		const existing = yield* Atom.get(courseChaptersAtom)
		if (existing !== null) return existing

		const manifest = yield* Effect.tryPromise(() => fetchCourseManifest()).pipe(
			Effect.catch(() => Effect.succeed(null)),
		)
		if (!manifest) {
			// Leave this unloaded so chapter navigation can retry after transient failures.
			yield* Atom.set(courseChaptersAtom, null)
			return null
		}

		const sorted = [...manifest.chapters].sort((a: ChapterMetadata, b: ChapterMetadata) => a.order - b.order)
		// Filter draft chapters in production
		const filtered = import.meta.env.DEV ? sorted : sorted.filter((c: ChapterMetadata) => !c.draft)
		yield* Atom.set(courseChaptersAtom, filtered)
		return filtered
	}),
)

// --- Next Chapter ---

/** The next chapter after the current one (null if none or not loaded) */
export const nextChapterAtom = Atom.readable((get) => {
	const chapters = get(courseChaptersAtom)
	const currentChapter = get(chapterAtom)

	if (!chapters || !currentChapter) return null

	const currentIndex = chapters.findIndex((c) => c.id === currentChapter)
	if (currentIndex === -1) return null

	// Find next chapter that isn't comingSoon
	for (let i = currentIndex + 1; i < chapters.length; i++) {
		if (!chapters[i].comingSoon) {
			return chapters[i]
		}
	}

	return null
})

/** True when at the last section AND there's a next chapter available */
export const canGoNextChapterAtom = Atom.readable((get) => {
	const state = get(narrationAtom)
	const nextChapter = get(nextChapterAtom)

	const isLastSection = state.activeIndex >= state.sections.length - 1
	return isLastSection && nextChapter !== null
})
