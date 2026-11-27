/**
 * The compiled code slideshow: the wire format the build writes and the player reads.
 *
 * A slideshow stores every line's content once in a template, then one small state per frame
 * (line order, part visibility, resolved annotations). {@link expandFrame} turns one frame state
 * back into the complete {@link Frame} the renderer draws.
 *
 * Field order in these schemas is the order the compiler emits, so decoding at build time
 * writes the same bytes.
 *
 * @module
 */

import { Schema } from "effect"
import { AnimationSoundName, CursorType, LineBackground, StatusKind } from "@/lib/animated-code/annotations"

// ============================================================================
// Wire Format
// ============================================================================

/** A syntax-highlighted run of text */
export const Token = Schema.Struct({
	text: Schema.String,
	type: Schema.Literals([
		"keyword",
		"type",
		"string",
		"number",
		"operator",
		"comment",
		"identifier",
		"punctuation",
		"default",
	]),
	/** Inline color from the highlighter */
	color: Schema.optionalKey(Schema.String),
})
export type Token = typeof Token.Type

/** One part of a line: its default tokens, plus every distinct rendering when it has more than one */
export const TemplatePart = Schema.Struct({
	tokens: Schema.Array(Token),
	/** Whether to animate entry (part appears after its line) */
	animateEntry: Schema.Boolean,
	/** Whether the part's text changes between frames */
	crossfade: Schema.Boolean,
	/** Inline component variant (e.g. "output") */
	inline: Schema.optionalKey(Schema.String),
	/** Version key -> tokens, for parts rendered more than one way (new text, or new colors from context) */
	versions: Schema.optionalKey(Schema.Record(Schema.String, Schema.Array(Token))),
})
export type TemplatePart = typeof TemplatePart.Type

export const TemplateLine = Schema.Struct({
	parts: Schema.Record(Schema.String, TemplatePart),
	/** Part IDs in render order */
	partOrder: Schema.Array(Schema.String),
})
export type TemplateLine = typeof TemplateLine.Type

export const Template = Schema.Struct({
	lines: Schema.Record(Schema.String, TemplateLine),
})
export type Template = typeof Template.Type

export const LineState = Schema.Struct({
	/** Per part: hidden (false), visible with its only rendering (true), or visible with this version key */
	parts: Schema.Record(Schema.String, Schema.Union([Schema.Boolean, Schema.String])),
	entering: Schema.optionalKey(Schema.Boolean),
	dimmed: Schema.optionalKey(Schema.Boolean),
	background: Schema.optionalKey(LineBackground),
})
export type LineState = typeof LineState.Type

/** Character range within a line */
export const CharRange = Schema.Struct({ start: Schema.Number, end: Schema.Number })
export type CharRange = typeof CharRange.Type

export const StatusRange = Schema.Struct({ start: Schema.Number, end: Schema.Number, status: StatusKind })
export type StatusRange = typeof StatusRange.Type

/** A mark, glow, squiggle or bright range on the line at `lineIndex` in this frame */
export const Overlay = Schema.Struct({
	lineIndex: Schema.Number,
	start: Schema.Number,
	end: Schema.Number,
	color: Schema.optionalKey(Schema.String),
})
export type Overlay = typeof Overlay.Type

export const CursorTarget = Schema.Struct({
	lineIndex: Schema.Number,
	charOffset: Schema.Number,
	textLength: Schema.Number,
	type: Schema.optionalKey(CursorType),
})
export type CursorTarget = typeof CursorTarget.Type

export const BurstTarget = Schema.Struct({
	lineIndex: Schema.Number,
	charOffset: Schema.Number,
	textLength: Schema.Number,
	emoji: Schema.Array(Schema.String),
	count: Schema.Number,
})
export type BurstTarget = typeof BurstTarget.Type

export const Spotlight = Schema.Struct({
	/** This frame's spotlit ranges, keyed by line index */
	ranges: Schema.Record(Schema.String, Schema.Array(CharRange)),
	/** Every range spotlit in any frame, keyed by line ID, so token spans stay stable across frames */
	allRanges: Schema.Record(Schema.String, Schema.Array(CharRange)),
	dim: Schema.Number,
	glow: Schema.Boolean,
})
export type Spotlight = typeof Spotlight.Type

