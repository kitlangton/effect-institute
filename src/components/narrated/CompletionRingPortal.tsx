/**
 * Portal that renders expanding completion rings.
 * Positioned at document level to avoid clipping from masks/overflow.
 */
import { useAtomValue } from "@effect/atom-react"
import { motion } from "motion/react"
import { createPortal } from "react-dom"
import { completionRingsAtom, type RingAnimation } from "@/atoms/completionRings"

// Animation specs (matching KeyboardDiagram)
const RING = {
	color: "var(--color-success-bright)",
	startRadius: 4,
	endRadius: 40,
	strokeWidth: 1,
	radiusDuration: 2,
	opacityDuration: 2.5,
	radiusEase: [0.2, 0.9, 0.3, 1] as const,
	opacityEase: [0.4, 0, 0.2, 1] as const,
}

// Background glow specs
const GLOW = {
	size: 60, // Size of the glow
	color: "rgba(52, 211, 153, 0.15)", // Subtle emerald glow
	fadeDuration: 2.2,
	fadeEase: [0.4, 0, 0.2, 1] as const,
}

function ExpandingRing({ x, y }: { x: number; y: number }) {
	// Container size must accommodate the expanded ring
	const size = RING.endRadius * 2 + 4

	return (
		<>
			{/* Background glow - subtle, fades slowly */}
			<motion.div
				className="pointer-events-none fixed rounded-full"
				style={{
					left: x - GLOW.size / 2,
					top: y - GLOW.size / 2,
					width: GLOW.size,
					height: GLOW.size,
					background: `radial-gradient(circle, ${GLOW.color} 0%, transparent 60%)`,
				}}
				initial={{ opacity: 1 }}
				animate={{ opacity: 0 }}
				transition={{
					duration: GLOW.fadeDuration,
					ease: GLOW.fadeEase,
				}}
			/>
			{/* Expanding ring */}
			<div
				className="pointer-events-none fixed"
				style={{
					left: x - size / 2,
					top: y - size / 2,
					width: size,
					height: size,
				}}
			>
				<svg viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible", width: size, height: size }}>
					<motion.circle
						cx={size / 2}
						cy={size / 2}
						fill="none"
						stroke={RING.color}
						strokeWidth={RING.strokeWidth}
						initial={{ r: RING.startRadius, opacity: 0.6 }}
						animate={{ r: RING.endRadius, opacity: 0 }}
						transition={{
							r: { duration: RING.radiusDuration, ease: RING.radiusEase },
							opacity: {
								duration: RING.opacityDuration,
								ease: RING.opacityEase,
							},
						}}
					/>
				</svg>
			</div>
		</>
	)
}

export function CompletionRingPortal() {
	const rings = useAtomValue(completionRingsAtom)

	if (rings.length === 0) return null

	return createPortal(
		<div className="pointer-events-none fixed inset-0 z-[9999]">
			{rings.map((ring: RingAnimation) => (
				<ExpandingRing key={ring.id} x={ring.x} y={ring.y} />
			))}
		</div>,
		document.body,
	)
}
