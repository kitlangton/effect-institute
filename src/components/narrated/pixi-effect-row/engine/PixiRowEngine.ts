import { cancelFrame, type FrameData, frame, motionValue } from "motion"
import { Application, BlurFilter, Container, Graphics, Text, TextStyle } from "pixi.js"
import type { SvgEffectLayoutConfig } from "@/lib/hierarchy/svgEffectLayout"
import type { SvgEffectNodeSpec } from "@/lib/hierarchy/types"
import type { PixiEffectArrow, PixiEffectOverlay } from "../types"
import { destroyBlurFilter, getDevicePixelRatio, isPixiRendererDestroyed } from "./application"
import { ArrowSystem } from "./arrows/ArrowSystem"
import {
	BORDER_ALPHA_LAMBDA,
	FILL_OPACITY_LAMBDA,
	HEIGHT_SPRING_REST,
	HEIGHT_SPRING_RUNNING,
	JITTER_LAMBDA,
	OPACITY_LAMBDA,
	POSITION_SPRING,
	TRANSFORM_LAMBDA,
	WIDTH_SPRING,
	WIDTH_SPRING_BOUNCY,
} from "./config"
import { buildNodeTargets, computeLayoutTargets, type LayoutTargets, type NodeTarget } from "./layout"
import {
	animateScalarMotion as animateAxis,
	createScalarMotion as createAxisState,
	type ScalarMotion as MotionAxisState,
	syncScalarMotion as setAxis,
	springFromLambda,
} from "./motion"
import { applyLayoutToNodeView, createNodeView, destroyNodeView, type NodeView, updateNodeView } from "./node/NodeView"
import { applyLayoutToOverlayLabel, type OverlayState, type OverlayView, updateOverlayView } from "./overlay"
import { buildColorMap, type Palette } from "./palette"
import type { PixiEffectFrame, PixiEffectTuning, PixiNodeTransform, PixiStageTransform } from "./types"

export interface PixiRowEngineInputs {
	nodes: SvgEffectNodeSpec[]
	layout: SvgEffectLayoutConfig
	tuning: PixiEffectTuning
	gap: number
	paddingX: number
	paddingTop: number
	paddingBottom: number
	widthOverride?: number
	heightOverride?: number
	overlay: PixiEffectOverlay | null
	stageTransform: PixiStageTransform | undefined
	nodeTransform: PixiNodeTransform | undefined
	sizeOverrides?: Record<string, { width: number; height: number }>
	fillOpacityOverrides?: Record<string, number>
	borderAlphaOverrides?: Record<string, number>
	contentOpacityOverrides?: Record<string, number>
	iconOpacityOverrides?: Record<string, number>
	borderWidthOverrides?: Record<string, number>
	borderColorOverrides?: Record<string, number>
	labelOpacityOverrides?: Record<string, number>
	gapAfterOverrides?: Record<string, number>
	arrows?: PixiEffectArrow[]
	onFrame?: (frame: PixiEffectFrame) => void
}

interface TransformMotionState {
	hasLayout: boolean
	scale: MotionAxisState
	opacity: MotionAxisState
	x: MotionAxisState
	y: MotionAxisState
	blur?: MotionAxisState
}

interface DirtyState {
	structure: boolean
	layout: boolean
	targets: boolean
	arrows: boolean
}

interface ExitNodeRecord {
	node: SvgEffectNodeSpec
	startedAt: number
}

interface EnterNodeRecord {
	startedAt: number
}

/** The springs shared by the stage and node-layer transforms, built once per frame */
interface LayerSprings {
	transform: ReturnType<typeof springFromLambda>
	opacity: ReturnType<typeof springFromLambda>
}

const renderScheduled = new WeakMap<Application, boolean>()

function isContainerDestroyed(container: Container | null | undefined) {
	return Boolean(container?.destroyed)
}

function createTransformMotionState({
	scale,
	opacity,
	x,
	y,
	blur,
}: {
	scale: number
	opacity: number
	x: number
	y: number
	blur?: number
}): TransformMotionState {
	return {
		hasLayout: false,
		scale: createAxisState(scale),
		opacity: createAxisState(opacity),
		x: createAxisState(x),
		y: createAxisState(y),
		...(blur !== undefined ? { blur: createAxisState(blur) } : {}),
	}
}

function scheduleRender(app: Application) {
	if (renderScheduled.get(app)) return
	renderScheduled.set(app, true)
	frame.render(() => {
		renderScheduled.delete(app)
		if (isPixiRendererDestroyed(app)) return
		app.renderer.render({ container: app.stage })
	})
}