export const StatusIndicators = Schema.Struct({
	/** This frame's indicators, keyed by line index */
	ranges: Schema.Record(Schema.String, Schema.Array(StatusRange)),
	/** Every indicator position in any frame, keyed by line ID */
	allRanges: Schema.Record(Schema.String, Schema.Array(CharRange)),
})
export type StatusIndicators = typeof StatusIndicators.Type

export const FrameState = Schema.Struct({
	id: Schema.Number,
	/** Line IDs in display order */
	lineOrder: Schema.Array(Schema.String),
	state: Schema.Record(Schema.String, LineState),
	marks: Schema.Array(Overlay),
	glows: Schema.Array(Overlay),
	squiggles: Schema.Array(Overlay),
	brightRanges: Schema.Array(Overlay),
	spotlight: Schema.optionalKey(Spotlight),
	status: Schema.optionalKey(StatusIndicators),
	cursor: Schema.optionalKey(CursorTarget),
	bursts: Schema.Array(BurstTarget),
	sound: Schema.optionalKey(AnimationSoundName),
	/** Cursor speech bubble */
	say: Schema.optionalKey(Schema.String),
})
export type FrameState = typeof FrameState.Type

export const CodeSlideshow = Schema.Struct({
	template: Template,
	frames: Schema.Array(FrameState),
})
export type CodeSlideshow = typeof CodeSlideshow.Type

// ============================================================================
// Render Frame
// ============================================================================

export interface FramePartVersion {
	readonly key: string
	readonly tokens: readonly Token[]
}

/** A part as the renderer draws it in one frame */
export interface FramePart {
	readonly partId: string
	readonly tokens: readonly Token[]
	/** React key; changes with the version for crossfade parts */
	readonly motionKey: string
	readonly crossfade: boolean
	readonly animateEntry: boolean
	/** False while the part is hidden (it stays mounted to animate out) */
	readonly isVisible: boolean
	readonly inline?: string
	/** Every rendering of a multi-version part, mounted together so switches animate without remounts */
	readonly versions?: readonly FramePartVersion[]
	/** Key into {@link versions} of this frame's rendering */
	readonly activeVersionKey?: string
}

export interface FrameLine {
	readonly lineId: string
	readonly parts: readonly FramePart[]
	/** Text of the visible parts (what overlays measure against) */
	readonly text: string
	/** New this frame */
	readonly entering: boolean
	readonly background?: LineBackground
	/** Dimmed by line focus */
	readonly dimmed: boolean
}

/** Everything the renderer needs for one frame */
export interface Frame extends Omit<FrameState, "lineOrder" | "state"> {
	readonly lines: readonly FrameLine[]
}

/** Text of a part's tokens; also the version key of its first rendering */
export const tokensText = (tokens: readonly Token[]): string => tokens.map((t) => t.text).join("")

/** Expand one frame state against the template into the complete frame. */
export function expandFrame(frameState: FrameState, template: Template): Frame {
	const lines: FrameLine[] = frameState.lineOrder.map((lineId) => {
		const templateLine = template.lines[lineId]
		const lineState = frameState.state[lineId]

		const parts: FramePart[] = templateLine.partOrder.map((partId) => {
			const templatePart = templateLine.parts[partId]
			const partState = lineState.parts[partId]
			// A version key may be "" (a slot whose value is empty text), so test for false, not falsiness
			const isVisible = partState !== undefined && partState !== false

			let tokens = templatePart.tokens
			if (typeof partState === "string" && templatePart.versions) {
				tokens = templatePart.versions[partState] ?? templatePart.tokens
			}

			const motionKey = templatePart.crossfade && typeof partState === "string" ? `${partId}-${partState}` : partId

			let versions: FramePartVersion[] | undefined
			let activeVersionKey: string | undefined
			if (templatePart.versions) {
				versions = Object.entries(templatePart.versions).map(([key, versionTokens]) => ({
					key,
					tokens: versionTokens,
				}))
				activeVersionKey = typeof partState === "string" ? partState : tokensText(templatePart.tokens)
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

		return {
			lineId,
			parts,
			text: parts
				.filter((p) => p.isVisible)
				.map((p) => tokensText(p.tokens))
				.join(""),
			entering: lineState.entering ?? false,
			dimmed: lineState.dimmed ?? false,
			...(lineState.background && { background: lineState.background }),
		}
	})

	const { lineOrder: _lineOrder, state: _state, ...annotations } = frameState
	return { ...annotations, lines }
}
