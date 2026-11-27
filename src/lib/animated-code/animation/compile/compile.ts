/**
 * Animation Compiler - converts an AnimationDef to a {@link CodeSlideshow}.
 *
 * Every line is highlighted as a whole in each frame (a token's color depends on the rest of
 * the line), then each part keeps every distinct rendering it gets across frames. The template
 * stores those renderings once; each frame state says which one is showing.
 *
 * @module
 */

import type { LineBackground } from "@/lib/animated-code/annotations"
import type {
	CharRange,
	CodeSlideshow,
	FrameState,
	LineState,
	Overlay,
	StatusRange,
	TemplateLine,
	TemplatePart,
	Token,
} from "@/lib/animated-code/slideshow"
import type { AnimationDef, Snapshot } from "../animation"
import { evaluateLinesForSnapshot } from "./evaluate"
import { type Highlight, plainText, typescriptHighlighter } from "./highlight"
import { buildManifest, type ManifestLine } from "./manifest"
import { compileLineContentFromAST, getPartVersion, hasMultipleVersions, isPartVisible, type Part } from "./parts"
import { type ResolvedRange, type ResolvedSnapshot, resolveAnnotations } from "./resolve"

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

	// Phase 3: Resolve each snapshot's annotations against the lines it shows
	const contents = manifest.lines.map((l) => ({ id: l.id, content: l.content }))
	const lineIdsAt = (idx: number) => manifest.lineOrder.get(idx) ?? []
	const resolved = snapshots.map((snapshot, idx) =>
		resolveAnnotations(evaluateLinesForSnapshot(contents, lineIdsAt(idx), snapshot.slots), snapshot.annotations),
	)
	const everyRange = collectEveryRange(resolved)

	// Phase 4: Render each frame's lines and place its annotations
	const frames = resolved.map((annotations, idx) =>
		renderFrame(idx, lineIdsAt(idx), idx > 0 ? lineIdsAt(idx - 1) : [], annotations, lineParts, everyRange, highlight),
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
// Phase 3: Every Spotlight and Status Range (for stable DOM)
// ============================================================================

/** Ranges ever spotlit or given a status indicator, by line ID, so token spans never split mid-animation */
interface EveryRange {
	readonly spotlight: ReadonlyMap<string, readonly CharRange[]>
	readonly status: ReadonlyMap<string, readonly CharRange[]>
}

function collectEveryRange(resolved: readonly ResolvedSnapshot[]): EveryRange {
	const spotlight = new Map<string, CharRange[]>()
	const status = new Map<string, CharRange[]>()
	const add = (into: Map<string, CharRange[]>, lineId: string, ranges: readonly CharRange[]) =>
		into.set(lineId, [...(into.get(lineId) ?? []), ...ranges])

	for (const snapshot of resolved) {
		for (const [lineId, ranges] of Object.entries(snapshot.spotlight?.ranges ?? {})) add(spotlight, lineId, ranges)
		for (const { lineId, start, end } of snapshot.status) add(status, lineId, [{ start, end }])
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
	readonly background?: LineBackground
}

interface FrameRendering extends Omit<FrameState, "lineOrder" | "state"> {
	readonly lines: readonly LineRendering[]
}

function renderFrame(
	snapshotIdx: number,
	lineIds: readonly string[],
	prevLineIds: readonly string[],
	annotations: ResolvedSnapshot,
	lineParts: Map<string, LinePartsInfo>,
	everyRange: EveryRange,
	highlight: Highlight,
): FrameRendering {
	const entered = new Set(prevLineIds)
	// Resolved annotations only name lines of this frame
	const lineIndex = new Map(lineIds.map((id, i) => [id, i]))
	const at = (lineId: string) => lineIndex.get(lineId) ?? -1
	const overlay = (r: ResolvedRange): Overlay => ({
		lineIndex: at(r.lineId),
		start: r.start,
		end: r.end,
		...(r.color && { color: r.color }),
	})
	const { focusedLineIds, spotlight, cursor } = annotations

	const lines = lineIds.map((lineId): LineRendering => {
		const background = annotations.backgrounds.get(lineId)
		return {
			lineId,
			parts: renderLineParts(lineId, snapshotIdx, lineParts.get(lineId), highlight),
			entering: !entered.has(lineId),
			dimmed: focusedLineIds !== undefined && !focusedLineIds.has(lineId),
			...(background && { background }),
		}
	})

	const statusRanges: Record<number, StatusRange[]> = {}
	for (const { lineId, start, end, status } of annotations.status)
		(statusRanges[at(lineId)] ??= []).push({ start, end, status })

	return {
		id: snapshotIdx,
		lines,
		marks: annotations.marks.map(overlay),
		glows: annotations.glows.map(overlay),
		squiggles: annotations.squiggles.map(overlay),
		brightRanges: annotations.brights.map(overlay),
		// Every frame carries the config once any frame uses it, so token spans stay stable
		...(everyRange.spotlight.size > 0 && {
			spotlight: {
				ranges: Object.fromEntries(Object.entries(spotlight?.ranges ?? {}).map(([id, ranges]) => [at(id), ranges])),
				allRanges: Object.fromEntries(everyRange.spotlight),
				dim: spotlight?.dim ?? 0.4,
				glow: spotlight?.glow ?? false,
			},
		}),
		...(everyRange.status.size > 0 && {
			status: { ranges: statusRanges, allRanges: Object.fromEntries(everyRange.status) },
		}),
		...(cursor && {
			cursor: {
				lineIndex: at(cursor.lineId),
				charOffset: cursor.charOffset,
				textLength: cursor.textLength,
				...(cursor.type && { type: cursor.type }),
			},
		}),
		bursts: annotations.bursts.map(({ lineId, charOffset, textLength, emoji, count }) => ({
			lineIndex: at(lineId),
			charOffset,
			textLength,
			emoji,
			count,
		})),
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
