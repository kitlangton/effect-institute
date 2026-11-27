"use client"

import { ArrowRight } from "@phosphor-icons/react"
import { motion } from "motion/react"
import React from "react"
import type {
	CharRange,
	FrameLine,
	FramePart,
	FramePartVersion,
	Overlay,
	Spotlight,
	StatusIndicators,
	Token,
} from "@/lib/animated-code/slideshow"
import { SPOTLIGHT_DIMMED_OPACITY, SPOTLIGHT_FULL_OPACITY, SPOTLIGHT_TRANSITION_DURATION } from "../constants"
import { AnimatedPart } from "./AnimatedPart"
import { StatusIndicator } from "./StatusIndicator"
import { splitTokensAtSpotlightBoundaries } from "./spotlight"

/* ------------------------------------------------------------------ */
/* Token Rendering with Spotlight                                      */
/* ------------------------------------------------------------------ */

/**
 * Check if a segment is within any of the given spotlight ranges.
 */
function isInSpotlightRange(segStart: number, segEnd: number, ranges: readonly CharRange[]): boolean {
	return ranges.some((r) => segStart >= r.start && segEnd <= r.end)
}

/**
 * Renders tokens with animated spotlight and status support.
 *
 * Tokens are split using ALL ranges (from allRanges) for stable DOM,
 * then animated based on current ranges.
 */
function renderTokensWithAnnotations(
	tokens: readonly Token[],
	partOffset: number,
	lineId: string,
	brightBoundaries: readonly CharRange[],
	lineIndex: number,
	spotlight?: Spotlight,
	status?: StatusIndicators,
	brightRanges: readonly Overlay[] = [],
	renderMode: "animated" | "static" = "animated",
): React.ReactNode[] {
	// allRanges keyed by line ID (stable across line collapses)
	const allSpotlightRanges = spotlight?.allRanges[lineId] ?? []
	// current ranges keyed by line index (for current frame)
	const currentSpotlightRanges = spotlight?.ranges[lineIndex] ?? []
	const hasSpotlight = spotlight !== undefined && Object.keys(spotlight.ranges).length > 0
	const lineHasCurrentSpotlight = currentSpotlightRanges.length > 0
	const spotlightDim = spotlight?.dim ?? SPOTLIGHT_DIMMED_OPACITY
	const spotlightGlow = spotlight?.glow ?? false

	// allRanges keyed by line ID (stable), current ranges keyed by index
	const allStatusRanges = status?.allRanges[lineId] ?? []
	const statusRanges = status?.ranges[lineIndex] ?? []
	const currentBrightRanges = brightRanges.filter((range) => range.lineIndex === lineIndex)

	const allBoundaryRanges = [...allSpotlightRanges, ...allStatusRanges, ...brightBoundaries]

	// Split tokens using ALL ranges for stable DOM structure
	const segments = splitTokensAtSpotlightBoundaries(tokens, partOffset, allBoundaryRanges)

	const result: React.ReactNode[] = []

	for (const segment of segments) {
		// Check if this segment is spotlit in the CURRENT snapshot
		const isCurrentlySpotlit = isInSpotlightRange(segment.start, segment.end, currentSpotlightRanges)
		const isBright = isInSpotlightRange(segment.start, segment.end, currentBrightRanges)

		// Determine opacity based on current spotlight state
		let opacity: number
		if (!hasSpotlight) {
			opacity = SPOTLIGHT_FULL_OPACITY
		} else if (!lineHasCurrentSpotlight) {
			opacity = spotlightDim
		} else {
			opacity = isCurrentlySpotlit ? SPOTLIGHT_FULL_OPACITY : spotlightDim
		}

		// Text glow when spotlit and glow enabled
		const shouldGlow = spotlightGlow && hasSpotlight && lineHasCurrentSpotlight && isCurrentlySpotlit

		const textShadow =
			isBright || shouldGlow
				? "0 0 6px currentColor, 0 0 16px color-mix(in srgb, currentColor 50%, transparent)"
				: "none"

		const tokenClassName = segment.token.color ? "token" : `token token-${segment.token.type}`
		const tokenStyle = segment.token.color ? { color: segment.token.color } : undefined

		if (renderMode === "animated") {
			result.push(
				<motion.span
					key={`${segment.start}-${segment.end}`}
					className={tokenClassName}
					initial={false}
					animate={{ opacity, textShadow }}
					transition={{ duration: SPOTLIGHT_TRANSITION_DURATION }}
					{...(tokenStyle ? { style: tokenStyle } : {})}
				>
					{segment.token.text}
				</motion.span>,
			)
		} else {
			result.push(
				<span
					key={`${segment.start}-${segment.end}`}
					className={tokenClassName}
					style={{
						...(tokenStyle ?? {}),
						opacity,
						textShadow,
					}}
				>
					{segment.token.text}
				</span>,
			)
		}

		// Check if this position (segment.end) is a status boundary across ANY snapshot
		const hasStatusAtPosition = allStatusRanges.some((sr) => sr.end === segment.end)
		if (hasStatusAtPosition) {
			// Find current status at this position (if any)
			const currentStatus = statusRanges.find((sr) => sr.end === segment.end)
			if (renderMode === "animated") {
				result.push(
					<motion.span
						key={`status-slot-${segment.end}`}
						initial={{ width: 0, opacity: 0 }}
						animate={{
							width: currentStatus ? "auto" : 0,
							opacity: currentStatus ? 1 : 0,
						}}
						transition={{ type: "spring", visualDuration: 0.3, bounce: 0 }}
						style={{ display: "inline-flex", overflow: "hidden" }}
					>
						<StatusIndicator status={currentStatus?.status ?? "idle"} size="md" className="ml-1" />
					</motion.span>,
				)
			} else if (currentStatus) {
				result.push(
					<span key={`status-slot-${segment.end}`} style={{ display: "inline-flex" }}>
						<StatusIndicator status={currentStatus.status} size="md" className="ml-1" />
					</span>,
				)
			}
		}
	}

	return result
}

