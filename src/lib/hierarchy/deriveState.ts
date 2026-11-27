import type { HierarchicalEffectNode, SvgEffectVisualState } from "./types"

/**
 * Derives the visual state for a node.
 *
 * If the node has an explicit visualState, it takes precedence.
 * Otherwise, state is derived from children using priority:
 * death > failed > interrupted > running > completed > idle
 */
export function deriveVisualState(node: HierarchicalEffectNode): SvgEffectVisualState {
	if (node.visualState !== undefined) {
		return node.visualState
	}

	if (!node.children?.length) {
		return "idle"
	}

	const childStates = node.children.map(deriveVisualState)

	if (childStates.includes("death")) return "death"
	if (childStates.includes("failed")) return "failed"
	if (childStates.includes("interrupted")) return "interrupted"
	if (childStates.includes("running")) return "running"
	if (childStates.every((s) => s === "completed")) return "completed"

	return "idle"
}
