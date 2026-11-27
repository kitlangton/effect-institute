export type SvgEffectVisualState = "idle" | "running" | "completed" | "failed" | "interrupted" | "death"

export interface SvgEffectNodeSpec {
	id: string
	name: string
	visualState: SvgEffectVisualState
	result?: string
	resultScale?: number
	error?: string
	showLog?: boolean
	logMessage?: string
	/** When true, node animates out (scale/blur/fade) and doesn't contribute to layout */
	hidden?: boolean
}

/**
 * A node in the hierarchical effect tree.
 *
 * Visual state can be explicitly set or omitted to derive from children automatically.
 */
export interface HierarchicalEffectNode {
	id: string
	name: string
	visualState?: SvgEffectVisualState
	result?: string
	resultScale?: number
	error?: string
	showLog?: boolean
	logMessage?: string
	children?: HierarchicalEffectNode[]
}
