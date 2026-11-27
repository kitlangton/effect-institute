/**
 * Compresses frame-based SlideshowData into template + state format.
 *
 * Achieves ~10-15x size reduction by:
 * 1. Extracting all unique line/part content into a template (stored once)
 * 2. Storing only visibility state per frame
 *
 * @module
 */

import type { Token } from "./highlighter"
import type {
	Frame,
	FrameLine,
	FramePart,
	FrameState,
	LineState,
	SlideshowData,
	Template,
	TemplateLine,
	TemplateSlideshowData,
} from "./types"

/**
 * Compress SlideshowData to TemplateSlideshowData.
 *
 * Lossless for every visible part: `expandFrame(compress(d).frames[i], template)`
 * reproduces each visible part's tokens (text and colors) from `d.frames[i]`.
 */
export function compress(data: SlideshowData): TemplateSlideshowData {
	const { template, versionKeyOf } = buildTemplate(data.frames)
	const frames = data.frames.map((frame) => buildFrameState(frame, template, versionKeyOf))
	return { template, frames }
}

/** Looks up the version key a visible part's tokens were stored under (undefined = single version). */
type VersionKeyOf = (lineId: string, partId: string, tokens: Token[]) => string | undefined

/** Every distinct visible rendering of one part, in first-seen order. */
interface PartVariants {
	/** Exact token identity (text + color + type) → version key */
	readonly keyByIdentity: Map<string, string>
	readonly tokensByKey: Map<string, Token[]>
}

/**
 * Build template from all frames - collects unique content for each line/part.
 *
 * A part gets `versions` when it is visible with more than one distinct token
 * list: different text (crossfade slots) or the same text highlighted with
 * different colors (Shiki colors depend on the rest of the line). Version keys
 * are the part's text, so existing keys stay readable; a later variant with the
 * same text but different colors gets a `text\u0000n` key.
 */
function buildTemplate(frames: Frame[]): { template: Template; versionKeyOf: VersionKeyOf } {
	const lines: Record<string, TemplateLine> = {}
	const variants = new Map<string, Map<string, PartVariants>>()

	for (const frame of frames) {
		for (const line of frame.lines) {
			if (!lines[line.lineId]) {
				lines[line.lineId] = { parts: {}, partOrder: [] }
				variants.set(line.lineId, new Map())
			}
			const templateLine = lines[line.lineId]
			const lineVariants = variants.get(line.lineId)!

			for (const [partIndex, part] of line.parts.entries()) {
				if (!templateLine.parts[part.partId]) {
					// First time seeing this part - initialize and slot it in right after the
					// part that precedes it in this frame, so render order survives parts
					// that only appear in later frames.
					templateLine.parts[part.partId] = {
						tokens: part.tokens,
						animateEntry: part.animateEntry,
						crossfade: part.crossfade,
						...(part.inline && { inline: part.inline }),
					}
					const previousId = line.parts[partIndex - 1]?.partId
					const insertAt = previousId === undefined ? 0 : templateLine.partOrder.indexOf(previousId) + 1
					templateLine.partOrder.splice(insertAt, 0, part.partId)
					lineVariants.set(part.partId, { keyByIdentity: new Map(), tokensByKey: new Map() })
				}
				if (!part.isVisible) continue

				// Hidden parts are never syntax-highlighted, so only visible renderings count.
				const partVariants = lineVariants.get(part.partId)!
				const identity = tokensToIdentity(part.tokens)
				if (partVariants.keyByIdentity.has(identity)) continue

				const text = tokensToKey(part.tokens)
				let key = text
				for (let n = 1; partVariants.tokensByKey.has(key); n++) key = `${text}\u0000${n}`
				partVariants.keyByIdentity.set(identity, key)
				partVariants.tokensByKey.set(key, part.tokens)
			}
		}
	}

	for (const [lineId, lineVariants] of variants) {
		for (const [partId, { tokensByKey }] of lineVariants) {
			const templatePart = lines[lineId].parts[partId]
			const [first] = tokensByKey.values()
			// The default rendering is the first visible one (hidden-only parts keep their raw tokens)
			if (first) templatePart.tokens = first
			if (tokensByKey.size > 1) templatePart.versions = Object.fromEntries(tokensByKey)
		}
	}

	const versionKeyOf: VersionKeyOf = (lineId, partId, tokens) => {
		const templatePart = lines[lineId]?.parts[partId]
		if (!templatePart?.versions) return undefined
		return variants.get(lineId)?.get(partId)?.keyByIdentity.get(tokensToIdentity(tokens))
	}

	return { template: { lines }, versionKeyOf }
}

/**
 * Build frame state from a frame - extracts just the varying bits.
 */
