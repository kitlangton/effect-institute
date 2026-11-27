import { useAtomValue } from "@effect/atom-react"
import { motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { glowingSectionsAtom } from "@/atoms/completionEffects"
import { sectionsAtom } from "@/atoms/narration"

// =============================================================================
// GroupProgressSquares - Subtle progress indicator dots
// =============================================================================
//
// STATE-DRIVEN: Just reads glowingSectionsAtom and renders.
// No event processing, no refs for deduplication, no timeouts.
// The controller handles all the logic.
// =============================================================================

// Emerald colors from CSS variables (see styles.css)
const EMERALD_GLOW = "var(--color-success-bright)"
const EMERALD_CURRENT = "var(--color-success-mid)"
const EMERALD_REST = "var(--color-success)"
// Background colors for incomplete sections
const BG_INACTIVE = "rgba(255, 255, 255, 0.12)"
const BG_CURRENT = "rgba(255, 255, 255, 0.22)"

export function GroupProgressSquares({
	firstIndex,
	lastIndex,
	completedSections,
	currentIndex,
}: {
	firstIndex: number
	lastIndex: number
	completedSections: Set<number>
	currentIndex?: number | undefined
}) {
	const indices = Array.from({ length: lastIndex - firstIndex + 1 }, (_, i) => firstIndex + i)

	// Read glow state from atom - controller manages this
	const glowingSections = useAtomValue(glowingSectionsAtom)
	// Read sections to get IDs for each index
	const sections = useAtomValue(sectionsAtom)

	// Gentle spring for all transitions
	const gentleSpring = {
		type: "spring" as const,
		visualDuration: 0.6,
		bounce: 0.05,
	}

	return (
		<div className="flex items-center gap-1.5">
			{indices.map((index) => {
				const section = sections[index]
				const sectionId = section?.id
				const isCompleted = completedSections.has(index)
				const isCurrent = currentIndex === index
				const isGlowing = sectionId ? glowingSections.has(sectionId) : false

				// State: glowing (bright + shadow), current (medium), resting (dimmer), or incomplete
				const bgColor = isCompleted
					? isGlowing
						? EMERALD_GLOW
						: isCurrent
							? EMERALD_CURRENT
							: EMERALD_REST
					: isCurrent
						? BG_CURRENT
						: BG_INACTIVE

				return (
					<motion.div
						key={index}
						// Data attribute for CompletionRingTrigger to find this element
						data-section-square={sectionId}
						initial={false}
						animate={{
							backgroundColor: bgColor,
							boxShadow: isGlowing ? "0 0 6px 1px rgba(52, 211, 153, 0.45)" : "0 0 0px 0px rgba(52, 211, 153, 0)",
						}}
						transition={{
							...gentleSpring,
							backgroundColor: isCompleted ? gentleSpring : { type: "spring", visualDuration: 0.15, bounce: 0 },
							boxShadow: {
								type: "spring",
								visualDuration: isGlowing ? 0.4 : 1.0,
								bounce: 0,
							},
						}}
						style={{
							width: 6,
							height: 6,
							borderRadius: 0,
						}}
					/>
				)
			})}
		</div>
	)
}

// =============================================================================
// RollingGroupHeader - Unified rolling header with title and progress dots
// =============================================================================

interface GroupData {
	title: string
	firstIndex: number
	lastIndex: number
}

export function RollingGroupHeader({
	title,
	firstIndex,
	lastIndex,
	completedSections,
	currentIndex,
	lineHeight,
}: {
	title: string
	firstIndex: number
	lastIndex: number
	completedSections: Set<number>
	currentIndex?: number | undefined
	lineHeight: number
}) {
	// Track displayed state and pending props separately to handle rapid changes
	const [displayed, setDisplayed] = useState<GroupData>({
		title,
		firstIndex,
		lastIndex,
	})
	const [exiting, setExiting] = useState<GroupData | null>(null)
	const [direction, setDirection] = useState<1 | -1>(1)
	const idRef = useRef(0)

	// Track the latest props to handle race conditions
	const latestProps = useRef<GroupData>({ title, firstIndex, lastIndex })
	latestProps.current = { title, firstIndex, lastIndex }

	// Check if props differ from what's currently displayed
	const propsChanged =
		title !== displayed.title || firstIndex !== displayed.firstIndex || lastIndex !== displayed.lastIndex

	// Start animation when props change and we're not already animating
	useEffect(() => {
		if (propsChanged && !exiting) {
			// Determine direction based on index change
			const newDirection = firstIndex > displayed.firstIndex ? 1 : -1
			setDirection(newDirection)
			setExiting(displayed)
			setDisplayed({ title, firstIndex, lastIndex })
			idRef.current++
		}
	}, [title, firstIndex, lastIndex, displayed, exiting, propsChanged])

	const handleAnimationComplete = () => {
		setExiting(null)

		// Check if props changed during animation - if so, trigger another animation
		const latest = latestProps.current
		if (
			latest.title !== displayed.title ||
			latest.firstIndex !== displayed.firstIndex ||
			latest.lastIndex !== displayed.lastIndex
		) {
			// Props changed during animation, update immediately
			const newDirection = latest.firstIndex > displayed.firstIndex ? 1 : -1
			setDirection(newDirection)
			setExiting(displayed)
			setDisplayed(latest)
			idRef.current++
		}
	}

	const springTransition = {
		type: "spring" as const,
		visualDuration: 0.35,
		bounce: 0.15,
	}

	const exitY = -direction * lineHeight
	const enterY = direction * lineHeight

	// Fade mask
	const fadeMask = `linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%)`

	return (
		<div
			className="flex-1"
			style={{
				display: "grid",
				height: lineHeight,
				WebkitMaskImage: fadeMask,
				maskImage: fadeMask,
			}}
		>
			{/* Exiting header content */}
			{exiting && (
				<motion.div
					key={`exit-${idRef.current}`}
					className="flex items-center justify-between w-full"
					style={{ gridArea: "1/1" }}
					initial={{ y: 0 }}
					animate={{ y: exitY }}
					transition={springTransition}
					onAnimationComplete={handleAnimationComplete}
				>
					<span className="flex items-center whitespace-nowrap">{exiting.title}</span>
					<GroupProgressSquares
						firstIndex={exiting.firstIndex}
						lastIndex={exiting.lastIndex}
						completedSections={completedSections}
						{...(currentIndex !== undefined ? { currentIndex } : {})}
					/>
				</motion.div>
			)}

			{/* Current/entering header content */}
			<motion.div
				key={`curr-${idRef.current}`}
				className="flex items-center justify-between w-full"
				style={{ gridArea: "1/1" }}
				initial={exiting ? { y: enterY } : false}
				animate={{ y: 0 }}
				transition={springTransition}
			>
				<span className="flex items-center whitespace-nowrap">{displayed.title}</span>
				<GroupProgressSquares
					firstIndex={displayed.firstIndex}
					lastIndex={displayed.lastIndex}
					completedSections={completedSections}
					{...(currentIndex !== undefined ? { currentIndex } : {})}
				/>
			</motion.div>
		</div>
	)
}
