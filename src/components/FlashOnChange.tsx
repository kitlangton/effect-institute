import { animate } from "motion"
import { type MotionStyle, motion } from "motion/react"
import { useEffect, useRef, useState } from "react"

export interface FlashOnChangeProps {
	triggerKey: string
	children: React.ReactNode
	className?: string
	style?: MotionStyle
	flashOpacity?: number // Peak overlay opacity
	flashMs?: number // Time to reach peak
	fadeMs?: number // Fade-out duration
}

export function FlashOnChange({
	triggerKey,
	children,
	className = "",
	style,
	flashOpacity = 0.05,
	flashMs = 50,
	fadeMs = 1500,
}: FlashOnChangeProps) {
	const overlayRef = useRef<HTMLDivElement>(null)
	const prevKeyRef = useRef(triggerKey)
	const [flashCounter, setFlashCounter] = useState(0)

	useEffect(() => {
		if (prevKeyRef.current !== triggerKey) {
			prevKeyRef.current = triggerKey
			setFlashCounter((c) => c + 1)
		}
	}, [triggerKey])

	useEffect(() => {
		if (flashCounter === 0) return

		const overlay = overlayRef.current
		if (!overlay) return

		const totalMs = flashMs + fadeMs
		const duration = totalMs / 1000
		const flashPortion = flashMs / totalMs

		// Direct animation using motion.animate - no DOM query needed
		const controls = animate(
			overlay,
			{ opacity: [0, flashOpacity, 0] },
			{
				duration,
				times: [0, flashPortion, 1],
				ease: "linear",
			},
		)

		return () => controls.stop()
	}, [flashCounter, flashOpacity, flashMs, fadeMs])

	return (
		<motion.div className={`relative ${className}`} {...(style && { style })}>
			{children}
			<div
				ref={overlayRef}
				className="pointer-events-none absolute inset-0"
				style={{
					opacity: 0,
					backgroundColor: "rgba(255,255,255,1)",
					borderRadius: "inherit",
					willChange: "opacity",
					backfaceVisibility: "hidden",
					transform: "translateZ(0)",
				}}
			/>
		</motion.div>
	)
}
