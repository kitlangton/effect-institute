import { useAtom, useAtomValue } from "@effect/atom-react"
import { ArrowClockwiseIcon, ArrowDownIcon, ArrowUpIcon, PauseIcon, PlayIcon } from "@phosphor-icons/react"
import { useEffect, useMemo, useRef } from "react"
import {
	baseTooltipAtom,
	type CursorState,
	deriveCursorState,
	hoverSessionAtom,
	type TooltipContent,
} from "@/atoms/cursor"

// Label config for cursor states when hovering sections
const cursorLabels: Record<CursorState, TooltipContent> = {
	default: null,
	play: { icon: <PlayIcon size={14} weight="fill" />, label: "Play" },
	pause: { icon: <PauseIcon size={14} weight="fill" />, label: "Pause" },
	restart: { icon: <ArrowClockwiseIcon size={14} weight="bold" />, label: "Restart" },
	up: { icon: <ArrowUpIcon size={14} weight="bold" />, label: "Previous" },
	down: { icon: <ArrowDownIcon size={14} weight="bold" />, label: "Next" },
}

interface ChapterCursorProps {
	activeIndex: number
	isPlaying: boolean
	isFinished: boolean
}

/**
 * Manages cursor tooltip state for section hovering.
 * Sets baseTooltipAtom based on which section is being hovered.
 * Does not render anything - tooltip is rendered by CursorTooltipRenderer.
 */
export function ChapterCursor({ activeIndex, isPlaying, isFinished }: ChapterCursorProps) {
	const hoverSession = useAtomValue(hoverSessionAtom)
	const [currentTooltip, setTooltip] = useAtom(baseTooltipAtom)

	// Keep a ref to the current tooltip for use in timeout callbacks
	const tooltipRef = useRef(currentTooltip)
	tooltipRef.current = currentTooltip

	// Derive cursor state synchronously from session + playback context
	const cursorState = useMemo(
		() => deriveCursorState(hoverSession, activeIndex, isPlaying, isFinished),
		[hoverSession, activeIndex, isPlaying, isFinished],
	)

	// Update tooltip atom when cursor state changes
	// Only SET tooltip when we have content - don't CLEAR it (that would race with other tooltip sources)
	useEffect(() => {
		const labelConfig = cursorLabels[cursorState]
		if (labelConfig) {
			setTooltip(labelConfig)
		}
	}, [cursorState, setTooltip])

	// Clear tooltip only when hover session explicitly ends (not on every state change)
	useEffect(() => {
		if (hoverSession.type === "inactive") {
			// Use a small delay to let other tooltip sources take over first
			const timeout = setTimeout(() => {
				// Check the CURRENT tooltip value (via ref) not the stale closure value
				const tooltip = tooltipRef.current
				// Only clear if the tooltip is still a section hover tooltip (has icon, no shortcut)
				// Button tooltips have shortcuts, so they won't be cleared
				if (tooltip?.icon && !tooltip.shortcut) {
					setTooltip(null)
				}
			}, 10)
			return () => clearTimeout(timeout)
		}
	}, [hoverSession.type, setTooltip])

	// Component doesn't render anything - tooltip is handled by CursorTooltipRenderer
	return null
}
