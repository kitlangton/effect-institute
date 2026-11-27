/**
 * Animation preview utilities for debugging.
 *
 * Renders animation snapshots to plain text for CLI inspection, and resolves
 * annotations to the character ranges the runtime compiler would highlight.
 */

import type { Annotation, SpotlightPattern } from "@/lib/animated-code/annotations"
import { compileFlow, type StepBuilder } from "@/lib/animated-code/flow"
import type { Animation, SlotValues } from "./animation"
import { type AnnotationMiss, resolveAnnotations, type TargetKind } from "./compile/resolve"
import { type RenderedLine, render } from "./render"

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
	slots: SlotValues
	/** The step's annotations */
	annotations: readonly Annotation[]
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
		const rendered = render(animation, snapshot.slots)
		const codeLines = rendered.lines.map((line) => line.parts.map((p) => p.content).join(""))
		const lineIds = rendered.lines.map((line) => line.id).filter((id): id is string => id !== null)

		previews.push({
			index: i,
			name: step.name,
			triggerWord: step.at,
			...(step.nth && { nth: step.nth }),
			...(step.after && { after: step.after }),
			codeLines,
			lineIds,
			renderedLines: rendered.lines,
			slots: snapshot.slots,
			annotations: snapshot.annotations,
		})
	}

	return previews
}

// ============================================================================
// Annotation Location
// ============================================================================

/** Where an annotation lands in the rendered code */
export interface AnnotationLocation {
	readonly kind: TargetKind
	/** 1-based line number into codeLines */
	readonly line: number
	readonly start: number
	readonly end: number
}

export interface LocatedAnnotations {
	readonly locations: readonly AnnotationLocation[]
	readonly missing: readonly AnnotationMiss[]
	/** 1-based line numbers the focus annotation keeps undimmed */
	readonly focusedLines: ReadonlySet<number>
}

/** Stand-in ID for rendered lines without one, so line lookups stay index-aligned */
const lineKey = (line: RenderedLine, index: number) => line.id ?? `__line_${index + 1}__`

/** Display order for locations and misses */
const KINDS: readonly TargetKind[] = ["cursor", "bright", "burst", "glow", "squiggle", "mark", "status", "spotlight"]

/** Resolve a step's annotations to line numbers and character ranges, the way the compiler resolves them. */
export function locateAnnotations(
	preview: Pick<StepPreview, "codeLines" | "renderedLines" | "annotations">,
): LocatedAnnotations {
	const keys = preview.codeLines.map((_, i) => {
		const line = preview.renderedLines[i]
		return line ? lineKey(line, i) : `__line_${i + 1}__`
	})
	const lineNumber = new Map(keys.map((key, i) => [key, i + 1]))
	const resolved = resolveAnnotations(
		preview.codeLines.map((text, i) => ({ id: keys[i], text })),
		preview.annotations,
	)

	const located: AnnotationLocation[] = []
	const add = (kind: TargetKind, lineId: string, start: number, end: number) => {
		const line = lineNumber.get(lineId)
		if (line !== undefined) located.push({ kind, line, start, end })
	}
	if (resolved.cursor) {
		const { lineId, charOffset, textLength } = resolved.cursor
		add("cursor", lineId, charOffset, charOffset + textLength)
	}
	for (const b of resolved.bursts) add("burst", b.lineId, b.charOffset, b.charOffset + b.textLength)
	for (const r of resolved.brights) add("bright", r.lineId, r.start, r.end)
	for (const r of resolved.glows) add("glow", r.lineId, r.start, r.end)
	for (const r of resolved.squiggles) add("squiggle", r.lineId, r.start, r.end)
	for (const r of resolved.marks) add("mark", r.lineId, r.start, r.end)
	for (const r of resolved.status) add("status", r.lineId, r.start, r.end)
	for (const [lineId, ranges] of Object.entries(resolved.spotlight?.ranges ?? {})) {
		for (const r of ranges) add("spotlight", lineId, r.start, r.end)
	}

	const byKind = <T extends { readonly kind: TargetKind }>(items: readonly T[]) =>
		[...items].sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind))
	const focusedLines = new Set(
		[...(resolved.focusedLineIds ?? [])].map((id) => lineNumber.get(id)).filter((n): n is number => n !== undefined),
	)
	return { locations: byKind(located), missing: byKind(resolved.missing), focusedLines }
}

/** Describe a text target with its non-default options, e.g. `"isEnable" (nth=2, after="mock")` */
export function describeTarget(
	target:
		| {
				readonly text: string
				readonly nth?: number | undefined
				readonly after?: string | undefined
				readonly substring?: boolean | undefined
		  }
		| SpotlightPattern,
): string {
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
