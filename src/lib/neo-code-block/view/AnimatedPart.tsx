"use client"

import { motion } from "motion/react"
import React from "react"
import {
	VARIABLE_PART_ANIMATE_OPACITY,
	VARIABLE_PART_EXIT_OPACITY,
	VARIABLE_PART_OPACITY_TRANSITION,
	VARIABLE_PART_TRANSITION,
} from "../constants"

/* ------------------------------------------------------------------ */
/* AnimatedPart Component                                              */
/* ------------------------------------------------------------------ */

/**
 * Reusable component for animated code parts (stable or variable).
 *
 * BULLETPROOF RENDERING: this component never unmounts its content. The
 * span is always in the DOM and `isVisible` only drives the `animate`
 * target (width/opacity/blur), so any sequence of rapid forward/backward
 * steps converges to the current frame's state. There are no
 * AnimatePresence exit/re-enter races that can leave a part stuck
 * invisible.
 *
 * It mounts with `initial={false}` (renders its current state instantly):
 * entry animation is the owning line's job. Visibility toggles after mount
 * animate width/opacity/blur.
 *
 * Hidden parts still contain their text (so width collapse/expand can
 * animate), but are marked with `data-measure-exclude` so DOM text
 * measurement (Range API offsets) only sees visible content, and
 * `aria-hidden` so screen readers skip them.
 */
export interface AnimatedPartProps {
	/** Whether the part is currently visible */
	isVisible: boolean
	/** Children to render inside the animated span */
	children: React.ReactNode
}

const VISIBLE_STATE = {
	width: "auto" as const,
	opacity: VARIABLE_PART_ANIMATE_OPACITY,
	filter: "blur(0px)",
}

const HIDDEN_STATE = {
	width: 0,
	opacity: VARIABLE_PART_EXIT_OPACITY,
	filter: "blur(4px)",
}

export const AnimatedPart = React.memo(function AnimatedPart({ isVisible, children }: AnimatedPartProps) {
	const [allowWillChange, setAllowWillChange] = React.useState(true)
	React.useEffect(() => {
		setAllowWillChange(true)
		const timeoutId = window.setTimeout(() => setAllowWillChange(false), 500)
		return () => window.clearTimeout(timeoutId)
	}, [])

	return (
		<motion.span
			className="part whitespace-pre font-inherit leading-inherit overflow-hidden flex items-center"
			{...(isVisible ? {} : { "data-measure-exclude": "true", "aria-hidden": true })}
			initial={false}
			animate={isVisible ? VISIBLE_STATE : HIDDEN_STATE}
			transition={{
				opacity: VARIABLE_PART_OPACITY_TRANSITION,
				width: VARIABLE_PART_TRANSITION,
				filter: VARIABLE_PART_OPACITY_TRANSITION,
			}}
			style={{
				verticalAlign: "baseline",
				willChange: allowWillChange ? "width, opacity, filter" : undefined,
				transform: "translateZ(0)",
				backfaceVisibility: "hidden",
				contain: "layout",
			}}
		>
			{children}
		</motion.span>
	)
})
