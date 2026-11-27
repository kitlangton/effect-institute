/**
 * Line Manifest Builder - Phase 1 of compilation.
 *
 * Walks the Animation tree once, collecting:
 * - What lines exist (with their content AST nodes)
 * - When each line is visible (which snapshots)
 * - Line ordering per snapshot
 *
 * @module
 */

import { Array as Arr, pipe } from "effect"
import { type Animation, resolveSlotValue, type Snapshot } from "../animation"

// ============================================================================
// Types
// ============================================================================

/** A line discovered during manifest building */
export interface ManifestLine {
	/** Full line ID (including section prefix) */
	readonly id: string
	/** The AST node containing this line's content (for Phase 2 compilation) */
	readonly content: Animation
	/** Snapshot indices where this line is visible */
	readonly visibleIn: readonly number[]
}

/** The complete manifest of lines from an Animation */
export interface LineManifest {
	/** All lines discovered, in declaration order */
	readonly lines: readonly ManifestLine[]
	/** Line ID ordering for each snapshot */
	readonly lineOrder: ReadonlyMap<number, readonly string[]>
}

// ============================================================================
// Context
// ============================================================================

interface ManifestContext {
	/** All snapshots we're building for */
	readonly snapshots: readonly Snapshot[]
	/** Current section path (for namespacing line IDs) */
	readonly sectionPath: readonly string[]
	/** Current slot path (for disambiguating auto-lines) */
	readonly slotPath: readonly string[]
	/** Which snapshot indices are currently active (based on slot conditions) */
	readonly activeSnapshots: readonly number[]
}

// ============================================================================
// Main Builder
// ============================================================================

/**
 * Build a manifest of all lines in an Animation.
 *
 * Single walk of the AST, grouping by slot values to determine visibility.
 */
export function buildManifest(animation: Animation, snapshots: readonly Snapshot[]): LineManifest {
	const lines: ManifestLine[] = []
	const lineOrder = new Map<number, string[]>()

	// Initialize line order arrays
	for (let i = 0; i < snapshots.length; i++) {
		lineOrder.set(i, [])
	}

	const ctx: ManifestContext = {
		snapshots,
		sectionPath: [],
		slotPath: [],
		activeSnapshots: Arr.range(0, snapshots.length - 1),
	}

	walkStructure(animation, ctx, lines, lineOrder)

	return { lines, lineOrder }
}

// ============================================================================
// Tree Walker
// ============================================================================

function walkStructure(
	node: Animation,
	ctx: ManifestContext,
	lines: ManifestLine[],
	lineOrder: Map<number, string[]>,
): void {
	switch (node._tag) {
		case "Empty":
			break

		case "Text":
			// Text at structure level - should be inside a Line, ignore
			break

		case "Line": {
			const id = ctx.sectionPath.length > 0 ? `${ctx.sectionPath.join("/")}/${node.id}` : node.id

			lines.push({
				id,
				content: node.content,
				visibleIn: ctx.activeSnapshots,
			})

			// Add to line order for each active snapshot
			for (const idx of ctx.activeSnapshots) {
				lineOrder.get(idx)!.push(id)
			}
			break
		}

		case "Stack":
			for (const child of node.parts) {
				walkStructure(child, ctx, lines, lineOrder)
			}
			break

		case "Concat":
			// Concat at structure level - flatten children
			for (const child of node.parts) {
				walkStructure(child, ctx, lines, lineOrder)
			}
			break

		case "Slot": {
			// Group active snapshots by which value they select
			const groups = groupSnapshotsBySlotValue(ctx.activeSnapshots, ctx.snapshots, node)

			// Walk each branch with its snapshot subset, tracking slot path
			for (const [valueName, indices] of Object.entries(groups)) {
				const value = node.values[valueName]
				if (value && indices.length > 0) {
					walkStructure(
						value,
						{
							...ctx,
							activeSnapshots: indices,
							slotPath: [...ctx.slotPath, `${node.name}:${valueName}`],
						},
						lines,
						lineOrder,
					)
				}
			}
			break
		}

		case "Section":
			walkStructure(node.content, { ...ctx, sectionPath: [...ctx.sectionPath, node.name] }, lines, lineOrder)
			break
	}
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Group snapshot indices by which value a slot has.
 * Uses Effect's groupBy for clean functional grouping.
 */
function groupSnapshotsBySlotValue(
	activeSnapshots: readonly number[],
	snapshots: readonly Snapshot[],
	slot: Extract<Animation, { readonly _tag: "Slot" }>,
): Record<string, number[]> {
	return pipe(
		activeSnapshots,
		Arr.groupBy((idx) => {
			const snap = snapshots[idx]
			return resolveSlotValue(slot, snap[slot.name] as string | undefined) ?? "hidden"
		}),
	) as Record<string, number[]>
}
