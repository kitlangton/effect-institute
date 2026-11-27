import type { Token } from "./highlighter"

/* ------------------------------------------------------------------ */
/* Frame-Based Slideshow Data Model                                    */
/*                                                                     */
/* Each frame is a complete snapshot of what to render.                */
/* No lookups, no computation at render time.                          */
/* ------------------------------------------------------------------ */

/**
 * A part within a line, pre-computed for this frame.
 */
export interface FramePartVersion {
	key: string
	tokens: Token[]
}

export interface FramePart {
	partId: string
	tokens: Token[]
	/** Key for React/Framer Motion - changes trigger crossfade animation */
	motionKey: string
	/** Whether this part needs crossfade animation (content changes between frames) */
	crossfade: boolean
	/** Whether to animate entry (part appeared after line) */
	animateEntry: boolean
	/** Whether this part is visible in this frame (false = exiting, for exit animation) */
	isVisible: boolean
	/** Inline component variant (e.g., "output" for console output box) */
	inline?: string
	/**
	 * All content versions for crossfade parts. Rendered persistently so
	 * version switches animate without mount/unmount races.
	 */
	versions?: readonly FramePartVersion[]
	/** Key into {@link versions} identifying the active version this frame */
	activeVersionKey?: string
}

/**
 * A line within a frame, pre-computed for rendering.
 */
export interface FrameLine {
	lineId: string
	parts: FramePart[]
	/** Pre-computed full line text (for overlay positioning) */
	text: string
	/** Whether this line is entering (new this frame) */
	entering: boolean
	/** Background style for this line */
	background?: "success" | "error" | "warning" | "info"
	/** Whether this line should be dimmed (focus mode, not focused) */
	dimmed: boolean
}

/** Range within a line (character offsets) */
export interface CharRange {
	start: number
	end: number
}

/** Range with optional color */
export interface ColoredRange extends CharRange {
	color?: string
}

/** Status indicator range */
export interface StatusRange extends CharRange {
	status: "running" | "success" | "error" | "interrupted" | "die"
}

/**
 * Cursor target info.
 */
export interface CursorInfo {
	lineIndex: number
	charOffset: number
	textLength: number
	type?: "pointer" | "hand" | "thumbsDown"
	click?: boolean
}

/**
 * Burst effect info.
 */
export interface BurstInfo {
	lineIndex: number
	charOffset: number
	textLength: number
	emoji: string[]
	count: number
}

/**
 * Annotation overlay info (mark, glow, squiggle, etc.)
 * Pre-resolved to line index instead of lineId.
 */
export interface AnnotationOverlay extends CharRange {
	lineIndex: number
	color?: string
}

/**
 * Spotlight config for a frame.
 */
export interface SpotlightConfig {
	/** Ranges per line index */
	ranges: Record<number, CharRange[]>
	/** All ranges that will ever be spotlit (for stable DOM), keyed by line ID */
	allRanges: Record<string, CharRange[]>
	dim: number
	glow: boolean
}

/**
 * Status indicator config.
 */
export interface StatusConfig {
	/** Current status ranges per line index */
	ranges: Record<number, StatusRange[]>
	/** All status ranges across all frames (for stable DOM), keyed by line ID */
	allRanges: Record<string, CharRange[]>
}

/**
 * A complete frame - everything needed to render one snapshot.
 * No lookups required at render time.
 */
export interface Frame {
	id: number
	lines: FrameLine[]

	// Annotation overlays (pre-resolved to line indices)
	marks: AnnotationOverlay[]
	glows: AnnotationOverlay[]
	squiggles: AnnotationOverlay[]
	brightRanges: AnnotationOverlay[]

	// Spotlight (needs special handling for animation)
	spotlight?: SpotlightConfig

	// Status indicators
	status?: StatusConfig

	// Cursor
	cursor?: CursorInfo

	// Bursts
	bursts: BurstInfo[]

	// Sound
	sound?: string

	// Cursor speech bubble
	say?: string
}

/**
 * Frame-based slideshow data (legacy format).
 * Each frame is self-contained - just render frames[snapshotId].
 */
export interface SlideshowData {
	frames: Frame[]
}

/* ------------------------------------------------------------------ */
/* Template + State Format (Compressed)                                */
/*                                                                     */
/* Separates static structure (template) from per-frame state.         */
/* ~10-15x smaller than frame-based format.                            */
/* ------------------------------------------------------------------ */

/**
 * A part in the template - contains tokens and optional versions for crossfade.
 */
export interface TemplatePart {
	tokens: Token[]
	/** If part content changes (crossfade), map version key -> tokens */
	versions?: Record<string, Token[]>
	/** Whether to animate entry (part appeared after line) */
	animateEntry: boolean
	/** Whether this part needs crossfade animation */
	crossfade: boolean
	/** Inline component variant (e.g., "output") */
	inline?: string
}

/**
 * A line in the template - all parts that can appear in this line.
 */
export interface TemplateLine {
	parts: Record<string, TemplatePart>
	/** Part IDs in render order (preserves correct ordering) */
	partOrder: string[]
}

/**
 * Template containing all static content.
 */
export interface Template {
	lines: Record<string, TemplateLine>
}

/**
 * Per-line state in a frame.
 */
export interface LineState {
	entering?: boolean
	dimmed?: boolean
	background?: "success" | "error" | "warning" | "info"
	/** Part visibility: true/false, or version key string for crossfade */
	parts: Record<string, boolean | string>
}

/**
 * State for a single frame - just what varies from template.
 */
export interface FrameState {
	id: number
	/** Line IDs in display order */
	lineOrder: string[]
	/** Per-line state */
	state: Record<string, LineState>

	// Annotations (these vary per frame)
	marks: AnnotationOverlay[]
	glows: AnnotationOverlay[]
	squiggles: AnnotationOverlay[]
	brightRanges: AnnotationOverlay[]
	spotlight?: SpotlightConfig
	status?: StatusConfig
	cursor?: CursorInfo
	bursts: BurstInfo[]
	sound?: string
	say?: string
}

/**
 * Compressed slideshow data using template + state separation.
 */
export interface TemplateSlideshowData {
	template: Template
	frames: FrameState[]
}

/* ------------------------------------------------------------------ */
/* Component Props                                                     */
/* ------------------------------------------------------------------ */

export interface NeoCodeBlockProps {
	data: TemplateSlideshowData
	snapshot: number
	className?: string
	style?: React.CSSProperties
}
