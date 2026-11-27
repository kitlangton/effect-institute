/**
 * Animation Evaluation - evaluate Animation content for a specific snapshot.
 *
 * Used for annotation resolution which needs actual text content.
 *
 * @module
 */

import { type Animation, resolveSlotValue, type Snapshot } from "../animation"

/**
 * Evaluate an Animation (line content) to plain text for a given snapshot.
 * Used for pattern matching in annotation resolution.
 */
export function evaluateToText(content: Animation, snapshot: Snapshot): string {
	switch (content._tag) {
		case "Empty":
			return ""

		case "Text":
			return content.content

		case "Concat":
			return content.parts.map((p) => evaluateToText(p, snapshot)).join("")

		case "Slot": {
			const snapshotValue = snapshot[content.name] as string | undefined
			const valueName = resolveSlotValue(content, snapshotValue)
			if (valueName === undefined) return ""
			// "hidden" is reserved to mean empty ONLY for defaultHidden slots
			// that don't have an explicit "hidden" value
			if (valueName === "hidden" && content.defaultHidden && !content.values.hidden) {
				return ""
			}
			const value = content.values[valueName]
			if (!value) return ""
			return evaluateToText(value, snapshot)
		}

		case "Inline":
			return content.content

		// These shouldn't appear inside line content, but handle gracefully
		case "Line":
			return evaluateToText(content.content, snapshot)

		case "Stack":
			return content.parts.map((p) => evaluateToText(p, snapshot)).join("\n")

		case "Section":
			return evaluateToText(content.content, snapshot)
	}
}

/** Line with ID and evaluated text (for annotation pattern matching) */
export interface EvaluatedLine {
	readonly id: string
	readonly text: string
}

/**
 * Evaluate lines for a snapshot from the manifest.
 * Returns lines with their text content for pattern matching.
 */
export function evaluateLinesForSnapshot(
	lines: ReadonlyArray<{ id: string; content: Animation }>,
	lineIds: readonly string[],
	snapshot: Snapshot,
): EvaluatedLine[] {
	const lineMap = new Map(lines.map((l) => [l.id, l.content]))

	return lineIds
		.map((id) => {
			const content = lineMap.get(id)
			if (!content) return null
			return {
				id,
				text: evaluateToText(content, snapshot),
			}
		})
		.filter((l): l is EvaluatedLine => l !== null)
}