/* ------------------------------------------------------------------ */
/* Part Versions                                                       */
/* ------------------------------------------------------------------ */

const SINGLE_VERSION_KEY = "default"

/**
 * Every content version of a part, plus which one is active this frame.
 * Non-crossfade parts have exactly one version.
 */
function partVersions(part: FramePart): { versions: readonly FramePartVersion[]; activeKey: string } {
	if (part.versions && part.versions.length > 0) {
		return { versions: part.versions, activeKey: part.activeVersionKey ?? part.versions[0].key }
	}
	return { versions: [{ key: SINGLE_VERSION_KEY, tokens: part.tokens }], activeKey: SINGLE_VERSION_KEY }
}

/* ------------------------------------------------------------------ */
/* LineParts Component                                                 */
/* ------------------------------------------------------------------ */

interface LinePartsProps {
	line: FrameLine
	lineIndex: number
	spotlight?: Spotlight
	status?: StatusIndicators
	brightRanges?: readonly Overlay[]
	renderMode?: "animated" | "static"
}

/**
 * Renders a line's parts.
 *
 * In animated mode every part, and every content version of a crossfade
 * part, stays mounted permanently: visibility and version switches only
 * change animation targets (see AnimatedPart). This makes rendering a pure
 * function of the current frame - rapid forward/backward stepping cannot
 * leave parts stuck in a stale animation state.
 *
 * In static mode (measurement lines, SSR-ish rendering) only the visible
 * parts' active versions are rendered.
 */
export const LineParts = React.memo(function LineParts({
	line,
	lineIndex,
	spotlight,
	status,
	brightRanges,
	renderMode = "animated",
}: LinePartsProps) {
	// Track character offset across VISIBLE parts only
	// (annotation positions are calculated based on visible content)
	let partOffset = 0
	const isAnimated = renderMode === "animated"

	return (
		<>
			{line.parts.map((part) => {
				const text = part.tokens.map((t) => t.text).join("")
				const currentOffset = partOffset
				// Only advance offset for visible parts
				if (part.isVisible) {
					partOffset += text.length
				}

				// Render inline components (e.g., "output") with special styling
				const renderContent = (tokens: readonly Token[]) => {
					const rendered =
						tokens.length > 0
							? renderTokensWithAnnotations(
									tokens,
									currentOffset,
									line.lineId,
									line.brightBoundaries ?? [],
									lineIndex,
									spotlight,
									status,
									brightRanges,
									renderMode,
								)
							: null

					if (part.inline === "output") {
						// Arrow is added visually, not in source content
						// This keeps source offsets = DOM text offsets for Range API measurement
						return (
							<span className="ml-2 inline-flex items-center bg-zinc-800/50 px-2 text-zinc-400 shadow-[inset_0_0_0_1px_rgba(63,63,70,0.5)]">
								<ArrowRight weight="bold" className="mr-2 size-4 text-zinc-500" />
								{rendered}
							</span>
						)
					}

					return rendered
				}

				if (!isAnimated) {
					if (!part.isVisible) return null
					return (
						<span key={part.partId} className="part whitespace-pre font-inherit leading-inherit flex items-center">
							{renderContent(part.tokens)}
						</span>
					)
				}

				const { versions, activeKey } = partVersions(part)
				return (
					<React.Fragment key={part.partId}>
						{versions.map((version) => (
							<AnimatedPart key={version.key} isVisible={part.isVisible && version.key === activeKey}>
								{renderContent(version.tokens)}
							</AnimatedPart>
						))}
					</React.Fragment>
				)
			})}
		</>
	)
})
