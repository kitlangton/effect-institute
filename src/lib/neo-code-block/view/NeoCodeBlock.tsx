"use client"

import { useAtomValue } from "@effect/atom-react"
import type { MotionStyle } from "motion/react"
import { AnimatePresence, motion } from "motion/react"
import React from "react"
import { responsiveSettingsAtom } from "@/atoms/responsiveSettings"
import { getGlowColor, getHighlightColor } from "../annotation-colors"
import {
	CONTAINER_TRANSITION,
	LINE_ANIMATE_BLUR,
	LINE_ANIMATE_OPACITY,
	LINE_DIMMED_OPACITY,
	LINE_INITIAL_BLUR,
	LINE_INITIAL_OPACITY,
	LINE_OPACITY_TRANSITION,
	LINE_TRANSITION,
} from "../constants"
import { NeoCodeMeasurementsProvider } from "../hooks/NeoCodeMeasurementsContext"
import { NeoCodeMeasurementsManager } from "../hooks/NeoCodeMeasurementsManager"
import type { AnnotationOverlay, FrameLine, NeoCodeBlockProps, SpotlightConfig, StatusConfig } from "../types"
import { useFrame } from "../useFrame"
import { BurstEffect } from "./BurstEffect"
import { Cursor } from "./Cursor"
import { LineParts } from "./LineParts"
import { MeasurementLine } from "./MeasurementLine"
import { SingleGlow } from "./SingleGlow"
import { SingleMark } from "./SingleMark"
import { SingleSquiggle } from "./SingleSquiggle"

/* ------------------------------------------------------------------ */
/* Line Pool                                                           */
/* ------------------------------------------------------------------ */

/**
 * A line that is not part of the current frame but stays mounted, frozen
 * at its last position, hidden via animation targets.
 */
interface PooledLine {
	line: FrameLine
	lineIndex: number
	y: number
}

/**
 * BULLETPROOF RENDERING: once a line has been rendered it never unmounts
 * (for the lifetime of one slideshow). Lines absent from the current frame
 * are kept mounted and animated to invisible at their last position. The
 * current frame only ever changes animation TARGETS, so any sequence of
 * rapid forward/backward steps converges to the correct visual state.
 * There is no exit/re-enter race that can leave a line stuck invisible.
 *
 * Returns the pooled lines that are NOT in the current frame.
 */
function useLinePool(dataKey: unknown, lines: readonly FrameLine[], lineHeight: number): PooledLine[] {
	const poolRef = React.useRef<{ dataKey: unknown; entries: Map<string, PooledLine> } | null>(null)
	if (poolRef.current === null || poolRef.current.dataKey !== dataKey) {
		poolRef.current = { dataKey, entries: new Map() }
	}
	const entries = poolRef.current.entries

	// Idempotent render-time update: remember every line's latest content
	// and position while it is on screen.
	lines.forEach((line, lineIndex) => {
		entries.set(line.lineId, { line, lineIndex, y: lineIndex * lineHeight })
	})

	const currentIds = new Set(lines.map((line) => line.lineId))
	return [...entries.values()].filter((entry) => !currentIds.has(entry.line.lineId))
}

/* ------------------------------------------------------------------ */
/* CodeLine                                                            */
/* ------------------------------------------------------------------ */

const LINE_BACKGROUND_CLASSES = {
	success: "bg-green-500/20",
	error: "bg-red-500/20",
	warning: "bg-yellow-500/20",
	info: "bg-blue-500/20",
} as const

interface CodeLineProps {
	line: FrameLine
	/** Index used for annotation lookups (last known index for hidden lines) */
	lineIndex: number
	/** Target translation from the top of the block */
	y: number
	lineHeight: number
	/** Hidden lines stay mounted and animate to invisible */
	visible: boolean
	/** Render the mount state instantly (the block's first paint) */
	mountStatic: boolean
	/** Transition window hint for will-change */
	isAnimating: boolean
	spotlight?: SpotlightConfig
	status?: StatusConfig
	brightRanges?: readonly AnnotationOverlay[]
	/** Render the hidden measurement replica (cursor target line) */
	withMeasurementLine?: boolean
}

/**
 * One permanently-mounted line. Position, opacity, and blur are pure
 * functions of the current frame; entry animates on mount (except during
 * the block's first paint).
 */
