import { Atom } from "effect/reactivity"
import type { ReactNode } from "react"

export type CursorState = "default" | "play" | "pause" | "restart" | "up" | "down"

/**
 * Tooltip content for the cursor-following tooltip.
 * Can include an icon, label, and optional keyboard shortcut.
 */
export type TooltipContent = {
	icon?: ReactNode
	/** Optional header/title shown above the label */
	title?: string
	label: string
	shortcut?: string
} | null

/** Base tooltip (e.g., Play/Pause from section hover) */
export const baseTooltipAtom = Atom.make<TooltipContent>(null)

/** Override tooltip (e.g., dictionary definitions) - takes precedence over base */
export const overrideTooltipAtom = Atom.make<TooltipContent>(null)

/** Tracks whether Option/Alt key is currently held (for persistent tooltip override) */
export const optionHeldAtom = Atom.make(false)

/**
 * Hover session model - treats hovering as continuous rather than discrete events.
 * Sound plays once when session starts, not on every section boundary.
 */
export type HoverSession = { type: "inactive" } | { type: "active"; sectionIndex: number }

export const hoverSessionAtom = Atom.make<HoverSession>({ type: "inactive" })

/**
 * Context menu target - tracks which section was right-clicked.
 * Used by the shared ContextMenu to show section-specific actions.
 */
export type ContextMenuTarget = { type: "none" } | { type: "section"; sectionId: string; sectionIndex: number }

export const contextMenuTargetAtom = Atom.make<ContextMenuTarget>({
	type: "none",
})

/**
 * Derive cursor state from hover session + playback context.
 * This is a pure function, not an atom - components call it with current values.
 */
export function deriveCursorState(
	session: HoverSession,
	activeIndex: number,
	isPlaying: boolean,
	isFinished: boolean = false,
): CursorState {
	if (session.type === "inactive") return "default"

	const { sectionIndex } = session
	if (sectionIndex === activeIndex) {
		if (isPlaying) return "pause"
		if (isFinished) return "restart"
		return "play"
	}
	return sectionIndex < activeIndex ? "up" : "down"
}
