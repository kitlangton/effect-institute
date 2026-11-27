/**
 * Pattern matching utilities for finding text in code.
 *
 * Used by the compiler to resolve annotation patterns to character ranges.
 *
 * @module
 */

import type { EvaluatedLine } from "./evaluate"

// ============================================================================
// Types
// ============================================================================

/** Line with pre-computed content string (internal to pattern matching) */
interface LineWithContent {
	lineId: string
	content: string
}

/** Global match result with line context */
interface GlobalMatch {
	lineId: string
	start: number
	end: number
}

/** Options for pattern matching */
interface PatternMatchOptions {
	/** Which match (1-based, default 1). Use 0 for all matches. */
	nth?: number | undefined
	/** Match as substring anywhere (default: false = smart boundary matching) */
	substring?: boolean | undefined
	/** Only search after this pattern appears */
	after?: string | undefined
}

// ============================================================================
// Line Indexing
// ============================================================================

/** Convert evaluated lines to pattern-matching format */
export function indexLines(lines: readonly EvaluatedLine[]): LineWithContent[] {
	return lines.map((l) => ({
		lineId: l.id,
		content: l.text,
	}))
}

// ============================================================================
// Word Boundary Detection
// ============================================================================

/**
 * Check if a character is a word character (alphanumeric or underscore)
 */
function isWordChar(char: string | undefined): boolean {
	if (!char) return false
	return /\w/.test(char)
}

/**
 * Check if the match at given position is a full word (bounded by non-word characters)
 */
function isWordBoundary(content: string, pattern: string, start: number, end: number): boolean {
	// Empty patterns "match" trivially (shouldn't happen in practice)
	if (pattern.length === 0) return true

	// "Smart" boundaries:
	// - If the pattern starts with a word char, require a left boundary.
	// - If the pattern ends with a word char, require a right boundary.
	//
	// This makes punctuation targets like ": any" or ".pipe" work without requiring
	// explicit substring matching, while still preventing accidental partial matches
	// for word-like patterns (e.g. "foo" won't match inside "foobar").
	const requiresLeftBoundary = isWordChar(pattern[0])
	const requiresRightBoundary = isWordChar(pattern[pattern.length - 1])

	const charBefore = content[start - 1]
	const charAfter = content[end]
	return (!requiresLeftBoundary || !isWordChar(charBefore)) && (!requiresRightBoundary || !isWordChar(charAfter))
}

// ============================================================================
// Pattern Finding
// ============================================================================

/**
 * Find a pattern in content, with word-boundary matching by default.
 * Returns the index or -1 if not found.
 * @param substring - If true, match anywhere. If false (default), match word boundaries only.
 */
function findPattern(content: string, pattern: string, searchFrom: number, substring: boolean): number {
	let idx = content.indexOf(pattern, searchFrom)
	while (idx !== -1) {
		if (substring || isWordBoundary(content, pattern, idx, idx + pattern.length)) {
			return idx
		}
		idx = content.indexOf(pattern, idx + 1)
	}
	return -1
}

/**
 * Find the starting position for searching after an "after" anchor.
 * @returns Starting position, or null if anchor not found
 */
function findAfterAnchor(lines: LineWithContent[], after: string): { lineIndex: number; charOffset: number } | null {
	for (let i = 0; i < lines.length; i++) {
		const afterIdx = findPattern(lines[i].content, after, 0, true)
		if (afterIdx !== -1) {
			return { lineIndex: i, charOffset: afterIdx + after.length }
		}
	}
	return null
}

/**
 * Find the Nth match of a pattern globally across all lines.
 * @param lines - Pre-indexed lines with content
 * @param pattern - Text to find
 * @param opts - Matching options (nth, substring, after)
 * @returns Match with line context, or null if not found
 */
export function findPatternGlobally(
	lines: LineWithContent[],
	pattern: string,
	opts: PatternMatchOptions = {},
): GlobalMatch | null {
	const { nth = 1, substring = false, after } = opts

	// Find starting position (after anchor if specified)
	let startLineIndex = 0
	let startCharOffset = 0
	if (after) {
		const anchor = findAfterAnchor(lines, after)
		if (!anchor) return null
		startLineIndex = anchor.lineIndex
		startCharOffset = anchor.charOffset
	}

	let globalCount = 0
	for (let i = startLineIndex; i < lines.length; i++) {
		const { lineId, content } = lines[i]
		const searchStart = i === startLineIndex ? startCharOffset : 0

		let idx = findPattern(content, pattern, searchStart, substring)
		while (idx !== -1) {
			globalCount++
			if (globalCount === nth) {
				return { lineId, start: idx, end: idx + pattern.length }
			}
			idx = findPattern(content, pattern, idx + 1, substring)
		}
	}
	return null
}

/**
 * Find ALL occurrences of a pattern globally across all lines.
 * @param lines - Pre-indexed lines with content
 * @param pattern - Text to find
 * @param opts - Matching options (substring, after)
 * @returns Array of matches with line context
 */