function buildNodeIdKey(nodes: SvgEffectNodeSpec[]): string {
	return JSON.stringify(nodes.map((node) => node.id))
}

export function buildArrowsKey(arrows: PixiEffectArrow[] | undefined): string {
	if (!arrows || arrows.length === 0) return "[]"
	return JSON.stringify(
		arrows.map((arrow) => [
			arrow.afterIndex,
			arrow.gap ?? 48,
			arrow.size ?? 30,
			arrow.color ?? 0x71717a,
			arrow.direction ?? "right",
		]),
	)
}

export class PixiRowEngine {
	private readonly container: HTMLElement
	private readonly sharedApp: Application | undefined
	private readonly zIndexOffset: number
	private readonly palette: Palette

	private app: Application | null = null
	private ownsApp = false
	private initialized = false
	private disposed = false

	private rowRoot: Container | null = null
	private nodesRoot: Container | null = null
	private nodesBlur: BlurFilter | null = null
	private overlayView: OverlayView | null = null
	private overlayState: OverlayState | null = null

	private nodeViews = new Map<string, NodeView>()
	private arrowSystem = new ArrowSystem()
	private arrowByAfterIndex = new Map<number, PixiEffectArrow>()

	private exitingNodes = new Map<string, ExitNodeRecord>()
	private enteringNodes = new Map<string, EnterNodeRecord>()
	private activeIdSet = new Set<string>()
	private lastNodeById = new Map<string, SvgEffectNodeSpec>()
	private renderNodes: SvgEffectNodeSpec[] = []

	private layoutTargets: LayoutTargets | null = null
	private nodeTargets: NodeTarget[] | null = null

	private dirty: DirtyState = { structure: true, layout: true, targets: true, arrows: true }
	private nodeIdKey = ""
	private nodeIdSet = new Set<string>()
	private arrowsKey = ""

	private stageMotion: TransformMotionState = createTransformMotionState({
		scale: 1,
		opacity: 1,
		x: 0,
		y: 0,
	})
	private nodeMotion: TransformMotionState = createTransformMotionState({
		scale: 1,
		opacity: 1,
		x: 0,
		y: 0,
		blur: 0,
	})

	private lastHeight = 0
	private lastWidth: number | null = null
	private lastRendererWidth = 0
	private lastResolution: number | null = null
	private width = 0
	private height = 0
	private lastLayout: SvgEffectLayoutConfig | null = null
	private resizeObserver: ResizeObserver | null = null
	private frameProcess: ((frame: FrameData) => void) | null = null

	private nodes: SvgEffectNodeSpec[] = []
	private layout: SvgEffectLayoutConfig | null = null
	private tuning: PixiEffectTuning | null = null
	private overlay: PixiEffectOverlay | null = null
	private stageTransform: PixiStageTransform = {}
	private nodeTransform: PixiNodeTransform = {}
	private gap = 24
	private paddingX = 16
	private paddingTop = 12
	private paddingBottom = 12
	private widthOverride: number | undefined
	private heightOverride: number | undefined
	private sizeOverrides: PixiRowEngineInputs["sizeOverrides"]
	private fillOpacityOverrides: PixiRowEngineInputs["fillOpacityOverrides"]
	private borderAlphaOverrides: PixiRowEngineInputs["borderAlphaOverrides"]
	private contentOpacityOverrides: PixiRowEngineInputs["contentOpacityOverrides"]
	private iconOpacityOverrides: PixiRowEngineInputs["iconOpacityOverrides"]
	private borderWidthOverrides: PixiRowEngineInputs["borderWidthOverrides"]
	private borderColorOverrides: PixiRowEngineInputs["borderColorOverrides"]
	private labelOpacityOverrides: PixiRowEngineInputs["labelOpacityOverrides"]
	private gapAfterOverrides: PixiRowEngineInputs["gapAfterOverrides"]
	private arrows: PixiEffectArrow[] | undefined
	private onFrame: PixiRowEngineInputs["onFrame"]

	constructor({
		container,
		sharedApp,
		zIndexOffset = 0,
	}: {
		container: HTMLElement
		sharedApp?: Application
		zIndexOffset?: number
	}) {
		this.container = container
		this.sharedApp = sharedApp
		this.zIndexOffset = zIndexOffset
		this.palette = buildColorMap()
	}

