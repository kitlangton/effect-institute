/**
 * Completion ring animations - displays expanding green rings when sections complete.
 * Uses a portal to render above all other content.
 */
import { Atom } from "effect/reactivity"

export interface RingAnimation {
	id: number
	x: number
	y: number
}

/** Active ring animations to display */
export const completionRingsAtom = Atom.make<readonly RingAnimation[]>([])

let nextId = 0

/**
 * Trigger a completion ring at the given screen coordinates.
 * Auto-removes after animation completes.
 */
export function triggerCompletionRing(
	setRings: (fn: (prev: readonly RingAnimation[]) => readonly RingAnimation[]) => void,
	x: number,
	y: number,
) {
	const id = nextId++
	setRings((prev) => [...prev, { id, x, y }])

	// Remove after animation completes (2.5s for opacity fade)
	setTimeout(() => {
		setRings((prev) => prev.filter((r) => r.id !== id))
	}, 2500)
}
