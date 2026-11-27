/**
 * Pure formatting for `narrate steps`: renders a step preview as annotated text.
 *
 * @module
 */

import type { EvaluatedLine } from "@/lib/animated-code/animation/compile/evaluate"
import {
	type AnnotationLocation,
	describeTarget,
	locateAnnotations,
	type StepPreview,
} from "@/lib/animated-code/animation/preview"
import type { Burst, Cursor } from "@/lib/animated-code/annotations"

export const STEPS_LEGEND =
	"▸ focused | <cursor> <burst> <bright> <glow> <squiggle> <mark> <status> <spotlight> | Δ «slot» changed content"

const LINE_NUM_WIDTH = 3
const GUTTER = "│ "

/** Transcript words around `wordIdx`, with the trigger word in brackets. */
export function transcriptContext(words: readonly string[], wordIdx: number, triggerWord: string): string {
	if (wordIdx === -1) {
		if (triggerWord === "start") return "(section start)"
		return `"${triggerWord}" (not found)`
	}

	const start = Math.max(0, wordIdx - 3)
	const end = Math.min(words.length, wordIdx + 4)
	const contextWords = words.slice(start, end).map((w, i) => (start + i === wordIdx ? `[${w}]` : w))
	const prefix = start > 0 ? "..." : ""
	const suffix = end < words.length ? "..." : ""
	return `${prefix}${contextWords.join(" ")}${suffix}`
}

/**
 * Wrap annotated ranges of a line in `<tag>…</tag>` markers.
 * Nested ranges nest properly; at equal spans tags open alphabetically.
 */
export function annotateLine(
	line: string,
	annotations: ReadonlyArray<{ readonly start: number; readonly end: number; readonly tag: string }>,
): string {
	if (annotations.length === 0) return line

	const insertions: Array<{ pos: number; text: string; priority: number; isOpen: boolean }> = []
	for (const ann of annotations) {
		// Priority at the same position:
		// - Open tags: larger span (larger end) opens first
		// - Close tags: inner (started later = larger start) closes first
		insertions.push({ pos: ann.start, text: `<${ann.tag}>`, priority: ann.end, isOpen: true })
		insertions.push({ pos: ann.end, text: `</${ann.tag}>`, priority: ann.start, isOpen: false })
	}

	insertions.sort((a, b) => {
		if (a.pos !== b.pos) return a.pos - b.pos
		if (a.priority !== b.priority) return b.priority - a.priority
		// Same position and priority: open tags before close tags
		if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1
		// Same range: opens alphabetical, closes reverse alphabetical to match nesting
		if (a.isOpen) return a.text.localeCompare(b.text)
		return b.text.localeCompare(a.text)
	})

	let result = ""
	let lastPos = 0
	for (const ins of insertions) {
		result += line.slice(lastPos, ins.pos) + ins.text
		lastPos = ins.pos
	}
	return result + line.slice(lastPos)
}

/** "Slots:" line - every slot on the first step, otherwise only the ones that changed. */
export function slotSummary(preview: StepPreview, prevSlots: Readonly<Record<string, string>>): string | undefined {
	if (preview.index === 0) {
		const slotStr = Object.entries(preview.slots)
			.map(([k, v]) => `${k}=${v}`)
			.join(", ")
		return slotStr ? `Slots: ${slotStr}` : undefined
	}
	const changes = Object.entries(preview.slots)
		.filter(([key, curr]) => prevSlots[key] !== curr)
		.map(([key, curr]) => `${key}: ${prevSlots[key]} → ${curr}`)
	return changes.length > 0 ? `Slots: ${changes.join(", ")}` : undefined
}

/** The line with text from slots that changed this step marked `«…»`, if any. */
function stabilityLine(line: EvaluatedLine, changedSlots: ReadonlySet<string>): string | undefined {
	if (changedSlots.size === 0) return undefined

	let marked = ""
	let hasChangedParts = false
	for (const run of line.runs) {
		if (run.slot !== undefined && changedSlots.has(run.slot)) {
			if (run.text) {
				marked += `«${run.text}»`
				hasChangedParts = true
			}
		} else {
			marked += run.text
		}
	}
	return hasChangedParts ? marked : undefined
}

