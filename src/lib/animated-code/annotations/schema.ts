/**
 * # Annotation Schema
 *
 * Type-safe annotation definitions using Effect Schema TaggedClass.
 * Each annotation type is a discriminated union variant with `_tag` field.
 *
 * @example
 * ```typescript
 * import { Mark, Status, Spotlight } from "@/lib/animated-code/annotations"
 *
 * const annotations = [
 *   new Mark({ text: "Promise", color: "yellow" }),
 *   new Status({ text: "fetchUser", status: "running" }),
 *   new Spotlight({ patterns: ["async", "await"] }),
 * ]
 * ```
 */

import { Schema } from "effect"

// ============================================================================
// Common Fields
// ============================================================================

/**
 * Common fields for text-targeting annotations.
 * Most annotations find text by pattern matching.
 */
const TextTargetFields = {
	/** Pattern to match in the code */
	text: Schema.String,
	/** Which match (1-indexed). Default: 1. Use 0 for all matches. */
	nth: Schema.optional(Schema.Number),
	/** Only search after this pattern appears */
	after: Schema.optional(Schema.String),
	/** Match anywhere vs smart boundary matching. Default: false (smart boundary). */
	substring: Schema.optional(Schema.Boolean),
}

// ============================================================================
// Character-level Annotations (rendered as text effects or overlays)
// ============================================================================

/**
 * Highlight text with a colored underline/background mark.
 * Rendered as SVG overlay.
 */
export class Mark extends Schema.TaggedClass<Mark>()("Mark", {
	...TextTargetFields,
	/** Highlight color. Default: yellow */
	color: Schema.optional(Schema.String),
}) {}

/**
 * Add glow effect behind text (subtle blur).
 * Rendered as SVG overlay.
 */
export class Glow extends Schema.TaggedClass<Glow>()("Glow", {
	...TextTargetFields,
	/** Glow color. Default: currentColor */
	color: Schema.optional(Schema.String),
}) {}

/**
 * Wavy underline like IDE error squiggles.
 * Rendered as SVG overlay.
 */
export class Squiggle extends Schema.TaggedClass<Squiggle>()("Squiggle", {
	...TextTargetFields,
	/** Squiggle color. Default: red */
	color: Schema.optional(Schema.String),
}) {}

/**
 * Brighten text with glow (text-shadow effect).
 * Rendered via CSS text-shadow.
 */
export class Bright extends Schema.TaggedClass<Bright>()("Bright", {
	...TextTargetFields,
	/** Bright color. Default: currentColor */
	color: Schema.optional(Schema.String),
}) {}

/**
 * Status indicator next to text (running/success/error/interrupted/die).
 * Rendered as inline DOM element.
 */
export class Status extends Schema.TaggedClass<Status>()("Status", {
	...TextTargetFields,
	/** Status state */
	status: Schema.Literals(["running", "success", "error", "interrupted", "die"]),
}) {}

// ============================================================================
// Point Annotations (single location targets)
// ============================================================================

/**
 * Cursor/pointer at a text location.
 * Rendered as positioned DOM element.
 */
export class Cursor extends Schema.TaggedClass<Cursor>()("Cursor", {
	...TextTargetFields,
	/** Cursor icon type. Default: hand */
	type: Schema.optional(Schema.Literals(["pointer", "hand", "thumbsDown"])),
}) {}

/**
 * Emoji burst particles from text.
 * Rendered as animated DOM elements.
 */
export class Burst extends Schema.TaggedClass<Burst>()("Burst", {
	...TextTargetFields,
	/** Emoji(s) to burst */
	emoji: Schema.Union([Schema.String, Schema.Array(Schema.String)]),
	/** Number of particles. Default: 5 */
	count: Schema.optional(Schema.Number),
}) {}

/**
 * Speech bubble attached to the cursor - lets the pointer comment on the
 * code ("hideous", "nice", ...). Transient: shown for one step.
 * Rendered as a chat bubble floating below-right of the cursor.
 */
