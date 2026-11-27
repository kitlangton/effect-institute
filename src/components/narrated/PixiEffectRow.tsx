import type { Application } from "pixi.js"
import { useLayoutEffect, useMemo, useRef } from "react"
import { defaultSvgEffectLayout, type SvgEffectLayoutConfig } from "@/lib/hierarchy/svgEffectLayout"
import type { SvgEffectNodeSpec } from "@/lib/hierarchy/types"
import { defaultPixiEffectTuning } from "./pixi-effect-row/engine/config"
import { PixiRowEngine, type PixiRowEngineInputs } from "./pixi-effect-row/engine/PixiRowEngine"
import type {
	PixiEffectFrame,
	PixiEffectTuning,
	PixiNodeTransform,
	PixiStageTransform,
} from "./pixi-effect-row/engine/types"
import type { PixiEffectArrow, PixiEffectOverlay } from "./pixi-effect-row/types"

export { defaultPixiEffectTuning } from "./pixi-effect-row/engine/config"
export type { PixiEffectTuning } from "./pixi-effect-row/engine/types"
export type { PixiEffectArrow } from "./pixi-effect-row/types"

interface PixiEffectRowBaseProps {
	nodes: SvgEffectNodeSpec[]
	gap?: number
	paddingX?: number
	paddingTop?: number
	paddingBottom?: number
	heightOverride?: number
	widthOverride?: number
	layout?: Partial<SvgEffectLayoutConfig>
	tuning?: Partial<PixiEffectTuning>
	overlay?: PixiEffectOverlay | null
	stageTransform?: PixiStageTransform
	nodeTransform?: PixiNodeTransform
	sharedApp?: Application
	zIndexOffset?: number
	onFrame?: (frame: PixiEffectFrame) => void
	arrows?: PixiEffectArrow[]
}

interface PixiEffectRowOverrideProps {
	sizeOverrides?: Record<string, { width: number; height: number }>
	fillOpacityOverrides?: Record<string, number>
	borderAlphaOverrides?: Record<string, number>
	contentOpacityOverrides?: Record<string, number>
	iconOpacityOverrides?: Record<string, number>
	borderWidthOverrides?: Record<string, number>
	borderColorOverrides?: Record<string, number>
	labelOpacityOverrides?: Record<string, number>
	gapAfterOverrides?: Record<string, number>
}

type PixiEffectRowInternalProps = PixiEffectRowBaseProps & PixiEffectRowOverrideProps

export function PixiEffectRow(props: PixiEffectRowBaseProps) {
	return <PixiEffectRowInternal {...props} />
}

// Internal: used by HierarchicalEffectRow for container shell overrides.
export function PixiEffectRowInternal({
	nodes,
	gap = 24,
	paddingX = 16,
	paddingTop = 12,
	paddingBottom = 12,
	heightOverride,
	layout: layoutOverrides,
	tuning: tuningOverrides,
	overlay,
	stageTransform,
	nodeTransform,
	sharedApp,
	zIndexOffset = 0,
	sizeOverrides,
	fillOpacityOverrides,
	borderAlphaOverrides,
	contentOpacityOverrides,
	iconOpacityOverrides,
	borderWidthOverrides,
	borderColorOverrides,
	onFrame,
	labelOpacityOverrides,
	gapAfterOverrides,
	widthOverride,
	arrows,
}: PixiEffectRowInternalProps) {
	const layout: SvgEffectLayoutConfig = useMemo(
		() => ({ ...defaultSvgEffectLayout, ...layoutOverrides }),
		[layoutOverrides],
	)
	const tuning = useMemo(() => ({ ...defaultPixiEffectTuning, ...tuningOverrides }), [tuningOverrides])
	const containerRef = useRef<HTMLDivElement>(null)
	const engineRef = useRef<PixiRowEngine | null>(null)

	const engineInputs = useMemo<PixiRowEngineInputs>(
		() => ({
			nodes,
			layout,
			tuning,
			gap,
			paddingX,
			paddingTop,
			paddingBottom,
			overlay: overlay ?? null,
			stageTransform,
			nodeTransform,
			...(widthOverride !== undefined && { widthOverride }),
			...(heightOverride !== undefined && { heightOverride }),
			...(sizeOverrides !== undefined && { sizeOverrides }),
			...(fillOpacityOverrides !== undefined && { fillOpacityOverrides }),
			...(borderAlphaOverrides !== undefined && { borderAlphaOverrides }),
			...(contentOpacityOverrides !== undefined && { contentOpacityOverrides }),
			...(iconOpacityOverrides !== undefined && { iconOpacityOverrides }),
			...(borderWidthOverrides !== undefined && { borderWidthOverrides }),
			...(borderColorOverrides !== undefined && { borderColorOverrides }),
			...(labelOpacityOverrides !== undefined && { labelOpacityOverrides }),
			...(gapAfterOverrides !== undefined && { gapAfterOverrides }),
			...(arrows !== undefined && { arrows }),
			...(onFrame !== undefined && { onFrame }),
		}),
		[
			nodes,
			layout,
			tuning,
			gap,
			paddingX,
			paddingTop,
			paddingBottom,
			widthOverride,
			heightOverride,
			overlay,
			stageTransform,
			nodeTransform,
			sizeOverrides,
			fillOpacityOverrides,
			borderAlphaOverrides,
			contentOpacityOverrides,
			iconOpacityOverrides,
			borderWidthOverrides,
			borderColorOverrides,
			labelOpacityOverrides,
			gapAfterOverrides,
			arrows,
			onFrame,
		],
	)

	useLayoutEffect(() => {
		const container = containerRef.current
		if (!container) return
		const engine = new PixiRowEngine({
			container,
			zIndexOffset,
			...(sharedApp !== undefined && { sharedApp }),
		})
		engineRef.current = engine
		engine.setInputs(engineInputs)
		void engine.init()

		return () => {
			engine.destroy()
			if (engineRef.current === engine) {
				engineRef.current = null
			}
		}
	}, [sharedApp, zIndexOffset])

	useLayoutEffect(() => {
		engineRef.current?.setInputs(engineInputs)
	}, [engineInputs])

	return <div ref={containerRef} className="w-full" />
}
