import {
	getBubble,
	getContentScale,
	getContentText,
	getNodeTargetWidth,
	measureMonoText,
	normalizeText,
	type SvgEffectLayoutConfig,
} from "@/lib/hierarchy/svgEffectLayout"
import type { SvgEffectNodeSpec } from "@/lib/hierarchy/types"
import type { PixiEffectArrow } from "../types"
import type { NodeIconKind } from "./icons"

export interface LayoutTargets {
	targetWidths: number[]
	offsetX: number
	baseY: number
}

const NODE_HIDDEN_BLUR = 10

export interface LayoutPalette {
	borderAlpha: number
}

export interface LayoutTuning {
	collapseRunning: boolean
	runningHeightScale: number
	runningScale: number
}

export type SizeOverrides = Record<string, { width: number; height: number }> | undefined
export type NumberOverrides = Record<string, number> | undefined

export interface SpringTransition {
	type: "spring"
	bounce?: number
	visualDuration?: number
}

export interface NodeTarget {
	node: SvgEffectNodeSpec
	isRunning: boolean
	isCompleted: boolean
	isFailed: boolean
	isInterrupted: boolean
	isHidden: boolean
	isEntering: boolean
	baseHeight: number
	targetWidth: number
	targetHeight: number
	widthSpring: SpringTransition
	targetCenterX: number
	targetCenterY: number
	contentOpacityTarget: number
	fillOpacityTarget: number
	borderAlphaTarget: number
	borderAlphaOverride?: number
	borderWidthOverride?: number
	borderColorOverride?: number
	iconOpacityOverride?: number
	labelOpacityTarget: number
	scaleTarget: number
	blurTarget: number
	iconKind: NodeIconKind
	content: string | null
	resultScale: number
	bubble: ReturnType<typeof getBubble>
}

export function computeLayoutTargets({
	nodes,
	layout,
	gap,
	paddingX,
	paddingTop,
	width,
	sizeOverrides,
	arrows,
	gapAfterOverrides,
}: {
	nodes: SvgEffectNodeSpec[]
	layout: SvgEffectLayoutConfig
	gap: number
	paddingX: number
	paddingTop: number
	width: number
	sizeOverrides: SizeOverrides
	arrows: PixiEffectArrow[] | undefined
	gapAfterOverrides: NumberOverrides
}): LayoutTargets {
	let cursorX = 0
	let minEdge = Number.POSITIVE_INFINITY
	let maxEdge = Number.NEGATIVE_INFINITY
	const targetWidths: number[] = []
	for (const [index, node] of nodes.entries()) {
		if (node.hidden) {
			targetWidths.push(0)
			continue
		}
		const override = sizeOverrides?.[node.id]
		const nodeWidth = override
			? override.width
			: node.visualState === "completed"
				? getNodeTargetWidth(node, layout)
				: layout.nodeSize
		targetWidths.push(nodeWidth)

		// Use label width for spacing, but center based on node box width
		const labelWidth = measureMonoText(node.name, layout.labelFontSize, layout.charWidthRatio)
		const layoutWidth = Math.max(nodeWidth, labelWidth)
		const centerX = cursorX + layoutWidth / 2
		minEdge = Math.min(minEdge, centerX - nodeWidth / 2)
		maxEdge = Math.max(maxEdge, centerX + nodeWidth / 2)
		// Use per-node gap override if available, otherwise default gap
		const nodeGap = gapAfterOverrides?.[node.id] ?? gap
		cursorX += layoutWidth + nodeGap
		const arrowAfter = arrows?.find((arrow) => arrow.afterIndex === index)
		if (arrowAfter) {
			const rightNode = nodes[index + 1]
			if (rightNode && !rightNode.hidden) {
				cursorX += arrowAfter.gap ?? 48
			}
		}
	}

	const layoutTotalWidth = Number.isFinite(minEdge) && Number.isFinite(maxEdge) ? maxEdge - minEdge : 0
	const availableWidth = width - paddingX * 2
	const desiredCenter = paddingX + availableWidth / 2
	let offsetX =
		Number.isFinite(minEdge) && Number.isFinite(maxEdge) ? desiredCenter - (minEdge + maxEdge) / 2 : desiredCenter
	if (layoutTotalWidth <= availableWidth) {
		const minOffset = paddingX - (Number.isFinite(minEdge) ? minEdge : 0)
		const maxOffset = width - paddingX - (Number.isFinite(maxEdge) ? maxEdge : 0)
		offsetX = Math.min(Math.max(offsetX, minOffset), maxOffset)
	}

	const baseY = paddingTop + layout.bubbleHeight + layout.bubbleGap

	return { targetWidths, offsetX, baseY }
}

