import { useAtom } from "@effect/atom-react"
import { motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { clearNotification, NOTIFICATION_DURATION, type Notification, notificationAtom } from "@/atoms/notification"

/**
 * Rolling notification display.
 * Messages roll in from below, stay for a duration, then roll out.
 * If a new message arrives while one is showing, they swap with a rolling animation.
 */
export function RollingNotification({ height = 48 }: { height?: number }) {
	const [notification, setNotification] = useAtom(notificationAtom)
	const [displayed, setDisplayed] = useState<Notification | null>(null)
	const [exiting, setExiting] = useState<Notification | null>(null)
	const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	// Handle notification changes
	useEffect(() => {
		if (notification === null && displayed === null) {
			// Nothing to show
			return
		}

		if (notification === null && displayed !== null) {
			// Notification cleared - animate out
			setExiting(displayed)
			setDisplayed(null)
			return
		}

		if (notification !== null && displayed === null) {
			// New notification, nothing displayed - animate in
			setDisplayed(notification)
			return
		}

		if (notification !== null && displayed !== null && notification.id !== displayed.id) {
			// New notification replacing existing - swap with animation
			setExiting(displayed)
			setDisplayed(notification)
		}
	}, [notification, displayed])

	// Auto-dismiss after duration
	useEffect(() => {
		if (displayed === null) return

		// Clear any pending timeout
		if (dismissTimeoutRef.current) {
			clearTimeout(dismissTimeoutRef.current)
		}

		// Schedule dismiss
		dismissTimeoutRef.current = setTimeout(() => {
			setNotification(clearNotification)
		}, NOTIFICATION_DURATION)

		return () => {
			if (dismissTimeoutRef.current) {
				clearTimeout(dismissTimeoutRef.current)
			}
		}
	}, [displayed, setNotification])

	const handleExitComplete = () => {
		setExiting(null)
	}

	// Don't render anything if nothing to show
	if (!displayed && !exiting) {
		return null
	}

	const springTransition = {
		type: "spring" as const,
		visualDuration: 0.3,
		bounce: 0.1,
	}

	// Fade mask for smooth edges
	const fadeMask = `linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)`

	return (
		<div
			className="flex items-center overflow-hidden"
			style={{
				height,
				WebkitMaskImage: fadeMask,
				maskImage: fadeMask,
			}}
		>
			<div className="relative" style={{ display: "grid" }}>
				{/* Exiting notification */}
				{exiting && (
					<motion.div
						key={`exit-${exiting.id}`}
						className="flex items-center text-xs text-white/60 whitespace-nowrap px-4"
						style={{ gridArea: "1/1", height }}
						initial={{ y: 0, opacity: 1 }}
						animate={{ y: -height, opacity: 0 }}
						transition={springTransition}
						onAnimationComplete={handleExitComplete}
					>
						{exiting.message}
					</motion.div>
				)}

				{/* Current notification */}
				{displayed && (
					<motion.div
						key={`curr-${displayed.id}`}
						className="flex items-center text-xs text-white/60 whitespace-nowrap px-4"
						style={{ gridArea: "1/1", height }}
						initial={{ y: height, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						transition={springTransition}
					>
						{displayed.message}
					</motion.div>
				)}
			</div>
		</div>
	)
}
