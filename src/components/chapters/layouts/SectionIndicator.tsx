import NumberFlow from "@number-flow/react"
import { ArrowCounterClockwiseIcon, ArrowDownIcon, ArrowUpIcon } from "@phosphor-icons/react"
import { AnimatePresence, animate, motion } from "motion/react"
import React, { useCallback, useEffect, useMemo, useRef } from "react"
import { NavIconButton } from "@/components/chapters/NavIconButton"
import { useClickSound } from "@/hooks/useClickSound"
import { useMeasure } from "../../../hooks/useMeasure"
import { NAV_BAR_HEIGHT } from "../constants"
import { useCursorTooltip, useCursorTooltipWhen } from "../cursor/useCursorTooltip"

interface SectionIndicatorProps {
	activeIndex: number
	totalSections: number
	isPlaying: boolean
	isUnavailable?: boolean
	restartTrigger?: number
	onPlayPause: () => void
	onRestart: () => void
	onPrev: () => void
	onNext: () => void
}

export const SectionIndicator = React.memo(function SectionIndicator({
	activeIndex,
	totalSections,
	isPlaying,
	isUnavailable = false,
	restartTrigger = 0,
	onPlayPause,
	onRestart,
	onPrev,
	onNext,
}: SectionIndicatorProps) {
	const hasPrev = activeIndex > 0
	const hasNext = activeIndex < totalSections - 1
	const playClick = useClickSound()

	// Measure number width for smooth animation
	const [numberMeasureRef, { width: numberWidth }] = useMeasure<HTMLSpanElement>()

	// Flash animation for buttons
	const playRef = useRef<HTMLDivElement>(null)
	const restartRef = useRef<HTMLDivElement>(null)
	const prevRef = useRef<HTMLDivElement>(null)
	const nextRef = useRef<HTMLDivElement>(null)
	const prevIndexRef = useRef(activeIndex)
	const prevIsPlayingRef = useRef(isPlaying)

	// Helper to flash a button (useCallback for stable identity)
	const flashButton = useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
		if (!ref.current) return
		animate(ref.current, { color: "#ffffff" }, { duration: 0.05 }).then(() => {
			if (!ref.current) return
			animate(ref.current, { color: "rgba(255,255,255,0.6)" }, { duration: 0.3 })
		})
	}, [])

	// Helper to spin the restart icon counterclockwise (useCallback for stable identity)
	const spinRestart = useCallback(() => {
		if (!restartRef.current) return
		animate(restartRef.current, { rotate: [0, -360] }, { type: "spring", visualDuration: 0.5, bounce: 0.4 })
	}, [])

	const clickAnd = useCallback(
		(action?: () => void) => {
			playClick()
			action?.()
		},
		[playClick],
	)

	const handleRestart = useCallback(() => {
		if (isUnavailable) return
		flashButton(restartRef)
		spinRestart()
		clickAnd(onRestart)
	}, [isUnavailable, flashButton, spinRestart, clickAnd, onRestart])

	const handlePlayPause = useCallback(() => {
		if (isUnavailable) return
		clickAnd(onPlayPause)
	}, [isUnavailable, clickAnd, onPlayPause])

	const handlePrev = useCallback(() => {
		if (!hasPrev) return
		clickAnd(onPrev)
	}, [hasPrev, clickAnd, onPrev])

	const handleNext = useCallback(() => {
		if (!hasNext) return
		clickAnd(onNext)
	}, [hasNext, clickAnd, onNext])

	// Flash on any navigation (click or keyboard)
	useEffect(() => {
		const prevIndex = prevIndexRef.current
		if (activeIndex < prevIndex) {
			// Navigated up - flash prev button
			flashButton(prevRef)
		} else if (activeIndex > prevIndex) {
			// Navigated down - flash next button
			flashButton(nextRef)
		}
		prevIndexRef.current = activeIndex
	}, [activeIndex, flashButton])

	// Flash on play/pause toggle
	useEffect(() => {
		if (isPlaying !== prevIsPlayingRef.current) {
			flashButton(playRef)
			prevIsPlayingRef.current = isPlaying
		}
	}, [isPlaying, flashButton])

	// Flash and spin on restart trigger (from hotkey)
	const prevRestartTriggerRef = useRef(restartTrigger)
	useEffect(() => {
		if (restartTrigger !== prevRestartTriggerRef.current) {
			flashButton(restartRef)
			spinRestart()
			prevRestartTriggerRef.current = restartTrigger
		}
	}, [restartTrigger, flashButton, spinRestart])

	// Tooltip content (memoized to avoid hook dependency issues)
	const restartTooltip = useCursorTooltip(useMemo(() => ({ label: "Restart", shortcut: "R" }), []))
	const playPauseTooltip = useCursorTooltip(
		useMemo(() => ({ label: isPlaying ? "Pause" : "Play", shortcut: "Space" }), [isPlaying]),
	)
	const prevTooltip = useCursorTooltipWhen(
		useMemo(() => ({ label: "Previous", shortcut: "↑" }), []),
		!hasPrev,
	)
	const nextTooltip = useCursorTooltipWhen(
		useMemo(() => ({ label: "Next", shortcut: "↓" }), []),
		!hasNext,
	)

	return (
		<div
			className="absolute bottom-0 left-0 right-0 z-30 text-sm font-medium tracking-wide text-white/60 bg-black border-t border-[var(--border-subtle)] flex items-center justify-between"
			style={{ height: NAV_BAR_HEIGHT }}
		>
			{/* Restart and Play/Pause on the left */}
			<div className="flex items-center h-full">
				<NavIconButton
					onClick={handleRestart}
					disabled={isUnavailable}
					className="relative"
					offsetTop={1}
					aria-label="Restart section"
					{...restartTooltip}
				>
					<div ref={restartRef} style={{ color: "rgba(255,255,255,0.6)" }}>
						<ArrowCounterClockwiseIcon size={16} weight="bold" />
					</div>
				</NavIconButton>
				<NavIconButton
					onClick={handlePlayPause}
					disabled={isUnavailable}
					className="relative"
					offsetTop={1}
					aria-label={isPlaying ? "Pause" : "Play"}
					{...playPauseTooltip}
				>
					<div ref={playRef} style={{ color: "rgba(255,255,255,0.6)" }}>
						<AnimatePresence mode="popLayout" initial={false}>
							{isPlaying ? (
								<motion.div
									key="pause"
									className="flex items-center justify-center"
									initial={{ scale: 0, filter: "blur(10px)" }}
									animate={{ scale: 1, filter: "blur(0px)" }}
									exit={{ scale: 0, filter: "blur(10px)" }}
									transition={{ type: "spring", stiffness: 300, damping: 20 }}
								>
									<svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
										<rect x="1" y="1" width="3" height="10" rx="1" />
										<rect x="8" y="1" width="3" height="10" rx="1" />
									</svg>
								</motion.div>
							) : (
								<motion.div
									key="play"
									className="flex items-center justify-center"
									initial={{ scale: 0, filter: "blur(10px)" }}
									animate={{ scale: 1, filter: "blur(0px)" }}
									exit={{ scale: 0, filter: "blur(10px)" }}
									transition={{ type: "spring", stiffness: 300, damping: 20 }}
								>
									<svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
										<path d="M2.5 1.5v9l8-4.5-8-4.5z" />
									</svg>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</NavIconButton>
				{isUnavailable && <span className="px-2 text-xs text-amber-400">Audio unavailable</span>}
			</div>

			{/* Section counter + nav on the right */}
			<div className="flex items-center h-full">
				<NavIconButton
					onClick={handlePrev}
					disabled={!hasPrev}
					className={`relative disabled:cursor-not-allowed transition-opacity duration-150 ${hasPrev ? "opacity-100" : "opacity-30"}`}
					offsetTop={1}
					aria-label="Previous section"
					{...prevTooltip}
				>
					<div ref={prevRef} style={{ color: "rgba(255,255,255,0.6)" }}>
						<ArrowUpIcon size={16} weight="bold" />
					</div>
				</NavIconButton>
				<span className="tabular-nums px-1 inline-flex items-center">
					{/* Hidden element to measure width */}
					<span ref={numberMeasureRef} className="absolute opacity-0 pointer-events-none">
						{activeIndex + 1}
					</span>
					<motion.span
						animate={{ width: numberWidth || "auto" }}
						transition={{ type: "spring", visualDuration: 0.3, bounce: 0.0 }}
						className="inline-block"
					>
						<NumberFlow value={activeIndex + 1} />
					</motion.span>
					{"\u00A0/\u00A0"}
					{totalSections}
				</span>
				<NavIconButton
					onClick={handleNext}
					disabled={!hasNext}
					className={`relative disabled:cursor-not-allowed transition-opacity duration-150 ${hasNext ? "opacity-100" : "opacity-30"}`}
					offsetTop={1}
					aria-label="Next section"
					{...nextTooltip}
				>
					<div ref={nextRef} style={{ color: "rgba(255,255,255,0.6)" }}>
						<ArrowDownIcon size={16} weight="bold" />
					</div>
				</NavIconButton>
			</div>
		</div>
	)
})