const CodeLine = React.memo(function CodeLine({
	line,
	lineIndex,
	y,
	lineHeight,
	visible,
	mountStatic,
	isAnimating,
	spotlight,
	status,
	brightRanges,
	withMeasurementLine = false,
}: CodeLineProps) {
	const backgroundClass = visible && line.background ? LINE_BACKGROUND_CLASSES[line.background] : undefined
	const opacity = visible ? (line.dimmed ? LINE_DIMMED_OPACITY : LINE_ANIMATE_OPACITY) : 0
	const isEmpty = line.parts.length === 0 || (line.parts.length === 1 && line.parts[0].tokens.length === 0)

	return (
		<motion.div
			className={`line rounded ${backgroundClass ? `${backgroundClass} pl-2 -ml-2 pr-2` : ""}`}
			data-line-container-id={line.lineId}
			style={{
				position: "absolute",
				left: 0,
				height: lineHeight,
				willChange: isAnimating ? "transform, opacity" : undefined,
				transform: "translateZ(0)",
				backfaceVisibility: "hidden",
				zIndex: visible ? 15 : 5,
				pointerEvents: visible ? undefined : "none",
			}}
			initial={mountStatic ? false : { y, opacity: LINE_INITIAL_OPACITY }}
			animate={{ y, opacity }}
			transition={{
				opacity: LINE_OPACITY_TRANSITION,
				y: LINE_TRANSITION,
			}}
		>
			<motion.div
				className="flex items-baseline w-full h-full"
				data-line-id={line.lineId}
				initial={mountStatic ? false : { filter: LINE_INITIAL_BLUR }}
				animate={{ filter: visible ? LINE_ANIMATE_BLUR : LINE_INITIAL_BLUR }}
				transition={{ filter: LINE_TRANSITION }}
				style={{
					willChange: isAnimating ? "filter" : undefined,
					transform: "translateZ(0)",
					backfaceVisibility: "hidden",
				}}
			>
				<LineParts
					line={line}
					lineIndex={lineIndex}
					{...(spotlight && { spotlight })}
					{...(status && { status })}
					{...(brightRanges && { brightRanges })}
				/>
				{isEmpty ? <span>&nbsp;</span> : null}
			</motion.div>
			{withMeasurementLine ? (
				<MeasurementLine
					line={line}
					lineIndex={lineIndex}
					{...(spotlight && { spotlight })}
					{...(status && { status })}
				/>
			) : null}
		</motion.div>
	)
})

/* ------------------------------------------------------------------ */
/* NeoCodeBlock                                                        */
/* ------------------------------------------------------------------ */

