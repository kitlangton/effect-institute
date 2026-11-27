/**
 * Visual state atoms for completion effects.
 *
 * This is a STATE-DRIVEN model, not event-driven:
 * - The controller (useAudioController) validates and updates these atoms
 * - Components just render based on current state
 * - No event processing, deduplication, or refs needed in components
 *
 * Initial state is naturally correct:
 * - Empty set = no glow
 * - false = no sound
 * - null = no ring
 */
import { Atom } from "effect/reactivity"

/**
 * Set of section IDs currently showing the glow effect.
 * Sections are added on completion, removed after 1s fade.
 */
export const glowingSectionsAtom = Atom.make(new Set<string>())

/**
 * When true, the completion sound should play.
 * Consumer plays sound then sets back to false.
 */
export const pendingCompletionSoundAtom = Atom.make(false)

/**
 * Section ID that should show the ring animation.
 * Consumer finds DOM element, triggers ring, then sets back to null.
 */
export const pendingRingSectionAtom = Atom.make<string | null>(null)

// Helper to add a section to the glowing set
export const addGlowingSection = (sectionId: string) => (prev: ReadonlySet<string>) => {
	const next = new Set(prev)
	next.add(sectionId)
	return next
}

// Helper to remove a section from the glowing set
export const removeGlowingSection = (sectionId: string) => (prev: ReadonlySet<string>) => {
	const next = new Set(prev)
	next.delete(sectionId)
	return next
}