function summaryLine(preview: StepPreview, located: ReturnType<typeof locateAnnotations>): string | undefined {
	// The last of each is the one that shows
	let cursor: Cursor | undefined
	let burst: Burst | undefined
	let say: string | undefined
	let sound: string | undefined
	for (const ann of preview.annotations) {
		if (ann._tag === "Cursor") cursor = ann
		else if (ann._tag === "Burst") burst = ann
		else if (ann._tag === "Say") say = ann.text
		else if (ann._tag === "Sound") sound = ann.name
	}
	const isMissing = (kind: AnnotationLocation["kind"]) => located.missing.some((m) => m.kind === kind)
	const parts: string[] = []

	if (cursor) {
		const loc = located.locations.find((l) => l.kind === "cursor")
		const posInfo = loc ? `L${loc.line}:${loc.start}-${loc.end}` : "(not found!)"
		parts.push(`cursor: ${describeTarget(cursor)} ${posInfo}`)
	}
	if (burst) {
		const emoji = typeof burst.emoji === "string" ? burst.emoji : burst.emoji[0]
		parts.push(`burst: ${describeTarget(burst)} ${emoji}${isMissing("burst") ? " (not found!)" : ""}`)
	}
	if (say !== undefined) parts.push(`say: "${say}"`)
	if (sound) parts.push(`sound: ${sound}`)
	for (const miss of located.missing) {
		if (miss.kind === "cursor" || miss.kind === "burst") continue
		parts.push(`${miss.kind}: ${describeTarget(miss.target)} (not found!)`)
	}

	return parts.length > 0 ? `  ${parts.join(" | ")}` : undefined
}

/**
 * Lines printed for a code step after its header and transcript line:
 * slot changes, annotated code (with Δ stability lines), and an annotation summary.
 */
export function formatCodeStepBody(preview: StepPreview, prevSlots: Readonly<Record<string, string>>): string[] {
	const out: string[] = []
	const slots = slotSummary(preview, prevSlots)
	if (slots) out.push(slots)
	out.push("")

	const located = locateAnnotations(preview)
	const changedSlots = new Set(
		preview.index > 0 ? Object.keys(preview.slots).filter((name) => prevSlots[name] !== preview.slots[name]) : [],
	)

	preview.lines.forEach((line, i) => {
		const lineNum = i + 1
		const focusMarker = located.focusedLines.has(lineNum) ? "▸" : " "
		const ranges = located.locations
			.filter((loc) => loc.line === lineNum)
			.map((loc) => ({ start: loc.start, end: loc.end, tag: loc.kind }))
		out.push(`${focusMarker}${String(lineNum).padStart(LINE_NUM_WIDTH)}${GUTTER}${annotateLine(line.text, ranges)}`)

		const stability = stabilityLine(line, changedSlots)
		if (stability !== undefined) out.push(`${" ".repeat(1 + LINE_NUM_WIDTH)}Δ ${stability}`)
	})

	const summary = summaryLine(preview, located)
	if (summary) out.push("", summary)
	return out
}

/** "State:" line for a component step - full state first, then changed keys. */
export function componentStateSummary(
	index: number,
	snapshot: Readonly<Record<string, unknown>>,
	prevState: Readonly<Record<string, unknown>>,
): string | undefined {
	if (index === 0) {
		const stateStr = Object.entries(snapshot)
			.map(([k, v]) => `${k}=${JSON.stringify(v)}`)
			.join(", ")
		return `State: ${stateStr}`
	}
	const changes = Object.entries(snapshot)
		.filter(([key, curr]) => JSON.stringify(prevState[key]) !== JSON.stringify(curr))
		.map(([key, curr]) => `${key}: ${JSON.stringify(prevState[key])} → ${JSON.stringify(curr)}`)
	return changes.length > 0 ? `State: ${changes.join(", ")}` : undefined
}