	setInputs(inputs: PixiRowEngineInputs) {
		const previousActiveIds = this.activeIdSet
		const previousNodesById = this.lastNodeById

		const nextActiveIds = new Set(inputs.nodes.map((node) => node.id))
		for (const id of nextActiveIds) {
			if (!previousActiveIds.has(id) && !this.nodeViews.has(id)) {
				this.enteringNodes.set(id, { startedAt: -1 })
			}
		}
		for (const id of previousActiveIds) {
			if (nextActiveIds.has(id)) continue
			this.enteringNodes.delete(id)
		}
		for (const id of nextActiveIds) {
			this.exitingNodes.delete(id)
		}

		for (const id of previousActiveIds) {
			if (nextActiveIds.has(id)) continue
			if (this.exitingNodes.has(id)) continue
			const lastNode = previousNodesById.get(id)
			if (!lastNode) continue
			this.exitingNodes.set(id, {
				node: { ...lastNode, hidden: true },
				startedAt: -1,
			})
		}

		this.nodes = inputs.nodes
		this.activeIdSet = nextActiveIds
		this.lastNodeById = new Map(inputs.nodes.map((node) => [node.id, node]))
		this.renderNodes = this.buildRenderNodes(inputs.nodes)

		this.layout = inputs.layout
		this.tuning = inputs.tuning
		this.overlay = inputs.overlay ?? null
		this.stageTransform = inputs.stageTransform ?? {}
		this.nodeTransform = inputs.nodeTransform ?? {}
		this.gap = inputs.gap
		this.paddingX = inputs.paddingX
		this.paddingTop = inputs.paddingTop
		this.paddingBottom = inputs.paddingBottom
		this.widthOverride = inputs.widthOverride
		this.heightOverride = inputs.heightOverride
		this.sizeOverrides = inputs.sizeOverrides
		this.fillOpacityOverrides = inputs.fillOpacityOverrides
		this.borderAlphaOverrides = inputs.borderAlphaOverrides
		this.contentOpacityOverrides = inputs.contentOpacityOverrides
		this.iconOpacityOverrides = inputs.iconOpacityOverrides
		this.borderWidthOverrides = inputs.borderWidthOverrides
		this.borderColorOverrides = inputs.borderColorOverrides
		this.labelOpacityOverrides = inputs.labelOpacityOverrides
		this.gapAfterOverrides = inputs.gapAfterOverrides
		this.arrows = inputs.arrows
		this.onFrame = inputs.onFrame

		const layoutNow = inputs.layout
		this.height =
			this.heightOverride ??
			this.paddingTop +
				layoutNow.bubbleHeight +
				layoutNow.bubbleGap +
				layoutNow.nodeSize +
				layoutNow.labelGap +
				layoutNow.labelFontSize +
				this.paddingBottom

		this.dirty.layout = true
		this.dirty.targets = true

		const nextNodeIdKey = buildNodeIdKey(this.renderNodes)
		if (nextNodeIdKey !== this.nodeIdKey) {
			this.nodeIdKey = nextNodeIdKey
			this.nodeIdSet = new Set(this.renderNodes.map((node) => node.id))
			this.dirty.structure = true
		}

		const nextArrowsKey = buildArrowsKey(inputs.arrows)
		if (nextArrowsKey !== this.arrowsKey) {
			this.arrowsKey = nextArrowsKey
			const arrowMap = new Map<number, PixiEffectArrow>()
			for (const arrow of inputs.arrows ?? []) {
				if (!arrowMap.has(arrow.afterIndex)) {
					arrowMap.set(arrow.afterIndex, arrow)
				}
			}
			this.arrowByAfterIndex = arrowMap
			this.dirty.arrows = true
		}
	}

