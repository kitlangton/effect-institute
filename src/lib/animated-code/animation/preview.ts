/**
 * Animation preview utilities for debugging.
 *
 * Renders animation snapshots to plain text for CLI inspection, and resolves
 * annotations to the character ranges the runtime compiler would highlight.
 */

import {
	type Annotation,
	Bright,
	Burst,
	Cursor,
	Focus,
	Glow,
	Mark,
	Say,
	Sound,
	Spotlight,
	Squiggle,
	Status,
} from "@/lib/animated-code/annotations/schema"
import { compileFlow, type StepBuilder } from "@/lib/animated-code/flow"
import type { Animation } from "./animation"
import { collectSimpleRanges, findPatternGlobally, indexLines, resolveFocusedLines } from "./compile/pattern-matching"
import { type RenderedLine, render } from "./render"

/** How an annotation finds its text (mirrors the annotation schema's text-target fields) */
export interface TextTargetPreview {
	text: string
	/** Which match (1-based). The runtime defaults to 1. */
	nth?: number
	/** Only search after this pattern */
	after?: string
	/** Match anywhere instead of smart word boundaries */
	substring?: boolean
}

/** Spotlight pattern: text anywhere, or text (or the whole line) on one line ID */
export type SpotlightPatternPreview = string | { line: string; text?: string }

/** Extracted annotation info for display */
export interface AnnotationPreview {
	cursor?: TextTargetPreview & { type?: string }
	bright?: Array<TextTargetPreview & { color?: string }>
	focus?: string[]
	spotlight?: { patterns: SpotlightPatternPreview[]; dim?: number; glow?: boolean }
	glow?: Array<TextTargetPreview & { color?: string }>
	squiggle?: Array<TextTargetPreview & { color?: string }>
	mark?: Array<TextTargetPreview & { color?: string }>
	burst?: TextTargetPreview & { emoji: string }
	status?: Array<TextTargetPreview & { status: string }>
	say?: string
	sound?: string
}

/** A single step preview showing what renders at that point */
export interface StepPreview {
	/** Step index (0 = initial/base) */
	index: number
	/** Step name (from flow) */
	name: string
	/** Trigger word (or "start" for initial) */
	triggerWord: string
	/** Which occurrence of the word (1-based) */
	nth?: number
	/** Only match after this word appears */
	after?: string
	/** Rendered code as plain text lines */
	codeLines: string[]
	/** IDs of the lines that have one (not index-aligned with codeLines; use renderedLines[i].id for that) */
	lineIds?: string[]
	/** Rendered lines with parts and sources for stability analysis */
	renderedLines: readonly RenderedLine[]
	/** Current slot values */
	slots: Record<string, string>
	/** Active annotations at this step */
	annotations: AnnotationPreview
}

function textTarget(ann: {
	text: string
	nth?: number | undefined
	after?: string | undefined
	substring?: boolean | undefined
}): TextTargetPreview {
	return {
		text: ann.text,
		...(ann.nth !== undefined ? { nth: ann.nth } : {}),
		...(ann.after !== undefined ? { after: ann.after } : {}),
		...(ann.substring !== undefined ? { substring: ann.substring } : {}),
	}
}

function colored(ann: Parameters<typeof textTarget>[0] & { color?: string | undefined }) {
	return { ...textTarget(ann), ...(ann.color !== undefined ? { color: ann.color } : {}) }
}

/** Extract annotation preview from snapshot annotations array */
export function extractAnnotations(annotations: readonly Annotation[]): AnnotationPreview {
	const result: AnnotationPreview = {}

	for (const ann of annotations) {
		if (ann instanceof Cursor) {
			result.cursor = { ...textTarget(ann), ...(ann.type !== undefined ? { type: ann.type } : {}) }
		} else if (ann instanceof Bright) {
			;(result.bright ??= []).push(colored(ann))
		} else if (ann instanceof Focus) {
			result.focus = [...ann.lines]
		} else if (ann instanceof Spotlight) {
			result.spotlight = {
				patterns: ann.patterns.map((p) =>
					typeof p === "string" ? p : { line: p.line, ...(p.text !== undefined ? { text: p.text } : {}) },
				),
				...(ann.dim !== undefined ? { dim: ann.dim } : {}),
				...(ann.glow !== undefined ? { glow: ann.glow } : {}),
			}
		} else if (ann instanceof Glow) {
			;(result.glow ??= []).push(colored(ann))
		} else if (ann instanceof Squiggle) {
			;(result.squiggle ??= []).push(colored(ann))
		} else if (ann instanceof Mark) {
			;(result.mark ??= []).push(colored(ann))
		} else if (ann instanceof Burst) {
			const emoji = typeof ann.emoji === "string" ? ann.emoji : ann.emoji[0]
			result.burst = { ...textTarget(ann), emoji }
		} else if (ann instanceof Status) {
			;(result.status ??= []).push({ ...textTarget(ann), status: ann.status })
		} else if (ann instanceof Say) {
			result.say = ann.text
		} else if (ann instanceof Sound) {
			result.sound = ann.name
		}
	}

	return result
}

/**
 * Preview all animation steps.
 * Compiles flow and renders each snapshot to plain text.
 */
