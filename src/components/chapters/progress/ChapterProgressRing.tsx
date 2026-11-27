/**
 * Circular progress ring for chapter completion.
 * Uses emerald colors to match the group header completion indicators.
 */

import { motion } from "motion/react"

// Colors from CSS variables (see styles.css)
const EMERALD_REST = "var(--color-success)"
const EMERALD_FULL = "var(--color-success-bright)"
const BG_RING = "rgba(255, 255, 255, 0.2)"

interface ChapterProgressRingProps {
	/** Number of completed sections */
	completed: number
	/** Total number of sections */
	total: number
	/** Size in pixels (default 18) */
	size?: number
}

export function ChapterProgressRing({ completed, total, size = 18 }: ChapterProgressRingProps) {
	const percent = total > 0 ? (completed / total) * 100 : 0
	const isComplete = completed >= total
	const strokeWidth = 2
	const radius = (size - strokeWidth) / 2
	const circumference = 2 * Math.PI * radius
	const dashOffset = circumference - (circumference * percent) / 100

	// Use brighter emerald when fully complete
	const strokeColor = isComplete ? EMERALD_FULL : EMERALD_REST

	return (
		<div className="relative" style={{ width: size, height: size }}>
			{/* Background circle */}
			<svg width={size} height={size} className="absolute inset-0">
				<circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={BG_RING} strokeWidth={strokeWidth} />
			</svg>
			{/* Progress circle */}
			<svg width={size} height={size} className="absolute inset-0" style={{ transform: "rotate(-90deg)" }}>
				<motion.circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke={strokeColor}
					strokeWidth={strokeWidth}
					strokeLinecap="square"
					strokeDasharray={circumference}
					initial={false}
					animate={{ strokeDashoffset: dashOffset }}
					transition={{ type: "spring", stiffness: 100, damping: 20 }}
				/>
			</svg>
		</div>
	)
}
