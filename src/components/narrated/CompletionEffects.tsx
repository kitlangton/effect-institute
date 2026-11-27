/**
 * Completion effect consumers.
 *
 * These components consume the state-driven completion atoms:
 * - CompletionSoundPlayer: plays sound when pendingCompletionSoundAtom is true
 * - CompletionRingTrigger: triggers ring animation when pendingRingSectionAtom has a value
 *
 * They're simple "state consumers" - no event processing or deduplication needed.
 */
import { useAtom, useAtomSet } from "@effect/atom-react"
import { useEffect } from "react"
import { pendingCompletionSoundAtom, pendingRingSectionAtom } from "@/atoms/completionEffects"
import { completionRingsAtom, triggerCompletionRing } from "@/atoms/completionRings"
import { appSounds } from "@/sounds/AppSounds"

/**
 * Plays completion sound when triggered.
 * Mount once at chapter level.
 */
export function CompletionSoundPlayer() {
	const [pending, setPending] = useAtom(pendingCompletionSoundAtom)

	useEffect(() => {
		if (pending) {
			appSounds.playCompletionSound()
			setPending(false)
		}
	}, [pending, setPending])

	return null
}

/**
 * Triggers ring animation when a section ID is set.
 * Looks up DOM element by data attribute, triggers ring, clears state.
 * Mount once at chapter level.
 */
export function CompletionRingTrigger() {
	const [sectionId, setSectionId] = useAtom(pendingRingSectionAtom)
	const setRings = useAtomSet(completionRingsAtom)

	useEffect(() => {
		if (!sectionId) return

		// Find the DOM element for this section's progress square
		// GroupProgressSquares will add data-section-id attribute
		const el = document.querySelector(`[data-section-square="${sectionId}"]`)
		if (el) {
			const rect = el.getBoundingClientRect()
			const centerX = rect.left + rect.width / 2
			const centerY = rect.top + rect.height / 2
			triggerCompletionRing(setRings, centerX, centerY)
		}

		// Clear the pending state
		setSectionId(null)
	}, [sectionId, setSectionId, setRings])

	return null
}

/**
 * Combined completion effects - mount once at chapter level.
 * Replaces the old useCompletionEffects hook.
 */
export function CompletionEffects() {
	return (
		<>
			<CompletionSoundPlayer />
			<CompletionRingTrigger />
		</>
	)
}
