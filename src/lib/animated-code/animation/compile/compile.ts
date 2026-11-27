/**
 * Animation Compiler - converts AnimationDef to frame-based SlideshowData.
 *
 * Each frame is self-contained with all rendering data pre-computed.
 * No lookups or computation needed at render time.
 *
 * @module
 */

import {
	type Background,
	type Bright,
	type Burst,
	type Cursor,
	type Focus,
	type Glow,
	type Mark,
	type Say,
	type Sound,
	Spotlight,
	type Squiggle,
	Status,
} from "@/lib/animated-code/annotations"
import type { Token } from "@/lib/neo-code-block/highlighter"
import type {
	AnnotationOverlay,
	CharRange,
	Frame,
	FrameLine,
	FramePart,
	SlideshowData,
	SpotlightConfig,
	StatusConfig,
	StatusRange,
} from "@/lib/neo-code-block/types"
import type { AnimationDef, LineBgStyle, Snapshot } from "../animation"
import { evaluateLinesForSnapshot } from "./evaluate"
import { buildManifest, type ManifestLine } from "./manifest"
import { compileLineContentFromAST, getPartVersion, hasMultipleVersions, isPartVisible, type Part } from "./parts"
import { collectSimpleRanges, findPatternGlobally, indexLines, resolveFocusedLines } from "./pattern-matching"

// ============================================================================
// Types
// ============================================================================

/** Compiled parts for a line */
interface LinePartsInfo {
	parts: Part[]
	lineVisibleFrom: number
}

// ============================================================================
// Main Compiler
// ============================================================================

/**
 * Compile an AnimationDef to frame-based SlideshowData.
 */
export function compile(def: AnimationDef): SlideshowData {
	const { animation, snapshots } = def

	// Phase 1: Build line manifest
	const manifest = buildManifest(animation, snapshots)

	// Phase 2: Compile parts for each line (proper part-level granularity)
	const lineParts = compileLineParts(manifest.lines, snapshots)

	// Phase 3: Collect all spotlight/status ranges across all snapshots (for stable DOM)
	const { spotlight: allSpotlightRanges, status: allStatusRanges } = collectAllRanges(manifest, snapshots)

	// Phase 4: Build each frame
	const frames: Frame[] = snapshots.map((snapshot, idx) =>
		buildFrame(idx, manifest, snapshot, snapshots, lineParts, allSpotlightRanges, allStatusRanges),
	)

	return { frames }
}

// ============================================================================
// Phase 2: Compile Line Parts
// ============================================================================

/**
 * Compile parts for each line using the Animation structure.
 * This preserves part-level granularity so only changed parts animate.
 */
function compileLineParts(lines: readonly ManifestLine[], snapshots: readonly Snapshot[]): Map<string, LinePartsInfo> {
	const result = new Map<string, LinePartsInfo>()
	let partIdCounter = 0

	const allocatePartId = () => `part-${partIdCounter++}`

	for (const line of lines) {
		const lineVisibleFrom = Math.min(...line.visibleIn)

		// Use the proper part-splitting algorithm
		const parts = compileLineContentFromAST(line.content, snapshots, [...line.visibleIn], allocatePartId)

		result.set(line.id, { parts, lineVisibleFrom })
	}

	return result
}

// ============================================================================
// Phase 3: Collect All Ranges (for stable DOM)
// ============================================================================

/**
 * Single pass through all snapshots to collect both spotlight and status ranges.
 * Avoids duplicate evaluation of lines for each annotation type.
 */
function collectAllRanges(
	manifest: ReturnType<typeof buildManifest>,
	snapshots: readonly Snapshot[],
): { spotlight: Map<string, CharRange[]>; status: Map<string, CharRange[]> } {
	const spotlight = new Map<string, CharRange[]>()
	const status = new Map<string, CharRange[]>()

	for (let idx = 0; idx < snapshots.length; idx++) {
		const snapshot = snapshots[idx]
		const lineIds = manifest.lineOrder.get(idx) ?? []
		const evaluatedLines = evaluateLinesForSnapshot(
			manifest.lines.map((l) => ({ id: l.id, content: l.content })),
			lineIds,
			snapshot,
		)
		const indexedLines = indexLines(evaluatedLines)

		for (const ann of snapshot.annotations ?? []) {
			if (ann instanceof Spotlight) {
				const ranges = collectSimpleRanges(indexedLines, [...ann.patterns])
				for (const [lineId, lineRanges] of Object.entries(ranges)) {
					const existing = spotlight.get(lineId) ?? []
					existing.push(...lineRanges)
					spotlight.set(lineId, existing)
				}
			} else if (ann instanceof Status) {
				const match = findPatternGlobally(indexedLines, ann.text, {
					nth: ann.nth,
					after: ann.after,
					substring: ann.substring,
				})
				if (match) {
					const existing = status.get(match.lineId) ?? []
					existing.push({ start: match.start, end: match.end })
					status.set(match.lineId, existing)
				}
			}
		}
	}

	return { spotlight, status }
}

