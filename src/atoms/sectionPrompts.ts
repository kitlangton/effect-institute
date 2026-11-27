import { Atom } from "effect/reactivity"
import { isFinishedAtom, playbackStateAtom } from "./audioPlayer"
import { canGoNextChapterAtom, courseManifestLoadedAtom, nextChapterAtom } from "./course"
import { activeIndexAtom, canGoNextAtom, completedSectionsAtom, progressHydratedAtom } from "./narration"

/**
 * Per-section derived prompts.
 * Computes visibility flags for all the "press space" type prompts.
 */
export const sectionPromptsFamily = Atom.family((sectionIndex: number) =>
	Atom.make((get) => {
		const activeIndex = get(activeIndexAtom)
		const isFinished = get(isFinishedAtom)
		const canGoNext = get(canGoNextAtom)
		const canGoNextChapter = get(canGoNextChapterAtom)
		const completedSections = get(completedSectionsAtom)
		const progressHydrated = get(progressHydratedAtom)
		const playbackState = get(playbackStateAtom)
		const nextChapter = get(nextChapterAtom)
		const courseManifestLoaded = get(courseManifestLoadedAtom)

		const isActive = sectionIndex === activeIndex

		return {
			// Wait for progress to load before showing "press space" - prevents flash on load
			// Only show when first section is active (user hasn't scrolled/navigated away)
			showPressSpace:
				progressHydrated &&
				sectionIndex === 0 &&
				activeIndex === 0 &&
				completedSections.size === 0 &&
				playbackState === "idle",
			showNextSection: isActive && isFinished && canGoNext,
			showNextChapter: isActive && isFinished && !canGoNext && canGoNextChapter,
			showGoHome: isActive && isFinished && !canGoNext && !canGoNextChapter && courseManifestLoaded,
			nextChapterTitle: nextChapter?.title ?? null,
		}
	}),
)
