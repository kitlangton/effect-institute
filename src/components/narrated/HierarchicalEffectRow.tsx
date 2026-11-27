import { useMemo } from "react"
import { deriveVisualState } from "@/lib/hierarchy/deriveState"
import { defaultSvgEffectLayout, getNodeTargetWidth, type SvgEffectLayoutConfig } from "@/lib/hierarchy/svgEffectLayout"
import type { HierarchicalEffectNode, SvgEffectNodeSpec } from "@/lib/hierarchy/types"
import {
	defaultPixiEffectTuning,
	type PixiEffectArrow,
	PixiEffectRow,
	PixiEffectRowInternal,
	type PixiEffectTuning,
} from "./PixiEffectRow"
import { PixiEffectStage } from "./PixiEffectStage"

interface HierarchicalEffectRowProps {
	root: HierarchicalEffectNode
	/** Whether children are collapsed into the parent */
	collapsed?: boolean
	/** Whether to show the container border (when expanded). Default true. */
	showBorder?: boolean
	/** Zoom level */
	zoom?: number
	gap?: number
	paddingX?: number
	paddingY?: number
	containerPadding?: number
	effectLayout?: Partial<SvgEffectLayoutConfig>
	tuning?: Partial<PixiEffectTuning>
	/** Arrows between children */
	arrows?: PixiEffectArrow[]
}

interface LayoutConfig {
	gap: number
	paddingX: number
	paddingY: number
	containerPadding: number
}

const DEFAULT_LAYOUT: LayoutConfig = {
	gap: 24,
	paddingX: 16,
	paddingY: 12,
	containerPadding: 16,
}

// Animation constants - match HierarchyPreview exactly
const COLLAPSED = {
	scale: 0.72,
	blur: 6,
	y: 6,
	opacity: 0,
}

// Border colors based on derived state - vibrant versions
const STATE_BORDER_COLORS = {
	idle: 0x475569, // slate gray (matches idle node fill)
	running: 0x60a5fa, // vibrant blue
	completed: 0x4ade80, // vibrant green
	failed: 0xf87171, // vibrant red
	interrupted: 0xfb923c, // vibrant orange
	death: 0xff2d2d, // bright red
} as const

function toSpec(node: HierarchicalEffectNode): SvgEffectNodeSpec {
	return {
		id: node.id,
		name: node.name,
		visualState: deriveVisualState(node),
		...(node.result !== undefined && { result: node.result }),
		...(node.resultScale !== undefined && { resultScale: node.resultScale }),
		...(node.error !== undefined && { error: node.error }),
		...(node.showLog !== undefined && { showLog: node.showLog }),
		...(node.logMessage !== undefined && { logMessage: node.logMessage }),
	}
}

/**
 * Renders a hierarchical tree with smooth animations.
 *
 * Simple single-level hierarchy:
 * - ONE container row (the root, shown as outline when expanded)
 * - ONE children row (root's children)
 * - Collapse state hides children and shows root as full node
 * - Border color reflects the derived state of the root
 */
export function HierarchicalEffectRow({
	root,
	collapsed = false,
	showBorder = true,
	zoom = 1,
	gap = DEFAULT_LAYOUT.gap,
	paddingX = DEFAULT_LAYOUT.paddingX,
	paddingY = DEFAULT_LAYOUT.paddingY,
	containerPadding = DEFAULT_LAYOUT.containerPadding,
	effectLayout: layoutOverrides,
	tuning,
	arrows,
}: HierarchicalEffectRowProps) {
	const layout = useMemo(() => ({ ...defaultSvgEffectLayout, ...layoutOverrides }), [layoutOverrides])
	const mergedTuning = useMemo(() => ({ ...defaultPixiEffectTuning, ...tuning }), [tuning])

	const labelHeight = layout.labelGap + layout.labelFontSize
	const totalHeight =
		paddingY * 2 + layout.bubbleHeight + layout.bubbleGap + layout.nodeSize + labelHeight + containerPadding * 2

	return (
		<PixiEffectStage height={totalHeight}>
			{({ app, width }) => (
				<SimpleHierarchyRenderer
					app={app}
					width={width}
					root={root}
					collapsed={collapsed}
					showBorder={showBorder}
					zoom={zoom}
					layout={layout}
					tuning={mergedTuning}
					gap={gap}
					paddingX={paddingX}
					paddingY={paddingY}
					containerPadding={containerPadding}
					totalHeight={totalHeight}
					{...(arrows && { arrows })}
				/>
			)}
		</PixiEffectStage>
	)
}

interface SimpleHierarchyRendererProps {
	app: import("pixi.js").Application
	width: number
	root: HierarchicalEffectNode
	collapsed: boolean
	showBorder: boolean
	zoom: number
	layout: SvgEffectLayoutConfig
	tuning: PixiEffectTuning
	gap: number
	paddingX: number
	paddingY: number
	containerPadding: number
	totalHeight: number
	arrows?: PixiEffectArrow[]
}

