"use client"

import { HandPointingIcon, CursorIcon as PhCursorIcon, ThumbsDownIcon } from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"
import React from "react"
import type { CursorType } from "@/lib/animated-code/annotations"
import { CURSOR_OFFSET, CURSOR_SIZE, CURSOR_TRANSITION } from "../constants"
import { useTextMeasurement } from "../hooks/useTextMeasurement"

export interface CursorTarget {
	lineId: string
	lineText: string
	charOffset: number
	textLength: number
	type?: CursorType
}

interface CursorProps {
	target: CursorTarget | null
	codeBlockRef: React.RefObject<HTMLPreElement | null>
	containerHeight: number
	/** Speech bubble text shown below-right of the cursor */
	say?: string | undefined
}

const CURSOR_ICON_TRANSITION = {
	type: "spring" as const,
	visualDuration: 0.3,
	bounce: 0.2,
}

const SAY_TRANSITION = {
	type: "spring" as const,
	visualDuration: 0.4,
	bounce: 0.25,
}

/**
 * Chat bubble the cursor "speaks" through. Rounded rectangle with a squared
 * top-left corner pointing back up at the pointer.
 */
function SpeechBubble({ text }: { text: string }) {
	return (
		<motion.div
			key={text}
			className="absolute whitespace-nowrap rounded-xl rounded-tl-[3px] bg-white px-2.5 py-1 font-medium text-black"
			style={{
				left: CURSOR_SIZE * 0.8,
				top: CURSOR_SIZE * 0.95,
				fontSize: "0.7em",
				lineHeight: 1.6,
				transformOrigin: "top left",
				boxShadow: "0 4px 16px rgba(0, 0, 0, 0.45)",
			}}
			initial={{ opacity: 0, scale: 0.5, y: -4, filter: "blur(4px)" }}
			animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
			exit={{ opacity: 0, scale: 0.7, y: -2, filter: "blur(3px)", transition: { duration: 0.12, ease: "easeIn" } }}
			transition={SAY_TRANSITION}
		>
			{text}
		</motion.div>
	)
}

/**
 * SVG mouse pointer cursor that smoothly glides to positions.
 * Enters from off-screen, rests nearby when not targeting.
 */
export const Cursor = React.memo(function Cursor({ target, codeBlockRef, containerHeight, say }: CursorProps) {
	const lastTargetPos = React.useRef<{ x: number; y: number } | null>(null)

	const hasTarget = target !== null
	const { measurement, measuredRequest } = useTextMeasurement({
		lineId: target?.lineId ?? "",
		lineText: target?.lineText ?? "",
		start: target?.charOffset ?? 0,
		end: (target?.charOffset ?? 0) + (target?.textLength ?? 0),
		...(target?.lineId ? { measureLineId: target.lineId } : {}),
		enabled: hasTarget,
		codeBlockRef,
	})

	// The measurement hook retains the previous target's value until the
	// manager re-measures; only trust measurements taken for the CURRENT
	// target so the cursor never flashes at a stale position.
	const measurementIsCurrent =
		hasTarget &&
		measuredRequest !== null &&
		measuredRequest.lineId === target.lineId &&
		measuredRequest.start === target.charOffset &&
		measuredRequest.end === target.charOffset + target.textLength

	const [restPosition, setRestPosition] = React.useState<{
		x: number
		y: number
	} | null>(null)

	const targetPosition = React.useMemo(() => {
		if (!hasTarget || !measurement || !measurementIsCurrent) return null

		// Preserve previous positioning logic (no lineLeft offset).
		return {
			x: measurement.textOffsetX + measurement.textWidth / 2 - CURSOR_SIZE / 2,
			y: measurement.lineTop + measurement.lineHeight + CURSOR_OFFSET.y,
		}
	}, [hasTarget, measurement, measurementIsCurrent])

	React.useEffect(() => {
		if (targetPosition) {
			lastTargetPos.current = targetPosition
		}
	}, [targetPosition])

	React.useEffect(() => {
		if (hasTarget) return

		const codeBlock = codeBlockRef.current
		if (!codeBlock) return

		const blockRect = codeBlock.getBoundingClientRect()
		const baseX = lastTargetPos.current?.x ?? blockRect.width / 2
		const baseY = lastTargetPos.current?.y ?? containerHeight / 2
		setRestPosition({ x: baseX + 40, y: baseY + 30 })
	}, [hasTarget, containerHeight, codeBlockRef])

	// Remount on each fresh appearance (resting -> measured target) so the
	// entry animation starts just below-right of the target instead of
	// flying in from the old resting spot.
	const generationRef = React.useRef(0)
	const restingRef = React.useRef(true)
	if (hasTarget && targetPosition && restingRef.current) {
		generationRef.current += 1
		restingRef.current = false
	} else if (!hasTarget) {
		restingRef.current = true
	}

	const position = hasTarget
		? (targetPosition ?? lastTargetPos.current ?? restPosition)
		: (restPosition ?? lastTargetPos.current)
	if (!position) return null

	// A fresh appearance stays hidden until the new target's measurement
	// arrives (restingRef only clears on a measured position). Otherwise the
	// cursor renders visible at its stale last position for a frame or two
	// before jumping to the real target.
	const isResting = !hasTarget || restingRef.current
	const cursorType = target?.type ?? "hand"

	return (
		<motion.div
			key={generationRef.current}
			className="neo-cursor"
			style={{
				position: "absolute",
				pointerEvents: "none",
				zIndex: 20,
				width: CURSOR_SIZE,
				height: CURSOR_SIZE,
				willChange: "transform, opacity, filter",
				backfaceVisibility: "hidden",
			}}
			initial={{
				opacity: 0,
				scale: 0.7,
				x: position.x + 40,
				y: position.y + 30,
			}}
			animate={{
				opacity: isResting ? 0 : 1,
				scale: isResting ? 1.15 : 1,
				filter: isResting ? "blur(2px)" : "blur(0px)",
				x: position.x,
				y: position.y,
			}}
			transition={CURSOR_TRANSITION}
		>
			<AnimatePresence mode="popLayout">
				<motion.div
					key={cursorType}
					initial={{ opacity: 0, scale: 0.7, filter: "blur(4px)" }}
					animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
					exit={{ opacity: 0, scale: 0.7, filter: "blur(4px)" }}
					transition={CURSOR_ICON_TRANSITION}
				>
					{cursorType === "hand" ? (
						<HandPointingIcon size={CURSOR_SIZE} weight="fill" color="white" />
					) : cursorType === "thumbsDown" ? (
						<ThumbsDownIcon size={CURSOR_SIZE} weight="fill" color="white" />
					) : (
						<PhCursorIcon size={CURSOR_SIZE} weight="fill" color="white" />
					)}
				</motion.div>
			</AnimatePresence>

			{/* Speech bubble */}
			<AnimatePresence mode="popLayout">
				{say && !isResting ? <SpeechBubble key={say} text={say} /> : null}
			</AnimatePresence>
		</motion.div>
	)
})
