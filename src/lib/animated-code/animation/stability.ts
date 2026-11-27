/**
 * Stability analysis for animations.
 *
 * Detects when text that should be stable is accidentally placed inside a slot.
 * If the same text appears in all values of a slot, it should be extracted
 * outside the slot for better animation stability.
 *
 * @module
 */

import type { Animation } from "./animation"
import { render } from "./render"

/** A warning about a potential stability issue */
export interface StabilityWarning {
	/** Name of the slot with the issue */
	slotName: string
	/** The common text that appears in all values */
	commonText: string
	/** The slot values that all contain this text */
	values: string[]
}

/**
 * Render an animation subtree to plain text.
 */
function renderToText(animation: Animation): string {
	// Render with empty snapshot (slots use first value or "hidden")
	const result = render(animation, {})
	return result.lines.map((line) => line.parts.map((p) => p.content).join("")).join("\n")
}

/**
 * Find the longest common substring between two strings.
 * Returns the substring and its length.
 */
function longestCommonSubstring(a: string, b: string): { text: string; length: number } {
	if (a.length === 0 || b.length === 0) return { text: "", length: 0 }

	// Build a matrix of common substring lengths
	const matrix: number[][] = Array(a.length + 1)
		.fill(null)
		.map(() => Array(b.length + 1).fill(0))

	let maxLength = 0
	let endIndex = 0

	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			if (a[i - 1] === b[j - 1]) {
				matrix[i][j] = matrix[i - 1][j - 1] + 1
				if (matrix[i][j] > maxLength) {
					maxLength = matrix[i][j]
					endIndex = i
				}
			}
		}
	}

	return {
		text: a.slice(endIndex - maxLength, endIndex),
		length: maxLength,
	}
}

/**
 * Find common substrings across all strings in an array.
 * Returns substrings that appear in ALL strings and are at least minLength chars.
 */
function findCommonSubstrings(strings: string[], minLength: number = 5): string[] {
	if (strings.length < 2) return []

	// Start with first string, find common parts with each subsequent string
	let candidates = [strings[0]]

	for (let i = 1; i < strings.length; i++) {
		const nextCandidates: string[] = []
		for (const candidate of candidates) {
			const lcs = longestCommonSubstring(candidate, strings[i])
			if (lcs.length >= minLength) {
				nextCandidates.push(lcs.text)
			}
		}
		candidates = nextCandidates
		if (candidates.length === 0) break
	}

	// Filter to meaningful substrings (not just whitespace)
	return candidates.filter((s) => s.trim().length >= minLength)
}

/**
 * Collect all slots from an animation tree.
 */
function collectSlots(animation: Animation): Array<{ name: string; values: Record<string, Animation> }> {
	const slots: Array<{ name: string; values: Record<string, Animation> }> = []

	function walk(node: Animation): void {
		switch (node._tag) {
			case "Slot":
				slots.push({ name: node.name, values: node.values })
				// Also walk into slot values to find nested slots
				for (const value of Object.values(node.values)) {
					walk(value)
				}
				break
			case "Concat":
			case "Stack":
				for (const part of node.parts) {
					walk(part)
				}
				break
			case "Line":
			case "Section":
				walk(node.content)
				break
			case "Text":
			case "Empty":
				// Leaf nodes, nothing to do
				break
		}
	}

	walk(animation)
	return slots
}

/**
 * Analyze an animation for stability issues.
 * Returns warnings for any slots that have common text across all values.
 */
export function analyzeStability(animation: Animation): StabilityWarning[] {
	const warnings: StabilityWarning[] = []
	const slots = collectSlots(animation)

	for (const slot of slots) {
		const valueNames = Object.keys(slot.values).filter((k) => k !== "hidden")
		if (valueNames.length < 2) continue // Need at least 2 values to compare

		// Render each value to text
		const renderedValues: Record<string, string> = {}
		for (const name of valueNames) {
			renderedValues[name] = renderToText(slot.values[name])
		}

		// Find common substrings across all rendered values
		const renderedTexts = valueNames.map((name) => renderedValues[name])
		const commonSubstrings = findCommonSubstrings(renderedTexts, 3)

		for (const common of commonSubstrings) {
			// Skip if it's just punctuation or very short
			if (common.trim().length < 3) continue
			// Skip if it's just whitespace or newlines
			if (/^[\s\n]+$/.test(common)) continue

			warnings.push({
				slotName: slot.name,
				commonText: common,
				values: valueNames,
			})
		}
	}

	return warnings
}
