"use client"

import { AnimatePresence, motion } from "motion/react"
import React from "react"
import { type TextMeasurement, useTextMeasurement } from "../hooks/useTextMeasurement"
import { type FloatConfig, useFloatPhysics } from "./useFloatPhysics"

export interface BurstTarget {
	lineId: string
	charOffset: number
	textLength: number
	emoji: string[]
	count: number
}

/** Internal type that adds a unique ID for tracking */
interface ActiveBurst {
	id: string
	burst: BurstTarget
	lineText: string
}

interface BurstEffectProps {
	bursts: BurstTarget[]
	codeBlockRef: React.RefObject<HTMLPreElement | null>
	lineTexts: Map<string, string>
}

/**
 * Measures the anchor position for a burst above the target text.
 */
function useAnchorPosition(burst: BurstTarget, codeBlockRef: React.RefObject<HTMLPreElement | null>, lineText: string) {
	const [position, setPosition] = React.useState<{
		x: number
		y: number
	} | null>(null)
	const [capturing, setCapturing] = React.useState(true)

	const { measurement } = useTextMeasurement({
		lineId: burst.lineId,
		lineText,
		start: burst.charOffset,
		end: burst.charOffset + burst.textLength,
		enabled: capturing,
		codeBlockRef,
	})

	const measurementRef = React.useRef<TextMeasurement | null>(null)
	measurementRef.current = measurement

	const scheduledRef = React.useRef(false)

	React.useEffect(() => {
		// Reset when burst identity changes
		setPosition(null)
		setCapturing(true)
		scheduledRef.current = false
	}, [burst.lineId, burst.charOffset, burst.textLength, lineText])

	React.useEffect(() => {
		if (!capturing) return
		if (!measurement || scheduledRef.current) return

		const calc = (m: TextMeasurement) => ({
			x: m.lineLeft + m.textOffsetX + m.textWidth / 2,
			y: m.lineTop - 8,
		})

		setPosition(calc(measurement))
		scheduledRef.current = true

		const raf = requestAnimationFrame(() => {
			const next = measurementRef.current
			if (next) {
				setPosition(calc(next))
			}
			setCapturing(false)
		})

		return () => cancelAnimationFrame(raf)
	}, [capturing, measurement])

	return position
}

/**
 * Float physics configuration for emoji bursts.
 */
const FLOAT_CONFIG: FloatConfig = {
	duration: 2500,
	lift: 0.006,
	wobble: 0.015,
	damping: 0.992,
	initialVelocity: { vx: 0.3, vy: 0.3 },
}

/**
 * Single emoji burst with two-phase animation:
 * 1. Motion spring entrance (scale + opacity + slight rise)
 * 2. Physics-based float away (drift + wobble + fade)
 *
 * Calls onComplete when the float animation naturally ends.
 */
const SingleBurst = React.memo(function SingleBurst({
	burst,
	codeBlockRef,
	lineText,
	onComplete,
}: {
	burst: BurstTarget
	codeBlockRef: React.RefObject<HTMLPreElement | null>
	lineText: string
	onComplete: () => void
}) {
	const anchor = useAnchorPosition(burst, codeBlockRef, lineText)
	const emoji = burst.emoji[0]
	const { state: floatState, start: startFloat } = useFloatPhysics(FLOAT_CONFIG)
	const [phase, setPhase] = React.useState<"entering" | "floating" | "done">("entering")
	const wasFloatingRef = React.useRef(false)

	// When Motion entrance completes, hand off to physics
	const handleEntranceComplete = React.useCallback(() => {
		if (anchor) {
			setPhase("floating")
			startFloat(anchor.x, anchor.y)
		}
	}, [anchor, startFloat])

	// Detect when float animation completes (floatState goes from non-null to null)
	React.useEffect(() => {
		if (phase === "floating") {
			if (floatState) {
				wasFloatingRef.current = true
			} else if (wasFloatingRef.current) {
				// Float animation completed naturally
				setPhase("done")
				onComplete()
			}
		}
	}, [phase, floatState, onComplete])

	if (!anchor || phase === "done") return null

	// During floating phase, render with physics state
	if (phase === "floating" && floatState) {
		return (
			<div
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					fontSize: "20px",
					pointerEvents: "none",
					zIndex: 30,
					transform: `translate(${floatState.x}px, ${floatState.y}px) translate(-50%, -50%)`,
					opacity: floatState.opacity,
					willChange: "transform, opacity",
				}}
			>
				{emoji}
			</div>
		)
	}

	// Entrance phase: Motion spring
	if (phase === "entering") {
		return (
			<motion.div
				initial={{
					x: anchor.x,
					y: anchor.y + 8,
					scale: 0,
					opacity: 0,
				}}
				animate={{
					x: anchor.x,
					y: anchor.y,
					scale: 1,
					opacity: 1,
				}}
				transition={{
					type: "spring",
					visualDuration: 0.4,
					bounce: 0.2,
				}}
				onAnimationComplete={handleEntranceComplete}
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					fontSize: "20px",
					pointerEvents: "none",
					zIndex: 30,
					translateX: "-50%",
					translateY: "-50%",
				}}
			>
				{emoji}
			</motion.div>
		)
	}

	return null
})

/**
 * Create a fingerprint for a burst to detect duplicates.
 * Uses lineId + charOffset + textLength + emoji as the identity.
 */
function burstFingerprint(burst: BurstTarget): string {
	return `${burst.lineId}:${burst.charOffset}:${burst.textLength}:${burst.emoji.join(",")}`
}

/**
 * Container for all burst effects.
 * Maintains an internal accumulator so particles persist across snapshot changes.
 */
export const BurstEffect = React.memo(function BurstEffect({ bursts, codeBlockRef, lineTexts }: BurstEffectProps) {
	// Track active bursts independently of snapshot prop
	const [activeBursts, setActiveBursts] = React.useState<ActiveBurst[]>([])

	// Track the previous bursts to detect "rising edge" (newly appeared bursts)
	const prevBurstsRef = React.useRef<Set<string>>(new Set())

	// Detect new bursts in props and add them to the accumulator
	React.useEffect(() => {
		const currentFingerprints = new Set(bursts.map(burstFingerprint))
		const newBursts: ActiveBurst[] = []

		for (let idx = 0; idx < bursts.length; idx++) {
			const burst = bursts[idx]
			const fingerprint = burstFingerprint(burst)

			// Only spawn if this burst wasn't in the previous snapshot (rising edge)
			if (!prevBurstsRef.current.has(fingerprint)) {
				const lineText = lineTexts.get(burst.lineId) ?? ""
				newBursts.push({
					id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
					burst,
					lineText,
				})
			}
		}

		// Update ref to current state for next comparison
		prevBurstsRef.current = currentFingerprints

		if (newBursts.length > 0) {
			setActiveBursts((prev) => [...prev, ...newBursts])
		}
	}, [bursts, lineTexts])

	// Remove a burst when its animation completes
	const handleComplete = React.useCallback((id: string) => {
		setActiveBursts((prev) => prev.filter((b) => b.id !== id))
	}, [])

	// Always render the container, even if empty (so it's ready for new bursts)
	return (
		<AnimatePresence>
			{activeBursts.map((active) => (
				<SingleBurst
					key={active.id}
					burst={active.burst}
					codeBlockRef={codeBlockRef}
					lineText={active.lineText}
					onComplete={() => handleComplete(active.id)}
				/>
			))}
		</AnimatePresence>
	)
})