	async init() {
		if (this.initialized || this.disposed) return
		const isShared = Boolean(this.sharedApp)
		const app = this.sharedApp ?? new Application()
		this.app = app
		this.ownsApp = !isShared

		if (!isShared) {
			await app.init({
				backgroundAlpha: 0,
				antialias: true,
				resolution: getDevicePixelRatio(),
				autoDensity: true,
				preference: "webgl",
				width: 1,
				height: 1,
			})

			this.initialized = true
			if (this.disposed) {
				app.destroy(true, { children: true })
				return
			}

			const canvas = app.canvas as HTMLCanvasElement | undefined
			if (canvas) {
				this.container.appendChild(canvas)
			}
		}

		if (this.disposed) {
			if (!isShared) {
				app.destroy(true, { children: true })
			}
			return
		}

		const rowRoot = new Container()
		rowRoot.sortableChildren = true
		rowRoot.zIndex = this.zIndexOffset
		const nodesRoot = new Container()
		const filterResolution = app.renderer.resolution
		const nodesBlur = new BlurFilter({ strengthX: 0, strengthY: 0, quality: 2 })
		nodesBlur.repeatEdgePixels = true
		nodesBlur.enabled = false
		nodesBlur.resolution = filterResolution
		nodesBlur.padding = 24
		nodesRoot.filters = [nodesBlur]
		const overlayFill = new Graphics()
		const overlayBorder = new Graphics()
		const overlayBlur = new BlurFilter({ strengthX: 0, strengthY: 0, quality: 2 })
		overlayBlur.repeatEdgePixels = true
		overlayBlur.enabled = false
		overlayBlur.resolution = filterResolution
		overlayFill.filters = [overlayBlur]
		overlayBorder.filters = [overlayBlur]
		const layoutNow = this.layout
		const overlayLabel = new Text({
			text: "",
			style: new TextStyle({
				fontFamily: layoutNow?.fontFamily ?? "sans-serif",
				fontSize: layoutNow?.labelFontSize ?? 12,
				fill: this.palette.textSecondary,
				fontWeight: "500",
			}),
		})
		overlayLabel.anchor.set(0, 0)
		app.stage.sortableChildren = true
		overlayFill.zIndex = 0
		nodesRoot.zIndex = 1
		overlayBorder.zIndex = 3
		overlayLabel.zIndex = 3
		rowRoot.addChild(overlayFill, nodesRoot, overlayBorder, overlayLabel)
		app.stage.addChild(rowRoot)
		this.rowRoot = rowRoot
		this.nodesRoot = nodesRoot
		this.nodesBlur = nodesBlur
		this.overlayView = { fill: overlayFill, border: overlayBorder, label: overlayLabel, blur: overlayBlur }
		this.overlayState = {
			hasLayout: false,
			x: motionValue(0),
			y: motionValue(0),
			width: motionValue(0),
			height: motionValue(0),
			xTarget: 0,
			yTarget: 0,
			widthTarget: 0,
			heightTarget: 0,
			xControl: null,
			yControl: null,
			widthControl: null,
			heightControl: null,
			opacity: createAxisState(0),
			fillOpacity: createAxisState(0),
			borderAlpha: createAxisState(0),
			fillColor: 0x000000,
			borderColor: 0xffffff,
			labelX: motionValue(0),
			labelY: motionValue(0),
			labelXTarget: 0,
			labelYTarget: 0,
			labelXControl: null,
			labelYControl: null,
			labelOpacity: createAxisState(0),
			labelText: "",
			labelAlign: "left",
		}

		const resize = () => {
			const rect = this.container.getBoundingClientRect()
			const nextWidth = this.widthOverride ?? rect.width
			this.width = nextWidth
			if (!isShared) {
				app.renderer.resize(nextWidth, this.height, getDevicePixelRatio())
				this.lastRendererWidth = nextWidth
				this.lastHeight = this.height
				this.lastResolution = app.renderer.resolution
			}
		}

		resize()
		if (!isShared) {
			this.resizeObserver = new ResizeObserver(resize)
			this.resizeObserver.observe(this.container)
		}

		app.ticker.stop()
		this.frameProcess = (frameInfo) => this.tick(frameInfo)
		frame.update(this.frameProcess, true)
	}