/**
 * Simple renderer:
 * - Render root as container outline (when expanded) or full node (when collapsed)
 * - Render children with collapse animation
 * - Border color based on root's derived state
 */
function SimpleHierarchyRenderer({
	app,
	width,
	root,
	collapsed,
	showBorder,
	zoom,
	layout,
	tuning,
	gap,
	paddingX,
	paddingY,
	containerPadding,
	totalHeight,
	arrows,
}: SimpleHierarchyRendererProps) {
	const usableWidth = width || 800
	const children = root.children ?? []
	const hasChildren = children.length > 0
	const showAsContainer = hasChildren && !collapsed

	// Derive state for border color
	const derivedState = deriveVisualState(root)
	const borderColor = STATE_BORDER_COLORS[derivedState]

	// Convert to specs
	const containerSpec: SvgEffectNodeSpec = showAsContainer
		? {
				id: root.id,
				name: root.name,
				visualState: "idle", // Container outline is always idle
			}
		: toSpec(root)

	const childSpecs = useMemo(() => children.map(toSpec), [children])

	// Layout computation
	const targetWidths = useMemo(() => {
		return children.map((c) => getNodeTargetWidth(toSpec(c), layout))
	}, [children, layout])

	const groupTop = paddingY + layout.bubbleHeight + layout.bubbleGap
	const labelHeight = layout.labelGap + layout.labelFontSize

	const layoutTotalWidth = targetWidths.reduce((sum, w) => sum + w, 0) + Math.max(0, targetWidths.length - 1) * gap

	const desiredCenter = paddingX + (usableWidth - paddingX * 2) / 2
	let offsetX = desiredCenter - layoutTotalWidth / 2
	const maxOffset = usableWidth - paddingX - layoutTotalWidth
	if (maxOffset < paddingX) {
		offsetX = paddingX
	} else {
		offsetX = Math.min(Math.max(offsetX, paddingX), maxOffset)
	}

	const groupLeft = offsetX
	const groupWidth = layoutTotalWidth
	const originX = groupLeft + groupWidth / 2
	const originY = groupTop + layout.nodeSize / 2

	// Container rect (extra horizontal padding for visual balance)
	const containerRect = {
		width: groupWidth + containerPadding * 3,
		height: layout.nodeSize + labelHeight + containerPadding * 2,
	}

	const parentCenterY = groupTop + layout.nodeSize / 2
	const parentShiftY = showAsContainer ? labelHeight / 2 : 0
	const parentOriginX = showAsContainer ? originX : desiredCenter
	const parentOriginY = parentCenterY + parentShiftY

	// Transforms
	const containerTransform = {
		opacity: 1,
		scale: 1,
		y: parentShiftY,
		x: 0,
		blur: 0,
	}

	const childTransform = {
		opacity: collapsed ? COLLAPSED.opacity : 1,
		scale: collapsed ? COLLAPSED.scale : 1,
		y: collapsed ? COLLAPSED.y : 0,
		blur: collapsed ? COLLAPSED.blur : 0,
		pivotX: originX,
		pivotY: originY,
	}

	return (
		<>
			{/* Container outline */}
			<PixiEffectRowInternal
				sharedApp={app}
				widthOverride={usableWidth}
				zIndexOffset={0}
				nodes={[containerSpec]}
				tuning={tuning}
				gap={gap}
				paddingX={paddingX}
				paddingTop={paddingY}
				paddingBottom={paddingY}
				heightOverride={totalHeight}
				stageTransform={{ scale: zoom, pivotX: parentOriginX, pivotY: parentOriginY }}
				nodeTransform={containerTransform}
				{...(showAsContainer && {
					sizeOverrides: { [containerSpec.id]: containerRect },
					fillOpacityOverrides: { [containerSpec.id]: 0 },
					borderAlphaOverrides: { [containerSpec.id]: showBorder ? 0.7 : 0 },
					borderColorOverrides: { [containerSpec.id]: borderColor },
					borderWidthOverrides: { [containerSpec.id]: 2 },
					contentOpacityOverrides: { [containerSpec.id]: 0 },
					iconOpacityOverrides: { [containerSpec.id]: 0 },
					labelOpacityOverrides: { [containerSpec.id]: 0 },
				})}
			/>

			{/* Children */}
			{childSpecs.length > 0 && (
				<PixiEffectRow
					sharedApp={app}
					widthOverride={usableWidth}
					zIndexOffset={10}
					nodes={childSpecs}
					tuning={tuning}
					gap={gap}
					paddingX={paddingX}
					paddingTop={paddingY}
					paddingBottom={paddingY}
					heightOverride={totalHeight}
					stageTransform={{ scale: zoom, pivotX: originX, pivotY: originY }}
					nodeTransform={childTransform}
					{...(arrows && { arrows })}
				/>
			)}
		</>
	)
}

export { DEFAULT_LAYOUT as defaultHierarchyLayoutConfig, type LayoutConfig as HierarchyLayoutConfig }
