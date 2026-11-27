import { useAtomSet } from "@effect/atom-react"
import { useCallback, useEffect, useRef } from "react"
import { baseTooltipAtom, overrideTooltipAtom, type TooltipContent } from "@/atoms/cursor"

/**
 * Hook for setting cursor tooltip content on hover (base layer).
 * Returns event handlers to spread onto an element.
 *
 * @example
 * ```tsx
 * const tooltip = useCursorTooltip({ label: "Restart", shortcut: "R" })
 * return <button {...tooltip} onClick={onRestart}>...</button>
 * ```
 */
export function useCursorTooltip(content: NonNullable<TooltipContent>) {
	const setTooltip = useAtomSet(baseTooltipAtom)
	const isHoveringRef = useRef(false)

	// Update tooltip if content changes while hovering
	useEffect(() => {
		if (isHoveringRef.current) {
			setTooltip(content)
		}
	}, [content, setTooltip])

	const onMouseEnter = useCallback(() => {
		isHoveringRef.current = true
		setTooltip(content)
	}, [setTooltip, content])

	const onMouseLeave = useCallback(() => {
		isHoveringRef.current = false
		setTooltip(null)
	}, [setTooltip])

	return { onMouseEnter, onMouseLeave }
}

/**
 * Hook for overlay tooltips (e.g., dictionary definitions).
 * Uses override layer - shows on top of base tooltip without clearing it.
 * When disabled is true, no handlers are returned.
 */
export function useCursorTooltipWhen(content: NonNullable<TooltipContent>, disabled: boolean) {
	const setOverride = useAtomSet(overrideTooltipAtom)
	const isHoveringRef = useRef(false)

	// Update tooltip if content changes while hovering
	useEffect(() => {
		if (isHoveringRef.current && !disabled) {
			setOverride(content)
		}
	}, [content, disabled, setOverride])

	const onMouseEnter = useCallback(() => {
		isHoveringRef.current = true
		if (!disabled) {
			setOverride(content)
		}
	}, [setOverride, content, disabled])

	const onMouseLeave = useCallback(() => {
		isHoveringRef.current = false
		if (!disabled) {
			// Clear override, base tooltip shows through
			setOverride(null)
		}
	}, [setOverride, disabled])

	return { onMouseEnter, onMouseLeave }
}
