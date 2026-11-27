import { Atom } from "effect/reactivity"
import { isFinishedAtom, loadedSectionIdAtom } from "./audioPlayer"
import {
	activeIndexAtom,
	activeSectionAtom,
	chapterAtom,
	completedSectionsAtom,
	progressHydratedAtom,
} from "./narration"

/**
 * Derived atom that computes whether a section completion should trigger.
 *
 * Returns null if completion should NOT trigger.
 * Returns trigger data if all conditions are met.
 *
 * The watching effect still needs to track the false→true transition
 * using a ref, but all the complex condition logic is moved here.
 */
export const completionTriggerAtom = Atom.make((get) => {
	const isFinished = get(isFinishedAtom)
	const loadedSectionId = get(loadedSectionIdAtom)
	const activeSection = get(activeSectionAtom)
	const progressHydrated = get(progressHydratedAtom)
	const chapter = get(chapterAtom)
	const completedSections = get(completedSectionsAtom)
	const activeIndex = get(activeIndexAtom)

	// All conditions must be met
	if (!isFinished) return null
	if (!activeSection) return null
	if (!chapter) return null
	if (!progressHydrated) return null

	// Audio must match active section (prevents stale triggers during navigation)
	if (loadedSectionId !== activeSection.id) return null

	// Section must not be already completed (prevents re-triggers on re-listens)
	if (completedSections.has(activeIndex)) return null

	return {
		sectionId: activeSection.id,
		activeIndex,
		chapter,
	}
})

export type CompletionTrigger = NonNullable<ReturnType<(typeof completionTriggerAtom)["read"]>>