function buildFrameState(frame: Frame, template: Template, versionKeyOf: VersionKeyOf): FrameState {
	const lineOrder = frame.lines.map((l) => l.lineId)
	const state: Record<string, LineState> = {}

	for (const line of frame.lines) {
		const lineState: LineState = { parts: {} }

		// Only include non-default values
		if (line.entering) lineState.entering = true
		if (line.dimmed) lineState.dimmed = true
		if (line.background) lineState.background = line.background

		// Part visibility (use partOrder for consistent ordering)
		const templateLine = template.lines[line.lineId]
		for (const partId of templateLine.partOrder) {
			const framePart = line.parts.find((p) => p.partId === partId)

			if (!framePart?.isVisible) {
				// Missing from frame or explicitly hidden
				lineState.parts[partId] = false
			} else {
				// Multi-version part: store which version; otherwise simple visibility
				lineState.parts[partId] = versionKeyOf(line.lineId, partId, framePart.tokens) ?? true
			}
		}

		state[line.lineId] = lineState
	}

	return {
		id: frame.id,
		lineOrder,
		state,
		marks: frame.marks,
		glows: frame.glows,
		squiggles: frame.squiggles,
		brightRanges: frame.brightRanges,
		...(frame.spotlight && { spotlight: frame.spotlight }),
		...(frame.status && { status: frame.status }),
		...(frame.cursor && { cursor: frame.cursor }),
		bursts: frame.bursts,
		...(frame.sound && { sound: frame.sound }),
		...(frame.say && { say: frame.say }),
	}
}

/**
 * Create a stable key from tokens for version comparison (the part's text).
 */
function tokensToKey(tokens: Token[]): string {
	return tokens.map((t) => t.text).join("")
}

/** Exact identity of a token list, including highlighting. */
function tokensToIdentity(tokens: Token[]): string {
	return JSON.stringify(tokens.map((t) => [t.text, t.type, t.color ?? null]))
}

/**
 * Expand TemplateSlideshowData back to SlideshowData (for compatibility).
 */
export function expand(data: TemplateSlideshowData): SlideshowData {
	return {
		frames: data.frames.map((frameState) => expandFrame(frameState, data.template)),
	}
}

/**
 * Expand a single frame state into a full Frame.
 */
export function expandFrame(frameState: FrameState, template: Template): Frame {
	const lines: FrameLine[] = frameState.lineOrder.map((lineId) => {
		const templateLine = template.lines[lineId]
		const lineState = frameState.state[lineId]

		// Use partOrder to preserve correct render order
		const parts: FramePart[] = templateLine.partOrder.map((partId) => {
			const templatePart = templateLine.parts[partId]
			const partState = lineState.parts[partId]
			// A version key may be "" (a slot whose value is empty text), so test for false, not falsiness
			const isVisible = partState !== undefined && partState !== false

			// Determine tokens - use version if specified, else default
			let tokens = templatePart.tokens
			if (typeof partState === "string" && templatePart.versions) {
				tokens = templatePart.versions[partState] ?? templatePart.tokens
			}

			// Motion key for crossfade parts includes version
			const motionKey = templatePart.crossfade && typeof partState === "string" ? `${partId}-${partState}` : partId

			// All versions, for persistent crossfade rendering
			let versions: FramePart["versions"]
			let activeVersionKey: string | undefined
			if (templatePart.versions) {
				versions = Object.entries(templatePart.versions).map(([key, versionTokens]) => ({
					key,
					tokens: versionTokens,
				}))
				activeVersionKey = typeof partState === "string" ? partState : tokensToKey(templatePart.tokens)
			}

			return {
				partId,
				tokens,
				motionKey,
				crossfade: templatePart.crossfade,
				animateEntry: templatePart.animateEntry,
				isVisible,
				...(templatePart.inline && { inline: templatePart.inline }),
				...(versions && { versions }),
				...(activeVersionKey !== undefined && { activeVersionKey }),
			}
		})

		// Compute line text from visible parts
		const text = parts
			.filter((p) => p.isVisible)
			.flatMap((p) => p.tokens.map((t) => t.text))
			.join("")

		return {
			lineId,
			parts,
			text,
			entering: lineState.entering ?? false,
			dimmed: lineState.dimmed ?? false,
			...(lineState.background && { background: lineState.background }),
		}
	})

	return {
		id: frameState.id,
		lines,
		marks: frameState.marks,
		glows: frameState.glows,
		squiggles: frameState.squiggles,
		brightRanges: frameState.brightRanges,
		...(frameState.spotlight && { spotlight: frameState.spotlight }),
		...(frameState.status && { status: frameState.status }),
		...(frameState.cursor && { cursor: frameState.cursor }),
		bursts: frameState.bursts,
		...(frameState.sound && { sound: frameState.sound }),
		...(frameState.say && { say: frameState.say }),
	}
}
