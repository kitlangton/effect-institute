/**
 * Line part compilation - converts Animation content to Parts.
 *
 * Simple algorithm:
 * - Text nodes → single-version parts
 * - Concat → recurse, flatten
 * - Slot with same value in all snapshots → recurse into that value
 * - Slot with different values → collapse to multi-version part
 *
 * All parts have a versions array. Single-version = stable, multi-version = animated.
 *
 * Part IDs are path-based for stability:
 * - Built from slot path + sequential index within that path
 * - Adding/removing slots elsewhere doesn't shift existing IDs
 *
 * @module
 */

import { type Animation, resolveSlotValue, type Snapshot } from "../animation"
import { evaluateToText } from "./evaluate"

// ============================================================================
// Types
// ============================================================================

/** A version of a part's content */
export interface PartVersion {
	fromSnapshot: number
	toSnapshot: number | null
	text: string
}

/** A compiled part */
export interface Part {
	partId: string
	visibleFrom: number
	visibleTo: number | null
	versions: PartVersion[]
	/** Inline component variant (e.g., "output") */
	inline?: string
}

/** Intermediate part with path context */
type AstPart =
	| {
			kind: "single"
			text: string
			visibleFrom: number
			visibleTo: number | null
			path: readonly string[]
			inline?: string
	  }
	| {
			kind: "multi"
			versions: Map<string, number[]>
			path: readonly string[]
			inline?: string
	  }

/** Context for compilation */
interface CompileContext {
	readonly snapshots: readonly Snapshot[]
	readonly indices: readonly number[]
	/** Current slot path for stable part IDs */
	readonly slotPath: readonly string[]
}

// ============================================================================
// Main Entry Point
// ============================================================================

/** Compile Animation content to Parts (IDs are path-based for stability). */
export function compileLineContentFromAST(
	anim: Animation,
	snapshots: readonly Snapshot[],
	snapshotIndices: readonly number[],
): Part[] {
	const ctx: CompileContext = {
		snapshots,
		indices: snapshotIndices,
		slotPath: [],
	}
	const astParts = compileToAstParts(anim, ctx)
	return finalize(astParts)
}

// ============================================================================
// Core Algorithm
// ============================================================================

function compileToAstParts(anim: Animation, ctx: CompileContext): AstPart[] {
	const { snapshots, indices, slotPath } = ctx

	switch (anim._tag) {
		case "Empty":
			return []

		case "Text": {
			const visibleFrom = indices.length > 0 ? Math.min(...indices) : 0
			const visibleTo = indices.length > 0 ? Math.max(...indices) : null
			return [
				{
					kind: "single",
					text: anim.content,
					visibleFrom,
					visibleTo,
					path: slotPath,
				},
			]
		}

		case "Concat":
			return anim.parts.flatMap((p) => compileToAstParts(p, ctx))

		case "Slot": {
			// Group indices by their selected value
			const valueToIndices = new Map<string, number[]>()
			for (const snapIdx of indices) {
				const valueName = resolveSlotValue(anim, snapshots[snapIdx][anim.name] as string | undefined)
				if (valueName === undefined) continue
				const existing = valueToIndices.get(valueName)
				if (existing) {
					existing.push(snapIdx)
				} else {
					valueToIndices.set(valueName, [snapIdx])
				}
			}

			// If only one value selected across all visible snapshots, recurse
			// with updated slot path
			if (valueToIndices.size === 1) {
				const [valueName] = [...valueToIndices.keys()]
				const value = anim.values[valueName]
				// Treat text("") as empty (same as Empty node)
				if (!value || value._tag === "Empty" || (value._tag === "Text" && value.content === "")) return []
				const newCtx: CompileContext = {
					...ctx,
					slotPath: [...slotPath, `${anim.name}:${valueName}`],
				}
				return compileToAstParts(value, newCtx)
			}

			// Multiple values - check if we can preserve inner structure
			// Categorize values as empty vs non-empty
			// Note: text("") is treated as empty (same as Empty node)
			const emptyValueNames: string[] = []
			const nonEmptyValueNames: string[] = []
			for (const [valueName] of valueToIndices) {
				const value = anim.values[valueName]
				const isEmptyValue = !value || value._tag === "Empty" || (value._tag === "Text" && value.content === "")
				if (isEmptyValue) {
					emptyValueNames.push(valueName)
				} else {
					nonEmptyValueNames.push(valueName)
				}
			}

			// Special case: exactly one non-empty value (rest are empty)
			// Recurse into the non-empty value with just its indices
			// This preserves inner structure for the non-empty case
			// BUT only if the indices are consecutive! Non-consecutive indices
			// (e.g., [1, 3] for hidden→shown→hidden→shown) can't be represented
			// as a simple visibleFrom/visibleTo range.
			if (nonEmptyValueNames.length === 1) {
				const nonEmptyName = nonEmptyValueNames[0]
				const nonEmptyIndices = valueToIndices.get(nonEmptyName)!

				// Check if indices are consecutive
				const sortedIndices = [...nonEmptyIndices].sort((a, b) => a - b)
				const isConsecutive = sortedIndices.every((idx, i) => i === 0 || idx === sortedIndices[i - 1] + 1)

				if (isConsecutive) {
					const value = anim.values[nonEmptyName]
					const newCtx: CompileContext = {
						...ctx,
						indices: nonEmptyIndices,
						slotPath: [...slotPath, `${anim.name}:${nonEmptyName}`],
					}
					return compileToAstParts(value, newCtx)
				}
				// Non-consecutive: fall through to multi-version handling
			}

			// Multiple non-empty values - collapse to single multi-version part
			// Use slot name in path (no specific value since it varies)
			const versions = new Map<string, number[]>()
			for (const snapIdx of indices) {
				const text = evaluateToText(anim, snapshots[snapIdx])
				const existing = versions.get(text)
				if (existing) {
					existing.push(snapIdx)
				} else {
					versions.set(text, [snapIdx])
				}
			}

			// If all evaluate to same text, it's actually single-version
			if (versions.size === 1) {
				const [text] = versions.keys()
				const visibleFrom = Math.min(...indices)
				return [
					{
						kind: "single",
						text,
						visibleFrom,
						visibleTo: null,
						path: [...slotPath, `${anim.name}:*`],
					},
				]
			}

			return [
				{
					kind: "multi",
					versions,
					path: [...slotPath, `${anim.name}:*`],
				},
			]
		}

		case "Inline": {
			// Inline is like Text but with variant metadata for special rendering
			const visibleFrom = indices.length > 0 ? Math.min(...indices) : 0
			const visibleTo = indices.length > 0 ? Math.max(...indices) : null
			return [
				{
					kind: "single",
					text: anim.content,
					visibleFrom,
					visibleTo,
					path: slotPath,
					inline: anim.variant,
				},
			]
		}

		// Line/Stack/Section shouldn't appear inside line content, but handle gracefully
		case "Line":
			return compileToAstParts(anim.content, ctx)

		case "Stack":
			return anim.parts.flatMap((p) => compileToAstParts(p, ctx))

		case "Section":
			return compileToAstParts(anim.content, ctx)
	}
}