export function NeoCodeBlock({ data, snapshot, className, style }: NeoCodeBlockProps) {
	const managerRef = React.useRef<NeoCodeMeasurementsManager | null>(null)
	if (!managerRef.current) {
		managerRef.current = new NeoCodeMeasurementsManager()
	}
	const manager = managerRef.current

	const codeBlockRef = React.useRef<HTMLPreElement | null>(null)
	const setCodeBlockRef = React.useCallback(
		(el: HTMLPreElement | null) => {
			codeBlockRef.current = el
			manager.setCodeBlockElement(el)
		},
		[manager],
	)

	React.useEffect(() => {
		return () => manager.dispose()
	}, [manager])

	const { lineHeightPx: lineHeight } = useAtomValue(responsiveSettingsAtom)

	// Re-measure overlays during transitions triggered by snapshot changes.
	// Line springs (LINE_TRANSITION, visualDuration 0.45) can take well over a
	// second to fully settle; keep tracking long enough that overlays (cursor,
	// squiggle, marks) land on final positions instead of mid-flight ones. The
	// manager stops early once measurements hold stable, so the long window is
	// cheap.
	React.useEffect(() => {
		manager.activateFor(1600)
	}, [manager, snapshot, lineHeight])

	const [isAnimating, setIsAnimating] = React.useState(true)
	React.useEffect(() => {
		setIsAnimating(true)
		const timeoutId = window.setTimeout(() => setIsAnimating(false), 500)
		return () => window.clearTimeout(timeoutId)
	}, [snapshot, lineHeight])

	// The block's first paint (per data) renders without entry animations.
	const firstPaintedDataRef = React.useRef<unknown>(null)
	const mountStatic = firstPaintedDataRef.current !== data
	React.useEffect(() => {
		firstPaintedDataRef.current = data
	}, [data])

	// Reconstruct frame from template + state (memoized)
	const frame = useFrame(data, snapshot)
	const hiddenLines = useLinePool(data, frame?.lines ?? [], lineHeight)

	if (!frame) {
		return null
	}

	const containerHeight = frame.lines.length * lineHeight

	const mergedClassName = [
		"code-block",
		"font-[Commit_Mono,ui-monospace,monospace]",
		"relative",
		"text-slate-200",
		"w-full",
		className,
	]
		.filter(Boolean)
		.join(" ")
		.trim()

	const mergedStyle: MotionStyle = {
		fontSize: "var(--code-text-size, 18px)",
		lineHeight: "var(--code-line-height, 1.75)",
		...((style ?? {}) as MotionStyle),
	}

	// Get line text for overlays (marks, glows, etc.)
	const getLineText = (lineIndex: number) => frame.lines[lineIndex]?.text ?? ""
	const overlayKey = (kind: string, overlay: AnnotationOverlay) =>
		`${kind}-${frame.lines[overlay.lineIndex]?.lineId ?? overlay.lineIndex}:${overlay.start}-${overlay.end}`

	return (
		<NeoCodeMeasurementsProvider manager={manager}>
			<motion.pre
				ref={setCodeBlockRef}
				className={mergedClassName}
				style={mergedStyle}
				initial={false}
				animate={{ height: containerHeight }}
				transition={CONTAINER_TRANSITION}
			>
				{/* Current frame lines */}
				{frame.lines.map((line, lineIndex) => (
					<CodeLine
						key={line.lineId}
						line={line}
						lineIndex={lineIndex}
						y={lineIndex * lineHeight}
						lineHeight={lineHeight}
						visible
						mountStatic={mountStatic}
						isAnimating={isAnimating}
						{...(frame.spotlight && { spotlight: frame.spotlight })}
						{...(frame.status && { status: frame.status })}
						brightRanges={frame.brightRanges}
						withMeasurementLine={frame.cursor?.lineIndex === lineIndex}
					/>
				))}

				{/* Pooled lines absent from this frame: mounted, invisible, frozen */}
				{hiddenLines.map((entry) => (
					<CodeLine
						key={entry.line.lineId}
						line={entry.line}
						lineIndex={entry.lineIndex}
						y={entry.y}
						lineHeight={lineHeight}
						visible={false}
						mountStatic={mountStatic}
						isAnimating={isAnimating}
					/>
				))}

				{/* Glow layer */}
				{/* Overlays are keyed by target identity (line + char range) rather than
				    array index, so changing targets between steps exits the old overlay and
				    enters the new one instead of morphing one across the screen. */}
				<svg className="absolute top-0 left-0 pointer-events-none overflow-visible w-full h-full z-[5]">
					<AnimatePresence>
						{frame.glows.map((glow) => (
							<SingleGlow
								key={overlayKey("glow", glow)}
								lineId={frame.lines[glow.lineIndex]?.lineId ?? ""}
								lineText={getLineText(glow.lineIndex)}
								glow={glow}
								color={getGlowColor(glow.color)}
								codeBlockRef={codeBlockRef}
							/>
						))}
					</AnimatePresence>
				</svg>

				{/* Mark layer */}
				<svg className="absolute top-0 left-0 pointer-events-none overflow-visible w-full h-full z-10">
					<AnimatePresence>
						{frame.marks.map((mark) => (
							<SingleMark
								key={overlayKey("mark", mark)}
								lineId={frame.lines[mark.lineIndex]?.lineId ?? ""}
								lineText={getLineText(mark.lineIndex)}
								mark={mark}
								colors={getHighlightColor(mark.color)}
								codeBlockRef={codeBlockRef}
							/>
						))}
					</AnimatePresence>
				</svg>

				{/* Squiggle layer */}
				<svg className="absolute top-0 left-0 pointer-events-none overflow-visible w-full h-full z-[6]">
					<AnimatePresence>
						{frame.squiggles.map((squiggle) => (
							<SingleSquiggle
								key={overlayKey("squiggle", squiggle)}
								lineId={frame.lines[squiggle.lineIndex]?.lineId ?? ""}
								lineText={getLineText(squiggle.lineIndex)}
								squiggle={squiggle}
								color={squiggle.color ?? "#ef4444"}
								codeBlockRef={codeBlockRef}
							/>
						))}
					</AnimatePresence>
				</svg>

				{/* Burst effect */}
				<BurstEffect
					bursts={frame.bursts.map((burst) => ({
						lineId: frame.lines[burst.lineIndex]?.lineId ?? "",
						charOffset: burst.charOffset,
						textLength: burst.textLength,
						emoji: burst.emoji,
						count: burst.count,
					}))}
					codeBlockRef={codeBlockRef}
					lineTexts={new Map(frame.lines.map((line, index) => [line.lineId, getLineText(index)]))}
				/>

				{/* Cursor */}
				<Cursor
					target={
						frame.cursor
							? {
									lineId: frame.lines[frame.cursor.lineIndex]?.lineId ?? "",
									lineText: getLineText(frame.cursor.lineIndex),
									charOffset: frame.cursor.charOffset,
									textLength: frame.cursor.textLength,
									...(frame.cursor.type && { type: frame.cursor.type }),
								}
							: null
					}
					codeBlockRef={codeBlockRef}
					containerHeight={containerHeight}
					say={frame.say}
				/>
			</motion.pre>
		</NeoCodeMeasurementsProvider>
	)
}
