/**
 * Animation Evaluation - what an Animation shows for given slot values.
 *
 * The one implementation of slot selection: the compiler, the steps preview, build validation
 * and the section's initial code all read lines through here.
 *
 * @module
 */

import { type Animation, resolveSlotValue, type SlotValues } from "../animation"
import { buildManifest } from "./manifest"

/** A run of a line's text, and the innermost slot it came from (none for static text) */
export interface TextRun {
	readonly text: string
	readonly slot?: string
}

/** A line as one snapshot shows it */
export interface EvaluatedLine {
	readonly id: string
	readonly text: string
	readonly runs: readonly TextRun[]
}

/** The text runs an Animation shows. Stacks inside line content are joined with newlines. */
export function evaluateRuns(content: Animation, slots: SlotValues, slot?: string): TextRun[] {
	const run = (text: string): TextRun[] => [slot === undefined ? { text } : { text, slot }]
	switch (content._tag) {
		case "Empty":
			return []
		case "Text":
		case "Inline":
			return run(content.content)
		case "Concat":
			return content.parts.flatMap((p) => evaluateRuns(p, slots, slot))
		case "Slot": {
			// A value the slot doesn't define (including the reserved "hidden") shows nothing
			const valueName = resolveSlotValue(content, slots[content.name])
			const value = valueName === undefined ? undefined : content.values[valueName]
			return value ? evaluateRuns(value, slots, content.name) : []
		}
		// These shouldn't appear inside line content, but handle gracefully
		case "Line":
		case "Section":
			return evaluateRuns(content.content, slots, slot)
		case "Stack":
			return content.parts.flatMap((p, i) => [...(i > 0 ? run("\n") : []), ...evaluateRuns(p, slots, slot)])
	}
}

/** Plain text of an Animation for given slot values (used for pattern matching). */
export function evaluateToText(content: Animation, slots: SlotValues): string {
	return evaluateRuns(content, slots)
		.map((r) => r.text)
		.join("")
}

/**
 * Evaluate manifest lines for one snapshot, in the given order.
 * When two lines share an ID, the last declared content wins.
 */
export function evaluateLinesForSnapshot(
	lines: ReadonlyArray<{ readonly id: string; readonly content: Animation; readonly slot?: string }>,
	lineIds: readonly string[],
	slots: SlotValues,
): EvaluatedLine[] {
	const lineMap = new Map(lines.map((l) => [l.id, l]))
	return lineIds.flatMap((id) => {
		const line = lineMap.get(id)
		if (!line) return []
		const runs = evaluateRuns(line.content, slots, line.slot)
		return [{ id, text: runs.map((r) => r.text).join(""), runs }]
	})
}

/** The code an Animation shows for given slot values, one line per compiled frame line. */
export function evaluateCode(animation: Animation, slots: SlotValues): string {
	return evaluateLines(animation, slots)
		.map((l) => l.text)
		.join("\n")
}

/** The lines an Animation shows for given slot values: exactly the lines of the compiled frame. */
export function evaluateLines(animation: Animation, slots: SlotValues): EvaluatedLine[] {
	const manifest = buildManifest(animation, [{ slots, annotations: [] }])
	return evaluateLinesForSnapshot(manifest.lines, manifest.lineOrder.get(0) ?? [], slots)
}
