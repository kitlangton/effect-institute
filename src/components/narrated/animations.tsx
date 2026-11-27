import { motion } from "motion/react"
import { spring } from "./Key"

// =============================================================================
// Animation Configuration
// =============================================================================

export const HEIGHT_ANIM = {
	enter: {
		height: spring,
		opacity: { duration: 0.25 },
	},
	exit: {
		height: { ...spring, visualDuration: 0.5 },
		opacity: { duration: 0.2 },
	},
}

// =============================================================================
// Stage Wrapper - shared height/opacity animation for enter/exit
// =============================================================================

interface StageWrapperProps {
	children: React.ReactNode
	className?: string
	/** Allow content to overflow (e.g., for shadows, tooltips) */
	overflow?: "hidden" | "visible"
	/** Add blur effect on enter/exit */
	blur?: boolean
	/** Inner padding class (default: "py-4") */
	padding?: string
}

export function StageWrapper({
	children,
	className = "",
	overflow = "hidden",
	blur = false,
	padding = "",
}: StageWrapperProps) {
	return (
		<motion.div
			initial={{ height: 0, opacity: 0, ...(blur && { filter: "blur(6px)" }) }}
			animate={{
				height: "auto",
				opacity: 1,
				...(blur && { filter: "blur(0px)" }),
				transition: HEIGHT_ANIM.enter,
			}}
			exit={{
				height: 0,
				opacity: 0,
				...(blur && { filter: "blur(6px)" }),
				transition: HEIGHT_ANIM.exit,
			}}
			style={{ overflow }}
		>
			<div className={`${padding} ${className}`}>{children}</div>
		</motion.div>
	)
}