// ============================================================================
// Finalization
// ============================================================================

/**
 * Build part ID from slot path.
 * Groups parts by path and assigns sequential indices within each path.
 */
function finalize(astParts: AstPart[]): Part[] {
	const result: Part[] = []

	// Track index per path for sequential numbering within each slot context
	const pathCounters = new Map<string, number>()

	for (const p of astParts) {
		const pathKey = p.path.join("/")
		const pathIndex = pathCounters.get(pathKey) ?? 0
		pathCounters.set(pathKey, pathIndex + 1)

		// Build stable part ID: path/index (always include prefix to avoid numeric-only keys)
		const partId = pathKey ? `${pathKey}/${pathIndex}` : `p${pathIndex}`

		if (p.kind === "single") {
			if (p.text.length === 0) continue
			const part: Part = {
				partId,
				visibleFrom: p.visibleFrom,
				visibleTo: p.visibleTo,
				versions: [{ fromSnapshot: p.visibleFrom, toSnapshot: null, text: p.text }],
			}
			if (p.inline) part.inline = p.inline
			result.push(part)
		} else {
			// Multi - convert Map to versions array with ranges
			const versions = buildVersionRanges(p.versions)
			const allIndices = [...p.versions.values()].flat()
			const visibleFrom = Math.min(...allIndices)
			const visibleTo = Math.max(...allIndices)

			const part: Part = {
				partId,
				visibleFrom,
				visibleTo,
				versions,
			}
			if (p.inline) part.inline = p.inline
			result.push(part)
		}
	}

	return result
}

/**
 * Convert snapshot indices to version ranges.
 * Groups consecutive indices into {fromSnapshot, toSnapshot, text} entries.
 */
function buildVersionRanges(versions: Map<string, number[]>): PartVersion[] {
	const result: PartVersion[] = []

	// Sort by first nth
	const sorted = [...versions.entries()].sort((a, b) => Math.min(...a[1]) - Math.min(...b[1]))

	for (const [text, indices] of sorted) {
		const sortedIndices = [...indices].sort((a, b) => a - b)

		// Group consecutive indices
		let start = sortedIndices[0]
		let end = sortedIndices[0]

		for (let i = 1; i < sortedIndices.length; i++) {
			if (sortedIndices[i] === end + 1) {
				end = sortedIndices[i]
			} else {
				result.push({ fromSnapshot: start, toSnapshot: end, text })
				start = sortedIndices[i]
				end = sortedIndices[i]
			}
		}
		result.push({ fromSnapshot: start, toSnapshot: end, text })
	}

	return result
}

// ============================================================================
// Part Query Helpers
// ============================================================================

/** Check if a part is visible at a given snapshot */
export function isPartVisible(part: Part, snapshotId: number): boolean {
	if (snapshotId < part.visibleFrom) return false
	if (part.visibleTo !== null && snapshotId > part.visibleTo) return false
	return true
}

/** Get the version of a part at a given snapshot */
export function getPartVersion(part: Part, snapshotId: number): PartVersion | undefined {
	return part.versions.find(
		(v) => snapshotId >= v.fromSnapshot && (v.toSnapshot === null || snapshotId <= v.toSnapshot),
	)
}

/** Check if a part has multiple versions (needs crossfade) */
export function hasMultipleVersions(part: Part): boolean {
	if (part.versions.length > 1) return true
	// Single version but with gaps means it appears/disappears with different content
	const v = part.versions[0]
	return v.toSnapshot !== null && v.toSnapshot !== part.visibleTo
}