	/** One frame: settle the renderer, move the stage and node layers, then each node, arrow and the overlay */
	private tick(frameInfo: FrameData) {
		if (this.disposed) return
		const app = this.app
		const layoutNow = this.layout
		const tuningNow = this.tuning
		if (!app || isPixiRendererDestroyed(app) || !layoutNow || !tuningNow) return

		const time = frameInfo.timestamp
		const rawDelta = frameInfo.delta
		const dt = rawDelta > 0 ? Math.min(0.033, rawDelta / 1000) : 1 / 60

		const resolutionChanged = this.syncRendererSize(app)
		const layoutChanged = this.lastLayout !== layoutNow
		const rowRoot = this.rowRoot ?? app.stage
		const root = this.nodesRoot ?? rowRoot

		const springs: LayerSprings = {
			transform: springFromLambda(TRANSFORM_LAMBDA),
			opacity: springFromLambda(OPACITY_LAMBDA),
		}
		this.advanceStageTransform(rowRoot, springs)
		this.advanceNodeLayerTransform(root, springs)

		if (resolutionChanged) this.applyResolution(app.renderer.resolution)
		if (layoutChanged || resolutionChanged) this.applyLayoutToViews(app, layoutNow)

		this.syncNodeViews(app, root, layoutNow, tuningNow)
		this.syncArrows(root)
		this.advanceOverlay()

		const nodeTargets = this.resolveTargets(layoutNow, tuningNow)
		this.advanceNodes(app, nodeTargets, { dt, time, layout: layoutNow, tuning: tuningNow })
		this.arrowSystem.update({
			arrows: this.arrows,
			nodeTargets,
			nodeViews: this.nodeViews,
		})

		this.cleanupExitingNodes({ time, nodeViews: this.nodeViews })
		this.cleanupEnteringNodes({ time })

		this.lastLayout = layoutNow

		this.emitFrame(layoutNow)

		scheduleRender(app)
	}

	/**
	 * Resizes an owned renderer to the row's size and DPR, marks layout dirty
	 * when the width changed, and reports whether the resolution changed.
	 */
	private syncRendererSize(app: Application): boolean {
		const effectiveWidth = this.widthOverride ?? this.width
		const expectedResolution = getDevicePixelRatio()
		if (
			this.ownsApp &&
			(this.height !== this.lastHeight ||
				effectiveWidth !== this.lastRendererWidth ||
				Math.abs(app.renderer.resolution - expectedResolution) > 0.001)
		) {
			app.renderer.resize(effectiveWidth, this.height, expectedResolution)
			this.lastRendererWidth = effectiveWidth
			this.lastHeight = this.height
		}

		this.width = effectiveWidth

		const rendererResolution = app.renderer.resolution
		const resolutionChanged = this.lastResolution !== null && Math.abs(rendererResolution - this.lastResolution) > 0.001
		this.lastResolution = rendererResolution

		if (this.lastWidth === null || this.lastWidth !== this.width) {
			this.lastWidth = this.width
			this.dirty.layout = true
			this.dirty.targets = true
		}

		return resolutionChanged
	}

	/** Springs the whole row (scale, opacity, offset about its pivot) toward `stageTransform` */
	private advanceStageTransform(rowRoot: Container, springs: LayerSprings) {
		const stageTarget = this.stageTransform
		const stageMotion = this.stageMotion
		const stageScale = stageTarget.scale ?? 1
		const stageOpacity = stageTarget.opacity ?? 1
		const stageX = stageTarget.x ?? 0
		const stageY = stageTarget.y ?? 0
		const stagePivotX = stageTarget.pivotX ?? 0
		const stagePivotY = stageTarget.pivotY ?? 0

		if (!stageMotion.hasLayout) {
			setAxis(stageMotion.scale, stageScale)
			setAxis(stageMotion.opacity, stageOpacity)
			setAxis(stageMotion.x, stageX)
			setAxis(stageMotion.y, stageY)
			stageMotion.hasLayout = true
		} else {
			animateAxis(stageMotion.scale, stageScale, springs.transform)
			animateAxis(stageMotion.opacity, stageOpacity, springs.opacity)
			animateAxis(stageMotion.x, stageX, springs.transform)
			animateAxis(stageMotion.y, stageY, springs.transform)
		}

		rowRoot.scale.set(stageMotion.scale.value.get())
		rowRoot.alpha = stageMotion.opacity.value.get()
		rowRoot.pivot.set(stagePivotX, stagePivotY)
		rowRoot.position.set(stageMotion.x.value.get() + stagePivotX, stageMotion.y.value.get() + stagePivotY)
	}

