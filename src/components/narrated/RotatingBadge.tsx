/**
 * Rotating "EFFECT INSTITUTE" badge with pulsing center animation.
 * Extracted to its own file to avoid loading KeyboardDiagram eagerly.
 */

import { ArrowRightIcon } from "@phosphor-icons/react"
import { motion } from "motion/react"

interface RotatingBadgeProps {
	activeWord: number
	/** Enable a traveling glow effect that cycles around the ring */
	flowingGlow?: boolean
}

export function RotatingBadge({ activeWord, flowingGlow = false }: RotatingBadgeProps) {
	const highlightEffect = activeWord === 3
	const highlightInstitute = activeWord === 4
	// Disable flowing glow if a specific word is being highlighted
	const showFlowingGlow = flowingGlow && activeWord < 0

	type Group = "effect" | "institute" | "other"
	type Element =
		| { type: "char"; char: string; group: Group; index: number }
		| { type: "icon"; group: Group; index: number }

	const buildElements = (): Element[] => {
		const pattern: Element[] = [
			...Array.from("EFFECT").map((c, i) => ({
				type: "char" as const,
				char: c,
				group: "effect" as const,
				index: i,
			})),
			{ type: "char" as const, char: " ", group: "other" as const, index: 0 },
			...Array.from("INSTITUTE").map((c, i) => ({
				type: "char" as const,
				char: c,
				group: "institute" as const,
				index: i,
			})),
			{ type: "char" as const, char: " ", group: "other" as const, index: 0 },
			{ type: "icon" as const, group: "other" as const, index: 0 },
			{ type: "char" as const, char: " ", group: "other" as const, index: 0 },
		]
		// Repeat pattern twice
		return [...pattern, ...pattern]
	}

	const elements = buildElements()
	const size = 240
	const fontSize = 18
	const radius = size / 2 - fontSize - 10

	// Flowing glow config - duration for one complete cycle around the ring
	const glowCycleDuration = 8

	return (
		<div className="relative flex items-center justify-center w-[240px] h-[240px] select-none">
			{/* Outer text ring - CSS rotation for perfect positioning */}
			<div
				className="absolute inset-0"
				style={{
					animation: "spin-badge 30s linear infinite",
				}}
			>
				<style>{`
					@keyframes spin-badge {
						from { transform: rotate(0deg); }
						to { transform: rotate(360deg); }
					}
					@keyframes badge-glow {
						0%, 100% {
							opacity: 0.4;
							text-shadow: 0 0 0px rgba(255,255,255,0);
						}
						50% {
							opacity: 1;
							text-shadow: 0 0 14px rgba(255,255,255,0.9);
						}
					}
				`}</style>
				{elements.map((el, i) => {
					const angle = (i / elements.length) * 360 - 90
					const isSpace = el.type === "char" && el.char === " "

					let color = "rgba(255,255,255,0.6)"
					let textShadow = "none"
					let isActive = false

					if (el.group === "effect") {
						if (highlightEffect) {
							color = "#ffffff"
							textShadow = "0 0 10px rgba(255,255,255,0.8)"
							isActive = true
						}
					} else if (el.group === "institute") {
						if (highlightInstitute) {
							color = "#ffffff"
							textShadow = "0 0 10px rgba(255,255,255,0.8)"
							isActive = true
						}
					} else if (el.group === "other") {
						if (el.type === "icon") color = "rgba(255,255,255,0.4)"
						if (isSpace) color = "transparent"
					}

					// Flowing glow: staggered animation creates traveling wave
					// Negative delay starts animation partway through, ensuring smooth wraparound
					const glowDelay = (i / elements.length - 1) * glowCycleDuration

					if (showFlowingGlow && !isSpace) {
						return (
							<span
								key={i}
								className="absolute font-bold uppercase text-white"
								style={{
									left: "50%",
									top: "50%",
									transform: `translate(-50%, -50%) rotate(${angle + 90}deg) translateY(-${radius}px)`,
									fontSize,
									animation: `badge-glow ${glowCycleDuration}s ease-in-out infinite`,
									animationDelay: `${glowDelay}s`,
								}}
							>
								{el.type === "char" ? el.char : <ArrowRightIcon size={14} weight="bold" />}
							</span>
						)
					}

					return (
						<motion.span
							key={i}
							className="absolute font-bold uppercase"
							initial={false}
							animate={{ color, textShadow }}
							transition={{
								duration: isActive ? 0.2 : 0.8,
								delay: isActive ? el.index * 0.05 : 0,
							}}
							style={{
								left: "50%",
								top: "50%",
								transform: `translate(-50%, -50%) rotate(${angle + 90}deg) translateY(-${radius}px)`,
								fontSize,
							}}
						>
							{el.type === "char" ? el.char : <ArrowRightIcon size={14} weight="bold" color={color} />}
						</motion.span>
					)
				})}
			</div>

			{/* Center Pulsing Animation */}
			<PulsingCircles />
		</div>
	)
}

function PulsingCircles() {
	const maxRadius = 85 // Fill up to just inside the text ring
	const rings = [0, 1, 2, 3]

	return (
		<svg viewBox="0 0 200 200" className="w-[180px] h-[180px]">
			{rings.map((i) => (
				<motion.circle
					key={i}
					cx="100"
					cy="100"
					fill="none"
					stroke="rgba(255,255,255,0.6)"
					strokeWidth="1"
					initial={{ r: 4, opacity: 0.8 }}
					animate={{
						r: maxRadius,
						opacity: 0,
					}}
					transition={{
						duration: 3,
						repeat: Infinity,
						delay: i * 0.75,
						ease: "easeOut",
					}}
				/>
			))}
			{/* Center dot */}
			<circle cx="100" cy="100" r="4" fill="rgba(255,255,255,0.8)" />
		</svg>
	)
}