// ============================================================================
// Phase 4: Frame Building
// ============================================================================

function buildFrame(
	snapshotIdx: number,
	manifest: ReturnType<typeof buildManifest>,
	snapshot: Snapshot,
	_allSnapshots: readonly Snapshot[],
	lineParts: Map<string, LinePartsInfo>,
	allSpotlightRanges: Map<string, CharRange[]>,
	allStatusRanges: Map<string, CharRange[]>,
): Frame {
	const lineIds = manifest.lineOrder.get(snapshotIdx) ?? []
	const prevLineIds = snapshotIdx > 0 ? (manifest.lineOrder.get(snapshotIdx - 1) ?? []) : []
	const prevLineIdSet = new Set(prevLineIds)

	// Evaluate lines for this snapshot
	const evaluatedLines = evaluateLinesForSnapshot(
		manifest.lines.map((l) => ({ id: l.id, content: l.content })),
		lineIds,
		snapshot,
	)
	const indexedLines = indexLines(evaluatedLines)
	const lineIdToIndex = new Map(lineIds.map((id, i) => [id, i]))

	// Process annotations first to get focus/spotlight info
	const annotationResult = processAnnotations(
		snapshot,
		indexedLines,
		lineIdToIndex,
		allSpotlightRanges,
		allStatusRanges,
	)

	// Build frame lines
	const lines: FrameLine[] = lineIds.map((lineId, _lineIndex) => {
		const entering = !prevLineIdSet.has(lineId)
		const dimmed = annotationResult.hasFocus && !annotationResult.focusedLineIds.has(lineId)
		const background = annotationResult.backgrounds.get(lineId)

		// Build parts for this line using compiled Part data
		const lineInfo = lineParts.get(lineId)
		const parts = buildFrameParts(lineId, snapshotIdx, lineInfo)

		// Pre-compute line text (join visible parts)
		const text = parts
			.filter((p) => p.isVisible)
			.map((p) => p.tokens.map((t) => t.text).join(""))
			.join("")

		return {
			lineId,
			parts,
			text,
			entering,
			dimmed,
			...(background && { background }),
		}
	})

	const frame: Frame = {
		id: snapshotIdx,
		lines,
		marks: annotationResult.marks,
		glows: annotationResult.glows,
		squiggles: annotationResult.squiggles,
		brightRanges: annotationResult.brightRanges,
		bursts: annotationResult.bursts,
	}

	// Only add optional properties when defined
	if (annotationResult.spotlight) frame.spotlight = annotationResult.spotlight
	if (annotationResult.status) frame.status = annotationResult.status
	if (annotationResult.cursor) frame.cursor = annotationResult.cursor
	if (annotationResult.sound) frame.sound = annotationResult.sound
	if (annotationResult.say) frame.say = annotationResult.say

	return frame
}

function buildFrameParts(lineId: string, snapshotIdx: number, lineInfo: LinePartsInfo | undefined): FramePart[] {
	if (!lineInfo || lineInfo.parts.length === 0) {
		return [
			{
				partId: `${lineId}-empty`,
				tokens: [],
				motionKey: `${lineId}-empty`,
				crossfade: false,
				animateEntry: false,
				isVisible: true,
			},
		]
	}

	const frameParts: FramePart[] = []

	// Include ALL parts - AnimatePresence handles enter/exit based on isVisible changes
	for (const part of lineInfo.parts) {
		const isVisible = isPartVisible(part, snapshotIdx)

		// Get version for this snapshot (or nearest version for hidden parts)
		const version = getPartVersion(part, snapshotIdx) ?? getPartVersion(part, part.visibleFrom)
		if (!version) continue

		const crossfade = hasMultipleVersions(part)
		const motionKey = crossfade ? `${part.partId}-${version.fromSnapshot}` : part.partId
		const animateEntry = part.visibleFrom > lineInfo.lineVisibleFrom

		const tokens: Token[] = version.text ? [{ text: version.text, type: "default" as const }] : []

		const framePart: FramePart = {
			partId: part.partId,
			tokens,
			motionKey,
			crossfade,
			animateEntry,
			isVisible,
		}
		if (part.inline) framePart.inline = part.inline
		frameParts.push(framePart)
	}

	if (frameParts.length === 0) {
		return [
			{
				partId: `${lineId}-empty`,
				tokens: [],
				motionKey: `${lineId}-empty`,
				crossfade: false,
				animateEntry: false,
				isVisible: true,
			},
		]
	}

	return frameParts
}