	/** Springs the nodes layer (scale, opacity, offset, blur) toward `nodeTransform` */
	private advanceNodeLayerTransform(root: Container, springs: LayerSprings) {
		const nodeTarget = this.nodeTransform
		const nodeMotion = this.nodeMotion
		const nodesBlur = this.nodesBlur
		const nodeScaleTarget = nodeTarget.scale ?? 1
		const nodeOpacityTarget = nodeTarget.opacity ?? 1
		const nodeXTarget = nodeTarget.x ?? 0
		const nodeYTarget = nodeTarget.y ?? 0
		const nodeBlurTarget = nodeTarget.blur ?? 0

		if (!nodeMotion.hasLayout) {
			setAxis(nodeMotion.scale, nodeScaleTarget)
			setAxis(nodeMotion.opacity, nodeOpacityTarget)
			setAxis(nodeMotion.x, nodeXTarget)
			setAxis(nodeMotion.y, nodeYTarget)
			if (nodeMotion.blur) setAxis(nodeMotion.blur, nodeBlurTarget)
			nodeMotion.hasLayout = true
		} else {
			animateAxis(nodeMotion.scale, nodeScaleTarget, springs.transform)
			animateAxis(nodeMotion.opacity, nodeOpacityTarget, springs.opacity)
			animateAxis(nodeMotion.x, nodeXTarget, springs.transform)
			animateAxis(nodeMotion.y, nodeYTarget, springs.transform)
			if (nodeMotion.blur) animateAxis(nodeMotion.blur, nodeBlurTarget, springs.transform, 0.01)
		}

		const nodePivotX = nodeTarget.pivotX ?? 0
		const nodePivotY = nodeTarget.pivotY ?? 0
		root.pivot.set(nodePivotX, nodePivotY)
		root.scale.set(nodeMotion.scale.value.get())
		root.alpha = nodeMotion.opacity.value.get()
		root.position.set(nodePivotX + nodeMotion.x.value.get(), nodePivotY + nodeMotion.y.value.get())
		if (nodesBlur) {
			const blurValue = nodeMotion.blur?.value.get() ?? 0
			nodesBlur.enabled = blurValue > 0.05
			nodesBlur.strengthX = blurValue
			nodesBlur.strengthY = blurValue
		}
	}

	/** Keeps the blur filters rendering at the renderer's resolution */
	private applyResolution(rendererResolution: number) {
		if (this.nodesBlur) this.nodesBlur.resolution = rendererResolution
		if (this.overlayView) this.overlayView.blur.resolution = rendererResolution
	}

	/** Re-applies fonts and sizes from `layoutNow` to the overlay label and every node view */
	private applyLayoutToViews(app: Application, layoutNow: SvgEffectLayoutConfig) {
		if (this.overlayView) {
			applyLayoutToOverlayLabel(this.overlayView.label, layoutNow)
		}
		for (const view of this.nodeViews.values()) {
			applyLayoutToNodeView(view, layoutNow, app)
		}
	}

	/** Creates views for new render nodes and destroys views whose node is gone */
	private syncNodeViews(
		app: Application,
		root: Container,
		layoutNow: SvgEffectLayoutConfig,
		tuningNow: PixiEffectTuning,
	) {
		if (!this.dirty.structure) return
		const nodeViews = this.nodeViews
		const ids = this.nodeIdSet
		for (const node of this.renderNodes) {
			if (nodeViews.has(node.id)) continue
			const view = createNodeView({
				app,
				root,
				node,
				layout: layoutNow,
				tuning: tuningNow,
				palette: this.palette,
				contentOpacityOverrides: this.contentOpacityOverrides,
				fillOpacityOverrides: this.fillOpacityOverrides,
				labelOpacityOverrides: this.labelOpacityOverrides,
			})
			nodeViews.set(node.id, view)
		}

		for (const [id, view] of nodeViews.entries()) {
			if (!ids.has(id)) {
				destroyNodeView(view)
				nodeViews.delete(id)
			}
		}

		this.dirty.structure = false
	}

	private syncArrows(root: Container) {
		if (!this.dirty.arrows) return
		this.arrowSystem.sync(this.arrows, root)
		this.dirty.arrows = false
	}

	private advanceOverlay() {
		if (!this.overlayView || !this.overlayState) return
		updateOverlayView({
			overlay: this.overlay,
			overlayState: this.overlayState,
			overlayView: this.overlayView,
			positionSpring: POSITION_SPRING,
			opacityLambda: OPACITY_LAMBDA,
			fillOpacityLambda: FILL_OPACITY_LAMBDA,
			borderAlphaLambda: BORDER_ALPHA_LAMBDA,
		})
	}

