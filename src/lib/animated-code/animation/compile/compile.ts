/**
 * Animation Compiler - converts an AnimationDef to a {@link CodeSlideshow}.
 *
 * Every line is highlighted as a whole in each frame (a token's color depends on the rest of
 * the line), then each part keeps every distinct rendering it gets across frames. The template
 * stores those renderings once; each frame state says which one is showing.
 *
 * @module
 */

import {
	type AnimationSoundName,
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
import type {
	BurstTarget,
	CharRange,
	CodeSlideshow,
	CursorTarget,
	FrameState,
	LineState,
	Overlay,
	Spotlight as SpotlightState,
	StatusIndicators,
	StatusRange,
	TemplateLine,
	TemplatePart,
	Token,
} from "@/lib/animated-code/slideshow"
import type { AnimationDef, LineBgStyle, Snapshot } from "../animation"
import { evaluateLinesForSnapshot } from "./evaluate"
import { type Highlight, plainText, typescriptHighlighter } from "./highlight"
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

/** Compile with TypeScript highlighting (what the course build ships). */
export async function compileSlideshow(def: AnimationDef): Promise<CodeSlideshow> {
	return compile(def, await typescriptHighlighter())
}

/**
 * Compile an AnimationDef to a slideshow. Without a highlighter every part is one plain token.
 */
export function compile(def: AnimationDef, highlight: Highlight = plainText): CodeSlideshow {
	const { animation, snapshots } = def

	// Phase 1: Build line manifest
	const manifest = buildManifest(animation, snapshots)

	// Phase 2: Compile parts for each line (proper part-level granularity)
	const lineParts = compileLineParts(manifest.lines, snapshots)

	// Phase 3: Collect all spotlight/status ranges across all snapshots (for stable DOM)
	const { spotlight: allSpotlightRanges, status: allStatusRanges } = collectAllRanges(manifest, snapshots)

	// Phase 4: Render each frame's lines and resolve its annotations
	const frames = snapshots.map((snapshot, idx) =>
		renderFrame(idx, manifest, snapshot, lineParts, allSpotlightRanges, allStatusRanges, highlight),
	)

	// Phase 5: Store each part's renderings once, then each frame's choice among them
	const template = buildTemplate(frames)
	return {
		template: { lines: template.lines },
		frames: frames.map((frame) => frameState(frame, template)),
	}
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

	for (const line of lines) {
		const lineVisibleFrom = Math.min(...line.visibleIn)

		// Use the proper part-splitting algorithm
		const parts = compileLineContentFromAST(line.content, snapshots, [...line.visibleIn])

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
			snapshot.slots,
		)
		const indexedLines = indexLines(evaluatedLines)

		for (const ann of snapshot.annotations) {
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
// Phase 4: Frame Rendering
// ============================================================================

/** One part as it renders in one frame */
interface PartRendering {
	readonly partId: string
	readonly tokens: readonly Token[]
	readonly isVisible: boolean
	readonly crossfade: boolean
	readonly animateEntry: boolean
	readonly inline?: string
}

interface LineRendering {
	readonly lineId: string
	readonly parts: readonly PartRendering[]
	readonly entering: boolean
	readonly dimmed: boolean
	readonly background?: LineBgStyle
}

interface FrameRendering extends Omit<FrameState, "lineOrder" | "state"> {
	readonly lines: readonly LineRendering[]
}

function renderFrame(
	snapshotIdx: number,
	manifest: ReturnType<typeof buildManifest>,
	snapshot: Snapshot,
	lineParts: Map<string, LinePartsInfo>,
	allSpotlightRanges: Map<string, CharRange[]>,
	allStatusRanges: Map<string, CharRange[]>,
	highlight: Highlight,
): FrameRendering {
	const lineIds = manifest.lineOrder.get(snapshotIdx) ?? []
	const prevLineIds = new Set(snapshotIdx > 0 ? (manifest.lineOrder.get(snapshotIdx - 1) ?? []) : [])

	// Evaluate lines for this snapshot
	const evaluatedLines = evaluateLinesForSnapshot(
		manifest.lines.map((l) => ({ id: l.id, content: l.content })),
		lineIds,
		snapshot.slots,
	)
	const indexedLines = indexLines(evaluatedLines)
	const lineIdToIndex = new Map(lineIds.map((id, i) => [id, i]))

	const annotations = processAnnotations(snapshot, indexedLines, lineIdToIndex, allSpotlightRanges, allStatusRanges)

	const lines = lineIds.map((lineId): LineRendering => {
		const background = annotations.backgrounds.get(lineId)
		return {
			lineId,
			parts: renderLineParts(lineId, snapshotIdx, lineParts.get(lineId), highlight),
			entering: !prevLineIds.has(lineId),
			dimmed: annotations.hasFocus && !annotations.focusedLineIds.has(lineId),
			...(background && { background }),
		}
	})

	return {
		id: snapshotIdx,
		lines,
		marks: annotations.marks,
		glows: annotations.glows,
		squiggles: annotations.squiggles,
		brightRanges: annotations.brightRanges,
		...(annotations.spotlight && { spotlight: annotations.spotlight }),
		...(annotations.status && { status: annotations.status }),
		...(annotations.cursor && { cursor: annotations.cursor }),
		bursts: annotations.bursts,
		...(annotations.sound && { sound: annotations.sound }),
		...(annotations.say && { say: annotations.say }),
	}
}

/**
 * Every part of a line in one frame. The visible parts' text is highlighted as one line, then
 * split back into parts; hidden parts keep plain tokens.
 */
function renderLineParts(
	lineId: string,
	snapshotIdx: number,
	lineInfo: LinePartsInfo | undefined,
	highlight: Highlight,
): PartRendering[] {
	if (!lineInfo || lineInfo.parts.length === 0) {
		return [{ partId: `${lineId}-empty`, tokens: [], isVisible: true, crossfade: false, animateEntry: false }]
	}

	const parts = lineInfo.parts.map((part) => ({
		part,
		// Hidden parts keep the nearest version so they can animate out
		text: (getPartVersion(part, snapshotIdx) ?? part.versions[0]).text,
		isVisible: isPartVisible(part, snapshotIdx),
	}))
	const lineText = parts
		.filter((p) => p.isVisible)
		.map((p) => p.text)
		.join("")
	const lineTokens = lineText ? highlight(lineText) : []

	let offset = 0
	return parts.map(({ part, text, isVisible }) => {
		let tokens: readonly Token[]
		if (isVisible && lineText) {
			tokens = sliceTokens(lineTokens, offset, offset + text.length)
			offset += text.length
		} else {
			tokens = text ? [{ text, type: "default" }] : []
		}
		return {
			partId: part.partId,
			tokens,
			isVisible,
			crossfade: hasMultipleVersions(part),
			animateEntry: part.visibleFrom > lineInfo.lineVisibleFrom,
			...(part.inline && { inline: part.inline }),
		}
	})
}

/** The tokens covering `[start, end)` of a line, split at the edges. */
function sliceTokens(tokens: readonly Token[], start: number, end: number): Token[] {
	const sliced: Token[] = []
	let tokenStart = 0
	for (const token of tokens) {
		const tokenEnd = tokenStart + token.text.length
		if (tokenEnd > start && tokenStart < end) {
			const text = token.text.slice(Math.max(0, start - tokenStart), Math.min(token.text.length, end - tokenStart))
			if (text) sliced.push({ ...token, text })
		}
		tokenStart = tokenEnd
	}
	return sliced
}

// ============================================================================
// Phase 5: Template + Frame States
// ============================================================================

/** Exact identity of a rendering, highlighting included */
const tokensIdentity = (tokens: readonly Token[]): string =>
	JSON.stringify(tokens.map((t) => [t.text, t.type, t.color ?? null]))

const tokensText = (tokens: readonly Token[]): string => tokens.map((t) => t.text).join("")

interface TemplateBuild {
	readonly lines: Record<string, TemplateLine>
	/** Version key of a visible rendering, for parts with more than one (undefined = the only one) */
	readonly versionKey: (lineId: string, partId: string, tokens: readonly Token[]) => string | undefined
}

/**
 * Collect every distinct visible rendering of each part, in first-seen order.
 *
 * A part gets `versions` when it shows more than one way: different text (a changing slot) or
 * the same text with different colors (Shiki colors depend on the rest of the line). Version keys
 * are the part's text; a later rendering of the same text with other colors gets `text\u0000n`.
 */
function buildTemplate(frames: readonly FrameRendering[]): TemplateBuild {
	const lines: Record<string, { parts: Record<string, TemplatePart>; partOrder: string[] }> = {}
	/** line -> part -> rendering identity -> version key */
	const keys = new Map<string, Map<string, Map<string, string>>>()
	/** line -> part -> version key -> tokens */
	const renderings = new Map<string, Map<string, Map<string, readonly Token[]>>>()

	for (const frame of frames) {
		for (const line of frame.lines) {
			let templateLine = lines[line.lineId]
			if (!templateLine) {
				// A line renders the same parts in every frame, so its first frame fixes the order
				templateLine = lines[line.lineId] = { parts: {}, partOrder: [] }
				keys.set(line.lineId, new Map())
				renderings.set(line.lineId, new Map())
				for (const part of line.parts) {
					templateLine.parts[part.partId] = {
						tokens: part.tokens,
						animateEntry: part.animateEntry,
						crossfade: part.crossfade,
						...(part.inline && { inline: part.inline }),
					}
					templateLine.partOrder.push(part.partId)
					keys.get(line.lineId)!.set(part.partId, new Map())
					renderings.get(line.lineId)!.set(part.partId, new Map())
				}
			}

			for (const part of line.parts) {
				if (!part.isVisible) continue
				const partKeys = keys.get(line.lineId)!.get(part.partId)!
				const identity = tokensIdentity(part.tokens)
				if (partKeys.has(identity)) continue
				const partRenderings = renderings.get(line.lineId)!.get(part.partId)!
				const text = tokensText(part.tokens)
				let key = text
				for (let n = 1; partRenderings.has(key); n++) key = `${text}\u0000${n}`
				partKeys.set(identity, key)
				partRenderings.set(key, part.tokens)
			}
		}
	}

	for (const [lineId, parts] of renderings) {
		for (const [partId, partRenderings] of parts) {
			const [first] = partRenderings.values()
			// The default rendering is the first visible one (a part never shown keeps its plain tokens)
			const templatePart = lines[lineId].parts[partId]
			lines[lineId].parts[partId] = {
				...templatePart,
				...(first && { tokens: first }),
				...(partRenderings.size > 1 && { versions: Object.fromEntries(partRenderings) }),
			}
		}
	}

	return {
		lines,
		versionKey: (lineId, partId, tokens) =>
			lines[lineId]?.parts[partId]?.versions ? keys.get(lineId)?.get(partId)?.get(tokensIdentity(tokens)) : undefined,
	}
}

/** What one frame shows: line order, each part's visibility or version, and the resolved annotations. */
function frameState(frame: FrameRendering, template: TemplateBuild): FrameState {
	const state: Record<string, LineState> = {}
	for (const line of frame.lines) {
		const parts: Record<string, boolean | string> = {}
		for (const partId of template.lines[line.lineId].partOrder) {
			const part = line.parts.find((p) => p.partId === partId)
			parts[partId] = part?.isVisible ? (template.versionKey(line.lineId, partId, part.tokens) ?? true) : false
		}
		state[line.lineId] = {
			parts,
			...(line.entering && { entering: true }),
			...(line.dimmed && { dimmed: true }),
			...(line.background && { background: line.background }),
		}
	}

	const { id, lines, ...annotations } = frame
	return { id, lineOrder: lines.map((l) => l.lineId), state, ...annotations }
}

// ============================================================================
// Annotation Processing
// ============================================================================

interface AnnotationResult {
	marks: Overlay[]
	glows: Overlay[]
	squiggles: Overlay[]
	brightRanges: Overlay[]
	spotlight?: SpotlightState
	status?: StatusIndicators
	cursor?: CursorTarget
	bursts: BurstTarget[]
	sound?: AnimationSoundName
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
>(ann: A, lines: ReturnType<typeof indexLines>, lineIdToIndex: Map<string, number>, target: Overlay[]): void {
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

	for (const ann of snapshot.annotations) {
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