// ============================================================================
// Annotation Processing
// ============================================================================

interface AnnotationResult {
	marks: AnnotationOverlay[]
	glows: AnnotationOverlay[]
	squiggles: AnnotationOverlay[]
	brightRanges: AnnotationOverlay[]
	spotlight?: SpotlightConfig
	status?: StatusConfig
	cursor?: Frame["cursor"]
	bursts: Frame["bursts"]
	sound?: string
	say?: string
	hasFocus: boolean
	focusedLineIds: Set<string>
	backgrounds: Map<string, LineBgStyle>
}

/** Find pattern and transform match to result, or undefined if not found */
function processPatternAnnotation<
	A extends {
		text: string
		nth?: number | undefined
		after?: string | undefined
		substring?: boolean | undefined
	},
	T,
>(
	ann: A,
	lines: ReturnType<typeof indexLines>,
	lineIdToIndex: Map<string, number>,
	transform: (match: { lineId: string; start: number; end: number }, lineIndex: number) => T,
): T | undefined {
	const match = findPatternGlobally(lines, ann.text, {
		nth: ann.nth ?? 1,
		after: ann.after,
		substring: ann.substring,
	})
	if (!match) return undefined
	const lineIndex = lineIdToIndex.get(match.lineId)
	if (lineIndex === undefined) return undefined
	return transform(match, lineIndex)
}

/** Process overlay annotation (Mark, Glow, Squiggle, Bright) */
function processOverlay<
	A extends {
		text: string
		nth?: number | undefined
		after?: string | undefined
		substring?: boolean | undefined
		color?: string | undefined
	},
>(ann: A, lines: ReturnType<typeof indexLines>, lineIdToIndex: Map<string, number>, target: AnnotationOverlay[]): void {
	const overlay = processPatternAnnotation(ann, lines, lineIdToIndex, (m, idx) => ({
		lineIndex: idx,
		start: m.start,
		end: m.end,
		...(ann.color && { color: ann.color }),
	}))
	if (overlay) target.push(overlay)
}

/** Context for annotation handlers */
interface AnnotationContext {
	lines: ReturnType<typeof indexLines>
	lineIdToIndex: Map<string, number>
	result: AnnotationResult
	spotlightRanges: Record<string, CharRange[]>
	spotlightDim: number
	spotlightGlow: boolean
	statusRanges: Record<string, StatusRange[]>
}

/** Annotation handler type */
type AnnotationHandler = (ann: unknown, ctx: AnnotationContext) => void

