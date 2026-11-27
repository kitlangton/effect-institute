import { motion } from "motion/react"
import type { ReactNode } from "react"

export const spring = {
	type: "spring" as const,
	visualDuration: 0.3,
	bounce: 0.2,
}

export const keySize = 52
export const shadowHeight = 6
export const keyGap = 4

interface KeyProps {
	pressed: boolean
	children: ReactNode
	width?: number
	size?: "sm" | "md" | "lg"
	className?: string
}

export function Key({ pressed, children, width, size = "md", className }: KeyProps) {
	const w = width ?? keySize
	const h = keySize
	const totalHeight = h + shadowHeight
	const strokeWidth = 1.5

	// Font size based on size prop
	const fontSize = width ? 15 : size === "lg" ? 24 : size === "sm" ? 14 : 18

	return (
		<div className={`relative ${className || ""}`} style={{ width: w, height: totalHeight }}>
			<svg viewBox={`0 0 ${w} ${totalHeight}`} width={w} height={totalHeight} className="absolute inset-0">
				{/* Side/Shadow - fixed at bottom */}
				<motion.rect
					x={strokeWidth / 2}
					y={h - shadowHeight}
					width={w - strokeWidth}
					height={shadowHeight * 2}
					fill="#1a1a1a"
					strokeWidth={strokeWidth}
					animate={{
						stroke: pressed ? "#666666" : "var(--border-active)",
					}}
					transition={spring}
				/>

				{/* Key cap - moves down when pressed */}
				<motion.rect
					x={strokeWidth / 2}
					width={w - strokeWidth}
					height={h - strokeWidth}
					strokeWidth={strokeWidth}
					animate={{
						y: pressed ? shadowHeight + strokeWidth / 2 : strokeWidth / 2,
						fill: pressed ? "#141414" : "#000000",
						stroke: pressed ? "#666666" : "var(--border-active)",
					}}
					transition={spring}
				/>
			</svg>

			{/* Text label - positioned over SVG */}
			<motion.div
				className="absolute inset-0 flex items-center justify-center pointer-events-none"
				style={{
					fontSize,
					height: h,
				}}
				animate={{
					y: pressed ? shadowHeight : 0,
					color: pressed ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.6)",
				}}
				transition={spring}
			>
				{children}
			</motion.div>
		</div>
	)
}