	/** Recomputes the row layout and each node's targets when dirty, then clears the flags */
	private resolveTargets(layoutNow: SvgEffectLayoutConfig, tuningNow: PixiEffectTuning): NodeTarget[] {
		const currentNodes = this.renderNodes

		let layoutTargets = this.layoutTargets
		if (!layoutTargets || this.dirty.layout) {
			layoutTargets = computeLayoutTargets({
				nodes: currentNodes,
				layout: layoutNow,
				gap: this.gap,
				paddingX: this.paddingX,
				paddingTop: this.paddingTop,
				width: this.width,
				sizeOverrides: this.sizeOverrides,
				arrows: this.arrows,
				gapAfterOverrides: this.gapAfterOverrides,
			})
			this.layoutTargets = layoutTargets
		}

		let nodeTargets = this.nodeTargets
		if (!nodeTargets || this.dirty.targets || this.dirty.layout) {
			const enteringIds = this.enteringNodes.size > 0 ? new Set(this.enteringNodes.keys()) : undefined
			nodeTargets = buildNodeTargets({
				nodes: currentNodes,
				layoutTargets,
				layout: layoutNow,
				gap: this.gap,
				tuning: tuningNow,
				palette: this.palette,
				sizeOverrides: this.sizeOverrides,
				contentOpacityOverrides: this.contentOpacityOverrides,
				fillOpacityOverrides: this.fillOpacityOverrides,
				borderAlphaOverrides: this.borderAlphaOverrides,
				borderWidthOverrides: this.borderWidthOverrides,
				borderColorOverrides: this.borderColorOverrides,
				iconOpacityOverrides: this.iconOpacityOverrides,
				labelOpacityOverrides: this.labelOpacityOverrides,
				widthSpringBase: WIDTH_SPRING,
				widthSpringBouncy: WIDTH_SPRING_BOUNCY,
				arrowByAfterIndex: this.arrowByAfterIndex,
				gapAfterOverrides: this.gapAfterOverrides,
				...(enteringIds && { enteringIds }),
			})
			this.nodeTargets = nodeTargets
		}
		this.dirty.layout = false
		this.dirty.targets = false

		return nodeTargets
	}

	/** Steps every node view toward its target */
	private advanceNodes(
		app: Application,
		nodeTargets: NodeTarget[],
		{ dt, time, layout, tuning }: { dt: number; time: number; layout: SvgEffectLayoutConfig; tuning: PixiEffectTuning },
	) {
		const nodeContext = {
			dt,
			time,
			layout,
			tuning,
			palette: this.palette,
			positionSpring: POSITION_SPRING,
			heightSpringRunning: HEIGHT_SPRING_RUNNING,
			heightSpringRest: HEIGHT_SPRING_REST,
			opacityLambda: OPACITY_LAMBDA,
			fillOpacityLambda: FILL_OPACITY_LAMBDA,
			borderAlphaLambda: BORDER_ALPHA_LAMBDA,
			jitterLambda: JITTER_LAMBDA,
		}

		for (const target of nodeTargets) {
			const view = this.nodeViews.get(target.node.id)
			if (!view) continue
			updateNodeView({
				app,
				view,
				target,
				context: nodeContext,
			})
		}
	}

	/** Reports each active node's live size and centre to `onFrame` */
	private emitFrame(layoutNow: SvgEffectLayoutConfig) {
		if (!this.onFrame) return
		const nodeViews = this.nodeViews
		const frameNodes = this.nodes.map((node) => {
			const view = nodeViews.get(node.id)
			if (!view) {
				return {
					id: node.id,
					width: layoutNow.nodeSize,
					height: layoutNow.nodeSize,
					centerX: 0,
					centerY: 0,
				}
			}
			const state = view.state
			return {
				id: node.id,
				width: state.width,
				height: state.height,
				centerX: state.centerX,
				centerY: state.centerY,
			}
		})
		this.onFrame({ nodes: frameNodes })
	}

	private buildRenderNodes(activeNodes: SvgEffectNodeSpec[]) {
		if (this.exitingNodes.size === 0) return activeNodes
		const exiting = Array.from(this.exitingNodes.values(), (record) => record.node)
		return [...activeNodes, ...exiting]
	}

