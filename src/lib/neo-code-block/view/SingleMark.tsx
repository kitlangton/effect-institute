"use client"

import { motion } from "motion/react"
import React from "react"
import {
	MARK_ANIMATE_BLUR,
	MARK_ANIMATE_OPACITY,
	MARK_BORDER_WIDTH,
	MARK_EXIT_OPACITY,
	MARK_INITIAL_BLUR,
	MARK_INITIAL_OPACITY,
	MARK_OPACITY_TRANSITION,
	MARK_PADDING,
	MARK_TRANSITION,
	MARK_VERTICAL_PADDING,
} from "../constants"
import { useTextMeasurement } from "../hooks/useTextMeasurement"

interface SingleMarkProps {
	lineId: string
	lineText: string
	mark: { start: number; end: number }
	colors: { background: string; border: string }
	codeBlockRef: React.RefObject<HTMLPreElement | null>
}

/**
 * Individual mark rendered as an SVG rect with animations.
 * Measures text position and animates into place.
 */
export const SingleMark = React.memo(function SingleMark({
	lineId,
	lineText,
	mark,
	colors,
	codeBlockRef,
}: SingleMarkProps) {
	const { measurement, hasInitialized } = useTextMeasurement({
		lineId,
		lineText,
		start: mark.start,
		end: mark.end,
		codeBlockRef,
	})

	// Don't render until we have a valid measurement
	if (!hasInitialized || !measurement || measurement.textWidth === 0) {
		return null
	}

	// Apply mark-specific padding
	const position = {
		top: measurement.lineTop - MARK_VERTICAL_PADDING - MARK_BORDER_WIDTH,
		left: measurement.textOffsetX - MARK_PADDING - MARK_BORDER_WIDTH,
		width: measurement.textWidth + MARK_PADDING * 2,
		height: measurement.lineHeight + MARK_VERTICAL_PADDING * 2,
	}

	return (
		<motion.rect
			initial={{
				opacity: MARK_INITIAL_OPACITY,
				x: position.left + position.width / 2,
				y: position.top + position.height / 2,
				width: 0,
				height: 0,
				filter: MARK_INITIAL_BLUR,
			}}
			animate={{
				opacity: MARK_ANIMATE_OPACITY,
				x: position.left,
				y: position.top,
				width: position.width,
				height: position.height,
				filter: MARK_ANIMATE_BLUR,
			}}
			exit={{
				opacity: MARK_EXIT_OPACITY,
				x: position.left + position.width / 2,
				y: position.top + position.height / 2,
				width: 0,
				height: 0,
				filter: MARK_INITIAL_BLUR,
			}}
			fill={colors.background}
			stroke={colors.border}
			strokeWidth={MARK_BORDER_WIDTH}
			transition={{
				opacity: MARK_OPACITY_TRANSITION,
				x: MARK_TRANSITION,
				y: MARK_TRANSITION,
				width: MARK_TRANSITION,
				height: MARK_TRANSITION,
				filter: MARK_TRANSITION,
			}}
		/>
	)
})
