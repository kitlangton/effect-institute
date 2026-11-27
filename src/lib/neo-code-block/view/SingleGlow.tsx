"use client"

import { motion } from "motion/react"
import React from "react"
import {
	GLOW_ANIMATE_OPACITY,
	GLOW_BLUR_RADIUS,
	GLOW_EXIT_OPACITY,
	GLOW_INITIAL_OPACITY,
	GLOW_OPACITY_TRANSITION,
	GLOW_TRANSITION,
	GLOW_VERTICAL_PADDING,
} from "../constants"
import { useTextMeasurement } from "../hooks/useTextMeasurement"

interface SingleGlowProps {
	lineId: string
	lineText: string
	glow: { start: number; end: number }
	color: string
	codeBlockRef: React.RefObject<HTMLPreElement | null>
}

/**
 * Individual glow rendered as an SVG rect with blur filter.
 * Measures text position and animates into place with a soft glow effect.
 */
export const SingleGlow = React.memo(function SingleGlow({
	lineId,
	lineText,
	glow,
	color,
	codeBlockRef,
}: SingleGlowProps) {
	const { measurement, hasInitialized } = useTextMeasurement({
		lineId,
		lineText,
		start: glow.start,
		end: glow.end,
		codeBlockRef,
	})

	// Don't render until we have a valid measurement
	if (!hasInitialized || !measurement || measurement.textWidth === 0) {
		return null
	}

	// Apply glow-specific padding
	const position = {
		top: measurement.lineTop - GLOW_VERTICAL_PADDING,
		left: measurement.lineLeft + measurement.textOffsetX,
		width: measurement.textWidth,
		height: measurement.lineHeight + GLOW_VERTICAL_PADDING * 2,
	}

	// Center point for scale animation
	const centerX = position.left + position.width / 2
	const centerY = position.top + position.height / 2

	return (
		<motion.rect
			initial={{
				opacity: GLOW_INITIAL_OPACITY,
				x: centerX,
				y: centerY,
				width: 0,
				height: 0,
			}}
			animate={{
				opacity: GLOW_ANIMATE_OPACITY,
				x: position.left,
				y: position.top,
				width: position.width,
				height: position.height,
			}}
			exit={{
				opacity: GLOW_EXIT_OPACITY,
				x: centerX,
				y: centerY,
				width: 0,
				height: 0,
			}}
			fill={color}
			filter={`blur(${GLOW_BLUR_RADIUS}px)`}
			rx={4}
			ry={4}
			transition={{
				opacity: GLOW_OPACITY_TRANSITION,
				x: GLOW_TRANSITION,
				y: GLOW_TRANSITION,
				width: GLOW_TRANSITION,
				height: GLOW_TRANSITION,
			}}
		/>
	)
})
