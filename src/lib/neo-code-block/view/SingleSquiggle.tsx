"use client"

import { motion } from "motion/react"
import React from "react"
import { springConfigs } from "@/utils/animationConfigs"
import { useTextMeasurement } from "../hooks/useTextMeasurement"

interface SingleSquiggleProps {
	lineId: string
	lineText: string
	squiggle: { start: number; end: number }
	color: string
	codeBlockRef: React.RefObject<HTMLPreElement | null>
}

// Squiggle wave parameters
const WAVE_HEIGHT = 2
const WAVE_LENGTH = 8
const SQUIGGLE_OFFSET_Y = -4 // Nudge up to sit closer to text baseline

/**
 * Generate a wavy SVG path for the squiggle underline.
 * Creates a smooth sine wave pattern.
 */
function generateSquigglePath(width: number): string {
	if (width <= 0) return ""

	const points: string[] = [`M0,${WAVE_HEIGHT}`]
	let x = 0

	while (x < width) {
		const nextX = Math.min(x + WAVE_LENGTH / 2, width)
		const cpX = x + WAVE_LENGTH / 4
		const cpY = x % WAVE_LENGTH === 0 ? 0 : WAVE_HEIGHT * 2
		const endY = x % WAVE_LENGTH === 0 ? WAVE_HEIGHT * 2 : 0

		points.push(`Q${cpX},${cpY} ${nextX},${endY === 0 ? WAVE_HEIGHT : WAVE_HEIGHT}`)
		x = nextX
	}

	return points.join(" ")
}

/**
 * Wavy underline annotation (like IDE error squiggles).
 * Measures text position and renders an animated wavy line underneath.
 */
export const SingleSquiggle = React.memo(function SingleSquiggle({
	lineId,
	lineText,
	squiggle,
	color,
	codeBlockRef,
}: SingleSquiggleProps) {
	const { measurement, hasInitialized } = useTextMeasurement({
		lineId,
		lineText,
		start: squiggle.start,
		end: squiggle.end,
		codeBlockRef,
	})

	// Don't render until we have a valid measurement
	if (!hasInitialized || !measurement || measurement.textWidth === 0) {
		return null
	}

	// Apply squiggle-specific positioning (below text baseline)
	const position = {
		top: measurement.lineTop + measurement.lineHeight + SQUIGGLE_OFFSET_Y,
		left: measurement.lineLeft + measurement.textOffsetX,
		width: measurement.textWidth,
		height: WAVE_HEIGHT * 2 + 2,
	}

	const path = generateSquigglePath(position.width)

	return (
		<motion.path
			d={path}
			fill="none"
			stroke={color}
			strokeWidth={1.5}
			strokeLinecap="round"
			initial={{
				x: position.left,
				y: position.top,
				opacity: 0,
				filter: "blur(4px)",
			}}
			animate={{
				x: position.left,
				y: position.top,
				opacity: 1,
				filter: "blur(0px)",
			}}
			exit={{
				opacity: 0,
				// Exit fast: the text underneath may be moving or changing width,
				// and a lingering squiggle reads as detached.
				transition: { duration: 0.1, ease: "easeOut" },
			}}
			transition={{
				x: springConfigs.default,
				y: springConfigs.default,
				opacity: springConfigs.fast,
				filter: springConfigs.fast,
			}}
		/>
	)
})