export function buildNodeTargets({
	nodes,
	layoutTargets,
	layout,
	gap,
	tuning,
	palette,
	sizeOverrides,
	contentOpacityOverrides,
	fillOpacityOverrides,
	borderAlphaOverrides,
	borderWidthOverrides,
	borderColorOverrides,
	iconOpacityOverrides,
	labelOpacityOverrides,
	widthSpringBase,
	widthSpringBouncy,
	arrowByAfterIndex,
	enteringIds,
	gapAfterOverrides,
}: {
	nodes: SvgEffectNodeSpec[]
	layoutTargets: LayoutTargets
	layout: SvgEffectLayoutConfig
	gap: number
	tuning: LayoutTuning
	palette: LayoutPalette
	sizeOverrides: SizeOverrides
	contentOpacityOverrides: NumberOverrides
	fillOpacityOverrides: NumberOverrides
	borderAlphaOverrides: NumberOverrides
	borderWidthOverrides: NumberOverrides
	borderColorOverrides: NumberOverrides
	iconOpacityOverrides: NumberOverrides
	labelOpacityOverrides: NumberOverrides
	widthSpringBase: SpringTransition
	widthSpringBouncy: SpringTransition
	arrowByAfterIndex: Map<number, PixiEffectArrow>
	enteringIds?: Set<string>
	gapAfterOverrides: NumberOverrides
}): NodeTarget[] {
	let cursorX = layoutTargets.offsetX
	return nodes.map((node, index) => {
		const isRunning = node.visualState === "running"
		const isCompleted = node.visualState === "completed"
		const isFailed = node.visualState === "failed" || node.visualState === "death"
		const isInterrupted = node.visualState === "interrupted"
		const isHidden = node.hidden === true
		const isEntering = enteringIds?.has(node.id) ?? false

		const widthOverride = sizeOverrides?.[node.id]?.width
		const heightOverride = sizeOverrides?.[node.id]?.height
		const baseWidth =
			typeof widthOverride === "number"
				? widthOverride
				: node.visualState === "completed"
					? layoutTargets.targetWidths[index]
					: layout.nodeSize
		const baseHeight = typeof heightOverride === "number" ? heightOverride : layout.nodeSize
		const labelWidth = measureMonoText(node.name, layout.labelFontSize, layout.charWidthRatio)
		const layoutWidth = isHidden ? 0 : Math.max(baseWidth, labelWidth)

		const runningHeightScale = tuning.collapseRunning ? tuning.runningHeightScale : 1
		const targetHeight = isHidden ? 0 : isRunning ? baseHeight * runningHeightScale : baseHeight
		const targetWidth = isHidden ? 0 : baseWidth
		const widthSpring = node.visualState === "completed" ? widthSpringBouncy : widthSpringBase

		const targetCenterX = cursorX + (isHidden ? 0 : layoutWidth / 2)
		const targetCenterY = layoutTargets.baseY + layout.nodeSize / 2

		const contentOpacityOverride = contentOpacityOverrides?.[node.id]
		const contentOpacityTarget = isHidden ? 0 : (contentOpacityOverride ?? (isRunning ? 0 : 1))
		const fillOpacityTarget = isHidden ? 0 : (fillOpacityOverrides?.[node.id] ?? 1)

		const borderAlphaOverride = borderAlphaOverrides?.[node.id]
		const borderWidthOverride = borderWidthOverrides?.[node.id]
		const borderColorOverride = borderColorOverrides?.[node.id]
		const deathBorderAlpha = node.visualState === "death" ? 0.9 : undefined
		const deathBorderColor = node.visualState === "death" ? 0xff2d2d : undefined
		const deathBorderWidth = node.visualState === "death" ? 1.25 : undefined
		const resolvedBorderAlphaOverride = borderAlphaOverride ?? deathBorderAlpha
		const resolvedBorderColorOverride = borderColorOverride ?? deathBorderColor
		const resolvedBorderWidthOverride = borderWidthOverride ?? deathBorderWidth

		const labelOpacityOverride = labelOpacityOverrides?.[node.id]
		const labelBaseAlpha = node.visualState === "idle" ? 0.5 : 0.7
		const labelOpacityTarget = isHidden ? 0 : (labelOpacityOverride ?? labelBaseAlpha)

		const iconOpacityOverride = iconOpacityOverrides?.[node.id]
		const iconKind = getNodeIcon(node)
		const content = iconKind === "none" ? getContentText(node) : null
		const resultScale = getContentScale(node, content)
		const bubble = getBubble(node)

		// Hidden nodes don't contribute to layout
		if (!isHidden) {
			const nodeGap = gapAfterOverrides?.[node.id] ?? gap
			cursorX += layoutWidth + nodeGap
		}

		// Add extra gap if there's an arrow after this node (only if not hidden)
		const arrowAfter = arrowByAfterIndex.get(index)
		if (arrowAfter && !isHidden) {
			const nextNode = nodes[index + 1]
			if (nextNode && !nextNode.hidden) {
				cursorX += arrowAfter.gap ?? 48
			}
		}

		// Scale and blur targets for hidden animation
		const scaleTarget = isHidden ? 0 : isRunning ? tuning.runningScale : 1
		const blurTarget = isHidden ? NODE_HIDDEN_BLUR : 0

		return {
			node,
			isRunning,
			isCompleted,
			isFailed,
			isInterrupted,
			isHidden,
			isEntering,
			baseHeight,
			targetWidth,
			targetHeight,
			widthSpring,
			targetCenterX,
			targetCenterY,
			contentOpacityTarget,
			fillOpacityTarget,
			borderAlphaTarget: isHidden ? 0 : (resolvedBorderAlphaOverride ?? palette.borderAlpha),
			...(resolvedBorderAlphaOverride !== undefined && { borderAlphaOverride: resolvedBorderAlphaOverride }),
			...(resolvedBorderWidthOverride !== undefined && { borderWidthOverride: resolvedBorderWidthOverride }),
			...(resolvedBorderColorOverride !== undefined && { borderColorOverride: resolvedBorderColorOverride }),
			...(iconOpacityOverride !== undefined && { iconOpacityOverride }),
			labelOpacityTarget,
			scaleTarget,
			blurTarget,
			iconKind,
			content,
			resultScale,
			bubble,
		}
	})
}

export function getNodeIcon(node: SvgEffectNodeSpec): NodeIconKind {
	if (node.visualState === "completed") {
		const resultValue = normalizeText(node.result ?? "✓")
		if (resultValue === "✓") return "check"
	}
	if (node.visualState === "failed" || node.visualState === "death") return "error"
	if (node.visualState === "interrupted") return "warning"
	if (node.visualState === "idle") return "sparkle"
	return "none"
}