/** Dispatch map for annotation processing */
const annotationHandlers: Record<string, AnnotationHandler> = {
	Focus: (ann, ctx) => {
		const a = ann as Focus
		const focusedLines = resolveFocusedLines(ctx.lines, [...a.lines])
		ctx.result.focusedLineIds = new Set(focusedLines)
		ctx.result.hasFocus = focusedLines.length > 0
	},
	Spotlight: (ann, ctx) => {
		const a = ann as Spotlight
		ctx.spotlightRanges = collectSimpleRanges(ctx.lines, [...a.patterns])
		ctx.spotlightDim = a.dim ?? 0.4
		ctx.spotlightGlow = a.glow ?? false
	},
	Background: (ann, ctx) => {
		const a = ann as Background
		ctx.result.backgrounds.set(a.lineId, a.style)
	},
	Sound: (ann, ctx) => {
		ctx.result.sound = (ann as Sound).name
	},
	Say: (ann, ctx) => {
		ctx.result.say = (ann as Say).text
	},
	Mark: (ann, ctx) => {
		processOverlay(ann as Mark, ctx.lines, ctx.lineIdToIndex, ctx.result.marks)
	},
	Glow: (ann, ctx) => {
		processOverlay(ann as Glow, ctx.lines, ctx.lineIdToIndex, ctx.result.glows)
	},
	Squiggle: (ann, ctx) => {
		processOverlay(ann as Squiggle, ctx.lines, ctx.lineIdToIndex, ctx.result.squiggles)
	},
	Bright: (ann, ctx) => {
		processOverlay(ann as Bright, ctx.lines, ctx.lineIdToIndex, ctx.result.brightRanges)
	},
	Status: (ann, ctx) => {
		const a = ann as Status
		const match = findPatternGlobally(ctx.lines, a.text, {
			nth: a.nth,
			after: a.after,
			substring: a.substring,
		})
		if (match && ctx.lineIdToIndex.has(match.lineId)) {
			const ranges = (ctx.statusRanges[match.lineId] ??= [])
			ranges.push({ start: match.start, end: match.end, status: a.status })
		}
	},
	Cursor: (ann, ctx) => {
		const a = ann as Cursor
		const cursor = processPatternAnnotation(a, ctx.lines, ctx.lineIdToIndex, (m, idx) => ({
			lineIndex: idx,
			charOffset: m.start,
			textLength: a.text.length,
			...(a.type !== undefined ? { type: a.type } : {}),
		}))
		if (cursor) ctx.result.cursor = cursor
	},
	Burst: (ann, ctx) => {
		const a = ann as Burst
		const burst = processPatternAnnotation(a, ctx.lines, ctx.lineIdToIndex, (m, idx) => ({
			lineIndex: idx,
			charOffset: m.start,
			textLength: a.text.length,
			emoji: Array.isArray(a.emoji) ? a.emoji : [a.emoji],
			count: a.count ?? 5,
		}))
		if (burst) ctx.result.bursts.push(burst)
	},
}

function processAnnotations(
	snapshot: Snapshot,
	lines: ReturnType<typeof indexLines>,
	lineIdToIndex: Map<string, number>,
	allSpotlightRanges: Map<string, CharRange[]>,
	allStatusRanges: Map<string, CharRange[]>,
): AnnotationResult {
	const ctx: AnnotationContext = {
		lines,
		lineIdToIndex,
		result: {
			marks: [],
			glows: [],
			squiggles: [],
			brightRanges: [],
			bursts: [],
			hasFocus: false,
			focusedLineIds: new Set(),
			backgrounds: new Map(),
		},
		spotlightRanges: {},
		spotlightDim: 0.4,
		spotlightGlow: false,
		statusRanges: {},
	}

	for (const ann of snapshot.annotations ?? []) {
		const handler = annotationHandlers[ann._tag]
		handler?.(ann, ctx)
	}

	// Build spotlight config if ANY frame has spotlight (for stable DOM)
	if (allSpotlightRanges.size > 0) {
		const ranges: Record<number, CharRange[]> = {}
		const allRanges: Record<string, CharRange[]> = {}

		for (const [lineId, lineRanges] of Object.entries(ctx.spotlightRanges)) {
			const lineIndex = ctx.lineIdToIndex.get(lineId)
			if (lineIndex !== undefined) {
				ranges[lineIndex] = lineRanges
			}
		}

		// allRanges keyed by line ID (not index) for stable DOM across line collapses
		for (const [lineId, lineRanges] of allSpotlightRanges) {
			allRanges[lineId] = lineRanges
		}

		ctx.result.spotlight = {
			ranges,
			allRanges,
			dim: ctx.spotlightDim,
			glow: ctx.spotlightGlow,
		}
	}

	// Build status config if ANY frame has status (for stable DOM)
	if (allStatusRanges.size > 0) {
		const ranges: Record<number, StatusRange[]> = {}
		const allRanges: Record<string, CharRange[]> = {}

		for (const [lineId, lineRanges] of Object.entries(ctx.statusRanges)) {
			const lineIndex = ctx.lineIdToIndex.get(lineId)
			if (lineIndex !== undefined) {
				ranges[lineIndex] = lineRanges
			}
		}

		// allRanges keyed by line ID (not index) for stable DOM across line collapses
		for (const [lineId, lineRanges] of allStatusRanges) {
			allRanges[lineId] = lineRanges
		}

		ctx.result.status = { ranges, allRanges }
	}

	return ctx.result
}