export class Say extends Schema.TaggedClass<Say>()("Say", {
	/** What the cursor says */
	text: Schema.String,
}) {}

// ============================================================================
// Line-level Annotations
// ============================================================================

/**
 * Focus on specific lines (dims others).
 * Takes line ID patterns or content patterns.
 */
export class Focus extends Schema.TaggedClass<Focus>()("Focus", {
	/** Line IDs or content patterns to focus */
	lines: Schema.Array(Schema.String),
}) {}

/**
 * Spotlight pattern - can be:
 * - string: match text anywhere
 * - { line }: spotlight entire line
 * - { line, text }: match text only on that line
 */
export const SpotlightPattern = Schema.Union([
	Schema.String,
	Schema.Struct({
		text: Schema.optional(Schema.String),
		line: Schema.String,
	}),
])
export type SpotlightPattern = Schema.Schema.Type<typeof SpotlightPattern>

/**
 * Spotlight specific text (dims rest of line).
 * More granular than focus.
 */
export class Spotlight extends Schema.TaggedClass<Spotlight>()("Spotlight", {
	/** Patterns to spotlight */
	patterns: Schema.Array(SpotlightPattern),
	/** Dim opacity for non-spotlit text. Default: 0.4 */
	dim: Schema.optional(Schema.Number),
	/** Add glow to spotlit text. Default: false */
	glow: Schema.optional(Schema.Boolean),
}) {}

/**
 * Background color for a specific line.
 */
export class Background extends Schema.TaggedClass<Background>()("Background", {
	/** Line ID to color */
	lineId: Schema.String,
	/** Background style preset */
	style: Schema.Literals(["success", "error", "warning", "info"]),
}) {}

/** Names of the sound effects a step can play */
export const AnimationSoundName = Schema.Literals([
	"tick",
	"pop",
	"whoosh",
	"sad",
	"celebrate",
	"chime",
	"success",
	"error",
	"alarm",
	"doom",
	"spooky",
	"press",
	"fail",
	"succeed",
	"ping1",
	"ping2",
	"ping3",
	"derp",
	"skip",
])
export type AnimationSoundName = typeof AnimationSoundName.Type

/**
 * Sound effect to play.
 */
export class Sound extends Schema.TaggedClass<Sound>()("Sound", {
	name: AnimationSoundName,
}) {}

// ============================================================================
// Union Type
// ============================================================================

/** All annotation types as a discriminated union */
export const Annotation = Schema.Union([
	Mark,
	Glow,
	Squiggle,
	Bright,
	Status,
	Cursor,
	Burst,
	Say,
	Focus,
	Spotlight,
	Background,
	Sound,
])

/** Annotation type (union of all variants) */
export type Annotation = Schema.Schema.Type<typeof Annotation>

// ============================================================================
// Type Guards (using instanceof)
// ============================================================================

/** Check if annotation targets text (has TextTargetFields) */
export function hasTextTarget(ann: Annotation): ann is Mark | Glow | Squiggle | Bright | Status | Cursor | Burst {
	return (
		ann instanceof Mark ||
		ann instanceof Glow ||
		ann instanceof Squiggle ||
		ann instanceof Bright ||
		ann instanceof Status ||
		ann instanceof Cursor ||
		ann instanceof Burst
	)
}

/** Check if annotation is a character-range type */
export function isCharRangeAnnotation(ann: Annotation): ann is Mark | Glow | Squiggle | Bright | Status {
	return (
		ann instanceof Mark ||
		ann instanceof Glow ||
		ann instanceof Squiggle ||
		ann instanceof Bright ||
		ann instanceof Status
	)
}

/** Check if annotation is a point-location type */
export function isPointAnnotation(ann: Annotation): ann is Cursor | Burst {
	return ann instanceof Cursor || ann instanceof Burst
}