	private cleanupExitingNodes({ time, nodeViews }: { time: number; nodeViews: Map<string, NodeView> }) {
		if (this.exitingNodes.size === 0) return

		const EXIT_MIN_DURATION_MS = 260
		const EXIT_SCALE_THRESHOLD = 0.04
		const EXIT_OPACITY_THRESHOLD = 0.04

		const removals: string[] = []
		for (const [id, record] of this.exitingNodes.entries()) {
			if (record.startedAt < 0) record.startedAt = time
			const view = nodeViews.get(id)
			if (!view) {
				removals.push(id)
				continue
			}
			if (time - record.startedAt < EXIT_MIN_DURATION_MS) continue

			const state = view.state
			const scaleDone = state.nodeScale <= EXIT_SCALE_THRESHOLD
			const fillDone = state.fillOpacity <= EXIT_OPACITY_THRESHOLD
			const contentDone = state.contentOpacity <= EXIT_OPACITY_THRESHOLD
			const labelDone = state.labelExitText
				? state.labelExitOpacity <= EXIT_OPACITY_THRESHOLD
				: state.labelOpacity <= EXIT_OPACITY_THRESHOLD
			const bubbleDone = state.bubbleMessage ? state.bubbleOpacity <= EXIT_OPACITY_THRESHOLD : true

			if (scaleDone && fillDone && contentDone && labelDone && bubbleDone) {
				destroyNodeView(view)
				nodeViews.delete(id)
				removals.push(id)
			}
		}

		if (removals.length === 0) return
		for (const id of removals) {
			this.exitingNodes.delete(id)
		}
		this.renderNodes = this.buildRenderNodes(this.nodes)
		this.nodeIdSet = new Set(this.renderNodes.map((node) => node.id))
		this.nodeIdKey = buildNodeIdKey(this.renderNodes)
		this.dirty.layout = true
		this.dirty.targets = true
	}

	private cleanupEnteringNodes({ time }: { time: number }) {
		if (this.enteringNodes.size === 0) return

		const ENTER_MIN_DURATION_MS = 240

		const removals: string[] = []
		for (const [id, record] of this.enteringNodes.entries()) {
			if (record.startedAt < 0) record.startedAt = time
			if (time - record.startedAt < ENTER_MIN_DURATION_MS) continue
			removals.push(id)
		}

		if (removals.length === 0) return
		for (const id of removals) {
			this.enteringNodes.delete(id)
		}
	}

	destroy() {
		this.disposed = true
		const app = this.app
		if (!app) return

		if (this.frameProcess) {
			cancelFrame(this.frameProcess)
		}
		this.resizeObserver?.disconnect()
		for (const view of this.nodeViews.values()) {
			destroyNodeView(view)
		}
		this.nodeViews.clear()
		this.arrowSystem.clear()
		if (this.nodesRoot && !this.nodesRoot.destroyed) {
			this.nodesRoot.filters = null
		}
		if (this.overlayView) {
			if (!this.overlayView.fill.destroyed) this.overlayView.fill.filters = null
			if (!this.overlayView.border.destroyed) this.overlayView.border.filters = null
			destroyBlurFilter(this.overlayView.blur)
		}
		destroyBlurFilter(this.nodesBlur)

		if (this.rowRoot && !isPixiRendererDestroyed(app) && !isContainerDestroyed(app.stage) && !this.rowRoot.destroyed) {
			app.stage.removeChild(this.rowRoot)
		}
		if (this.rowRoot && !this.rowRoot.destroyed) {
			this.rowRoot.destroy({ children: true })
		}
		this.exitingNodes.clear()
		this.enteringNodes.clear()
		this.activeIdSet.clear()
		this.lastNodeById.clear()
		this.renderNodes = []
		for (const axis of [this.stageMotion.scale, this.stageMotion.opacity, this.stageMotion.x, this.stageMotion.y]) {
			axis.control?.stop()
		}
		if (this.nodeMotion.blur) {
			this.nodeMotion.blur.control?.stop()
		}
		for (const axis of [this.nodeMotion.scale, this.nodeMotion.opacity, this.nodeMotion.x, this.nodeMotion.y]) {
			axis.control?.stop()
		}
		if (this.overlayState) {
			this.overlayState.xControl?.stop()
			this.overlayState.yControl?.stop()
			this.overlayState.widthControl?.stop()
			this.overlayState.heightControl?.stop()
			this.overlayState.labelXControl?.stop()
			this.overlayState.labelYControl?.stop()
			this.overlayState.opacity.control?.stop()
			this.overlayState.fillOpacity.control?.stop()
			this.overlayState.borderAlpha.control?.stop()
			this.overlayState.labelOpacity.control?.stop()
		}
		this.rowRoot = null
		this.nodesRoot = null
		this.nodesBlur = null
		this.overlayView = null
		this.overlayState = null
		this.lastLayout = null
		this.frameProcess = null

		if (this.ownsApp && this.initialized) {
			const canvas = app.canvas as HTMLCanvasElement | undefined
			app.destroy(true, { children: true })
			if (canvas && canvas.parentNode === this.container) {
				this.container.removeChild(canvas)
			}
		}
		this.app = null
	}
}