export function findAllPatternsGlobally(
	lines: LineWithContent[],
	pattern: string,
	opts: Omit<PatternMatchOptions, "nth"> = {},
): GlobalMatch[] {
	const { substring = false, after } = opts
	const matches: GlobalMatch[] = []

	// Find starting position (after anchor if specified)
	let startLineIndex = 0
	let startCharOffset = 0
	if (after) {
		const anchor = findAfterAnchor(lines, after)
		if (!anchor) return matches
		startLineIndex = anchor.lineIndex
		startCharOffset = anchor.charOffset
	}

	for (let i = startLineIndex; i < lines.length; i++) {
		const { lineId, content } = lines[i]
		const searchStart = i === startLineIndex ? startCharOffset : 0

		let idx = findPattern(content, pattern, searchStart, substring)
		while (idx !== -1) {
			matches.push({ lineId, start: idx, end: idx + pattern.length })
			idx = findPattern(content, pattern, idx + 1, substring)
		}
	}
	return matches
}

/**
 * Find pattern positions in content (per-line).
 * @param content - Text to search in
 * @param pattern - Text to find
 * @param nth - 0 = all matches, N = Nth match only (1-based)
 * @returns Array of { start, end } positions
 */
function findPatternPositions(content: string, pattern: string, nth: number): Array<{ start: number; end: number }> {
	const positions: Array<{ start: number; end: number }> = []

	if (nth === 0) {
		// Find all matches
		let idx = content.indexOf(pattern)
		while (idx !== -1) {
			positions.push({ start: idx, end: idx + pattern.length })
			idx = content.indexOf(pattern, idx + 1)
		}
	} else {
		// Find nth match (1-based)
		let idx = -1
		let count = 0
		let searchFrom = 0
		while ((idx = content.indexOf(pattern, searchFrom)) !== -1) {
			count++
			if (count === nth) {
				positions.push({ start: idx, end: idx + pattern.length })
				break
			}
			searchFrom = idx + 1
		}
	}

	return positions
}

// ============================================================================
// Range Collection Helpers
// ============================================================================

/** Helper to conditionally add ranges to config */
export function addIfNonEmpty<C, T>(config: C, key: keyof C, ranges: Record<string, T[]>): void {
	if (Object.keys(ranges).length > 0) {
		;(config as Record<string, unknown>)[key as string] = ranges
	}
}

/** Spotlight pattern type: string or { line, text? } */
type SpotlightPattern = string | { readonly line: string; readonly text?: string | undefined }

/**
 * Collect all pattern matches as simple ranges (no extra properties).
 * @param lines - Pre-indexed lines
 * @param patterns - Array of patterns (string or { line, text? })
 *   - string: match text anywhere
 *   - { line, text }: match text only on that line
 *   - { line }: spotlight entire line
 */
export function collectSimpleRanges(
	lines: LineWithContent[],
	patterns: SpotlightPattern[],
): Record<string, Array<{ start: number; end: number }>> {
	const ranges: Record<string, Array<{ start: number; end: number }>> = {}

	for (const pattern of patterns) {
		if (typeof pattern === "string") {
			// Simple text pattern: match anywhere
			for (const { lineId, content } of lines) {
				const positions = findPatternPositions(content, pattern, 0) // 0 = all occurrences
				for (const pos of positions) {
					if (!ranges[lineId]) ranges[lineId] = []
					ranges[lineId].push(pos)
				}
			}
		} else {
			// Line-constrained pattern
			const targetLine = lines.find((l) => l.lineId === pattern.line)
			if (targetLine) {
				if (!ranges[targetLine.lineId]) ranges[targetLine.lineId] = []
				if (pattern.text) {
					// Match specific text on this line
					const positions = findPatternPositions(targetLine.content, pattern.text, 0)
					for (const pos of positions) {
						ranges[targetLine.lineId].push(pos)
					}
				} else {
					// Spotlight entire line
					ranges[targetLine.lineId].push({ start: 0, end: targetLine.content.length })
				}
			}
		}
	}

	return ranges
}

/**
 * Resolve focus patterns to line IDs.
 * Priority: if any pattern matches a line ID exactly, use ID matching only.
 * Otherwise fall back to content substring matching.
 */
export function resolveFocusedLines(lines: LineWithContent[], patterns: string[]): string[] {
	const lineIds = new Set(lines.map((l) => l.lineId))
	const patternsMatchingIds = patterns.filter((p) => lineIds.has(p))
	const useIdMatchingOnly = patternsMatchingIds.length > 0

	const focused: string[] = []

	for (const { lineId, content } of lines) {
		for (const pattern of patterns) {
			if (lineId === pattern) {
				if (!focused.includes(lineId)) focused.push(lineId)
			} else if (!useIdMatchingOnly && content.includes(pattern)) {
				if (!focused.includes(lineId)) focused.push(lineId)
			}
		}
	}

	return focused
}