export function previewSteps(
	animation: Animation,
	base: Record<string, string> | undefined,
	flow: StepBuilder[],
): StepPreview[] {
	// Compile flow to get steps and snapshots
	const { steps, snapshots } = compileFlow(base, [...flow], animation)

	// Render each snapshot to plain text
	const previews: StepPreview[] = []
	for (let i = 0; i < snapshots.length; i++) {
		const snapshot = snapshots[i]
		const step = steps[i]

		// Render animation with snapshot
		const rendered = render(animation, snapshot)
		const codeLines = rendered.lines.map((line) => line.parts.map((p) => p.content).join(""))
		const lineIds = rendered.lines.map((line) => line.id).filter((id): id is string => id !== null)

		// Extract slot values from snapshot (filter out annotations)
		const slots: Record<string, string> = {}
		for (const [key, value] of Object.entries(snapshot)) {
			if (!key.startsWith("_") && key !== "annotations" && typeof value === "string") {
				slots[key] = value
			}
		}

		// Extract annotations
		const rawAnnotations = (snapshot.annotations as Annotation[] | undefined) ?? []
		const annotations = extractAnnotations(rawAnnotations)

		previews.push({
			index: i,
			name: step.name,
			triggerWord: step.at,
			...(step.nth && { nth: step.nth }),
			...(step.after && { after: step.after }),
			codeLines,
			lineIds,
			renderedLines: rendered.lines,
			slots,
			annotations,
		})
	}

	return previews
}

// ============================================================================
// Annotation Location
// ============================================================================

/** Annotation kinds that highlight a character range */
export type RangeAnnotationKind = "cursor" | "burst" | "bright" | "glow" | "squiggle" | "mark" | "status" | "spotlight"

/** Where an annotation lands in the rendered code */
export interface AnnotationLocation {
	readonly kind: RangeAnnotationKind
	/** 1-based line number into codeLines */
	readonly line: number
	readonly start: number
	readonly end: number
}

/** An annotation whose target text is not in this step's code */
export interface AnnotationMiss {
	readonly kind: RangeAnnotationKind
	readonly target: TextTargetPreview | SpotlightPatternPreview
}

export interface LocatedAnnotations {
	readonly locations: readonly AnnotationLocation[]
	readonly missing: readonly AnnotationMiss[]
	/** 1-based line numbers the focus annotation keeps undimmed */
	readonly focusedLines: ReadonlySet<number>
}

/** Stand-in ID for rendered lines without one, so line lookups stay index-aligned */
const lineKey = (line: RenderedLine, index: number) => line.id ?? `__line_${index + 1}__`

/**
 * Resolve a step's annotations to character ranges with the runtime compiler's
 * matching rules: `nth` (default 1), `after`, and smart word boundaries unless
 * `substring`; spotlight patterns match every occurrence (optionally on one line ID).
 */
export function locateAnnotations(
	preview: Pick<StepPreview, "codeLines" | "renderedLines" | "annotations">,
): LocatedAnnotations {
	const keys = preview.codeLines.map((_, i) => {
		const line = preview.renderedLines[i]
		return line ? lineKey(line, i) : `__line_${i + 1}__`
	})
	const lines = indexLines(preview.codeLines.map((text, i) => ({ id: keys[i], text })))
	const lineNumber = new Map(keys.map((key, i) => [key, i + 1]))
	const ann = preview.annotations

	const locations: AnnotationLocation[] = []
	const missing: AnnotationMiss[] = []

	const locate = (kind: RangeAnnotationKind, target: TextTargetPreview) => {
		const match = findPatternGlobally(lines, target.text, {
			nth: target.nth ?? 1,
			after: target.after,
			substring: target.substring,
		})
		const line = match ? lineNumber.get(match.lineId) : undefined
		if (match && line !== undefined) locations.push({ kind, line, start: match.start, end: match.end })
		else missing.push({ kind, target })
	}

	if (ann.cursor) locate("cursor", ann.cursor)
	for (const spec of ann.bright ?? []) locate("bright", spec)
	if (ann.burst) locate("burst", ann.burst)
	for (const spec of ann.glow ?? []) locate("glow", spec)
	for (const spec of ann.squiggle ?? []) locate("squiggle", spec)
	for (const spec of ann.mark ?? []) locate("mark", spec)
	for (const spec of ann.status ?? []) locate("status", spec)

	for (const pattern of ann.spotlight?.patterns ?? []) {
		const ranges = collectSimpleRanges(lines, [pattern])
		const entries = Object.entries(ranges).filter(([, r]) => r.length > 0)
		if (entries.length === 0) missing.push({ kind: "spotlight", target: pattern })
		for (const [key, lineRanges] of entries) {
			const line = lineNumber.get(key)
			if (line === undefined) continue
			for (const r of lineRanges) locations.push({ kind: "spotlight", line, start: r.start, end: r.end })
		}
	}

	const focused = ann.focus ? resolveFocusedLines(lines, ann.focus) : []
	const focusedLines = new Set(focused.map((key) => lineNumber.get(key)).filter((n): n is number => n !== undefined))

	return { locations, missing, focusedLines }
}

/** Describe a text target with its non-default options, e.g. `"isEnable" (nth=2, after="mock")` */
export function describeTarget(target: TextTargetPreview | SpotlightPatternPreview): string {
	if (typeof target === "string") return `"${target}"`
	if ("line" in target)
		return target.text !== undefined ? `"${target.text}" (line=${target.line})` : `line ${target.line}`
	const opts = [
		target.nth !== undefined && target.nth !== 1 ? `nth=${target.nth}` : "",
		target.after !== undefined ? `after="${target.after}"` : "",
		target.substring ? "substring" : "",
	].filter(Boolean)
	return `"${target.text}"${opts.length > 0 ? ` (${opts.join(", ")})` : ""}`
}
