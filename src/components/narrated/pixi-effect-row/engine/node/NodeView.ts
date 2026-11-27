import {
	type Application,
	BlurFilter,
	Container,
	Filter,
	GlProgram,
	Graphics,
	RenderTexture,
	Sprite,
	Text,
	TextStyle,
	Texture,
} from "pixi.js"
import { getContentText, normalizeText, type SvgEffectLayoutConfig } from "@/lib/hierarchy/svgEffectLayout"
import type { SvgEffectNodeSpec } from "@/lib/hierarchy/types"
import { destroyBlurFilter, isPixiRendererDestroyed } from "../application"
import { drawIconKind, type NodeIconKind } from "../icons"
import type { NodeTarget } from "../layout"
import { getNodeIcon } from "../layout"
import { applyBlur, hexToRgb } from "../math"
import type { Palette } from "../palette"
import { ENERGY_FRAGMENT, ENERGY_VERTEX, FAILURE_PULSE_FRAGMENT } from "../shaders"
import type { PixiEffectTuning } from "../types"
import {
	advanceNodeState,
	createNodeFrame,
	createNodeMotionDriver,
	type NodeAdvanceContext,
	type NodeAnimState,
	type NodeFrame,
	type NodeMotionDriver,
} from "./NodeController"

interface BoxRenderCache {
	width: number
	height: number
	color: number
}

interface BorderRenderCache {
	boxWidth: number
	boxHeight: number
	width: number
	color: number
	alpha: number
	pulseAlpha: number
	pulseColor: number
}

interface GlowRenderCache {
	width: number
	height: number
	color: number
}

interface IconRenderCache {
	kind: NodeIconKind
	color: number
}

interface BubbleRenderCache {
	width: number
	height: number
	color: number
}

interface NodeRenderCache {
	box: BoxRenderCache
	border: BorderRenderCache
	glow: GlowRenderCache
	icon: IconRenderCache
	iconExit: IconRenderCache
	bubble: BubbleRenderCache
}

export interface NodeView {
	container: Container
	motion: NodeMotionDriver
	boxSprite: Sprite
	nodeBlur: BlurFilter
	sweepContainer: Container
	sweepBox: Graphics
	sweepSprite: Sprite
	sweepTexture: RenderTexture
	failurePulseContainer: Container
	failurePulseBox: Graphics
	failurePulseSprite: Sprite
	failurePulseTexture: RenderTexture
	failurePulseFilter: Filter
	icon: Graphics
	iconBlur: BlurFilter
	iconExit: Graphics
	iconExitBlur: BlurFilter
	border: Graphics
	glow: Graphics
	glowBlur: BlurFilter
	energyFilter: Filter
	contentText: Text
	contentBlur: BlurFilter
	labelText: Text
	labelBlurFilter: BlurFilter
	labelExitText: Text
	labelExitBlurFilter: BlurFilter
	bubbleContainer: Container
	bubbleBg: Graphics
	bubbleText: Text
	bubbleBlur: BlurFilter
	state: NodeAnimState
	frame: NodeFrame
	renderCache: NodeRenderCache
	sweepFailureUntil: number
	pulseFailureUntil: number
	// Stored for filter recreation on failure
	layout: SvgEffectLayoutConfig
	tuning: PixiEffectTuning
}

const BLUR_PADDING_SCALE = 3
const NODE_BLUR_MIN_PADDING = 24
const ICON_BLUR_MIN_PADDING = 12

function destroyFilter(filter: Filter) {
	filter.destroy(true)
}

function destroyRenderTexture(texture: RenderTexture) {
	if (texture.destroyed) return
	texture.destroy(true)
}

function destroyDisplayObject(
	displayObject: { destroyed: boolean; destroy: (options?: { children?: boolean }) => void },
	options?: { children?: boolean },
) {
	if (displayObject.destroyed) return
	displayObject.destroy(options)
}

function applyBlurWithPadding(filter: BlurFilter, strength: number, minPadding: number) {
	applyBlur(filter, strength)
	if (!filter.enabled) return
	const targetPadding = Math.max(minPadding, Math.ceil(strength * BLUR_PADDING_SCALE))
	if (filter.padding !== targetPadding) {
		filter.padding = targetPadding
	}
}

/** Create a fresh energy filter - used for initial creation and recovery from failures */
function createEnergyFilter(layout: SvgEffectLayoutConfig, tuning: PixiEffectTuning): Filter {
	return new Filter({
		glProgram: new GlProgram({ vertex: ENERGY_VERTEX, fragment: ENERGY_FRAGMENT }),
		resources: {
			timeUniforms: {
				uTime: { value: 0, type: "f32" },
			},
			sizeUniforms: {
				uSize: { value: new Float32Array([layout.nodeSize, layout.nodeSize]), type: "vec2<f32>" },
			},
			sweepUniforms: {
				uSpeed: { value: tuning.sweepSpeed, type: "f32" },
				uBandWidth: { value: tuning.sweepWidth, type: "f32" },
				uBandSoftness: { value: tuning.sweepSoftness, type: "f32" },
				uBandSpacing: { value: tuning.sweepSpacing, type: "f32" },
				uBandCount: { value: tuning.sweepCount, type: "f32" },
				uIntensity: { value: tuning.sweepIntensity, type: "f32" },
				uMix: { value: tuning.sweepMix, type: "f32" },
				uInsetX: { value: tuning.sweepInsetX, type: "f32" },
				uInsetTop: { value: tuning.sweepInsetTop, type: "f32" },
				uInsetBottom: { value: tuning.sweepInsetBottom, type: "f32" },
				uPulseSpeed: { value: tuning.sweepPulseSpeed, type: "f32" },
				uRotation: { value: 0, type: "f32" },
			},
		},
	})
}

/** Create a fresh failure pulse filter - used for initial creation and recovery from failures */
function createFailurePulseFilter(layout: SvgEffectLayoutConfig, tuning: PixiEffectTuning): Filter {
	return new Filter({
		glProgram: new GlProgram({ vertex: ENERGY_VERTEX, fragment: FAILURE_PULSE_FRAGMENT }),
		resources: {
			timeUniforms: {
				uTime: { value: 0.0, type: "f32" },
			},
			sizeUniforms: {
				uSize: {
					value: new Float32Array([layout.nodeSize, layout.nodeSize]),
					type: "vec2<f32>",
				},
			},
			pulseUniforms: {
				uProgress: { value: 0.0, type: "f32" },
				uWidth: { value: tuning.failurePulseWidth, type: "f32" },
				uSoftness: { value: tuning.failurePulseSoftness, type: "f32" },
				uIntensity: { value: tuning.failurePulseIntensity, type: "f32" },
				uNoise: { value: tuning.failurePulseNoise, type: "f32" },
				uColorMix: { value: tuning.failurePulseColorMix, type: "f32" },
				uTail: { value: tuning.failurePulseTail, type: "f32" },
				uFadeIn: { value: tuning.failurePulseFadeIn, type: "f32" },
				uFadeOut: { value: tuning.failurePulseFadeOut, type: "f32" },
				uNoiseScale: { value: tuning.failurePulseNoiseScale, type: "f32" },
				uColor: { value: new Float32Array([1, 0, 0]), type: "vec3<f32>" },
			},
		},
	})
}

export function applyLayoutToNodeView(view: NodeView, layout: SvgEffectLayoutConfig, app: Application) {
	view.layout = layout
	view.contentText.style.fontFamily = layout.fontFamily
	view.contentText.style.fontSize = layout.contentFontSize
	view.labelText.style.fontFamily = layout.fontFamily
	view.labelText.style.fontSize = layout.labelFontSize
	view.labelExitText.style.fontFamily = layout.fontFamily
	view.labelExitText.style.fontSize = layout.labelFontSize
	view.bubbleText.style.fontFamily = layout.fontFamily
	view.bubbleText.style.fontSize = layout.bubbleFontSize ?? layout.labelFontSize

	const nodeSize = layout.nodeSize
	const resolution = app.renderer.resolution
	view.nodeBlur.resolution = resolution * 2
	view.glowBlur.resolution = resolution
	view.contentBlur.resolution = resolution
	view.contentText.resolution = resolution * 2
	view.labelBlurFilter.resolution = resolution
	view.labelText.resolution = resolution * 2
	view.labelExitBlurFilter.resolution = resolution
	view.labelExitText.resolution = resolution * 2
	view.bubbleBlur.resolution = resolution
	view.iconBlur.resolution = resolution * 3
	view.iconExitBlur.resolution = resolution * 3
	if (
		view.sweepTexture.width !== nodeSize ||
		view.sweepTexture.height !== nodeSize ||
		view.sweepTexture.source.resolution !== resolution
	) {
		destroyRenderTexture(view.sweepTexture)
		view.sweepTexture = RenderTexture.create({ width: nodeSize, height: nodeSize, resolution })
		view.sweepSprite.texture = view.sweepTexture
	}
	if (
		view.failurePulseTexture.width !== nodeSize ||
		view.failurePulseTexture.height !== nodeSize ||
		view.failurePulseTexture.source.resolution !== resolution
	) {
		destroyRenderTexture(view.failurePulseTexture)
		view.failurePulseTexture = RenderTexture.create({ width: nodeSize, height: nodeSize, resolution })
		view.failurePulseSprite.texture = view.failurePulseTexture
	}
}

export function createNodeView({
	app,
	root,
	node,
	layout,
	tuning,
	palette,
	contentOpacityOverrides,
	fillOpacityOverrides,
	labelOpacityOverrides,
}: {
	app: Application
	root: Container
	node: SvgEffectNodeSpec
	layout: SvgEffectLayoutConfig
	tuning: PixiEffectTuning
	palette: Palette
	contentOpacityOverrides: Record<string, number> | undefined
	fillOpacityOverrides: Record<string, number> | undefined
	labelOpacityOverrides: Record<string, number> | undefined
}): NodeView {
	const filterResolution = app.renderer.resolution
	const container = new Container()
	const motion = createNodeMotionDriver(layout.nodeSize)
	const nodeBlur = new BlurFilter({ strengthX: 0, strengthY: 0, quality: 4 })
	nodeBlur.repeatEdgePixels = false
	nodeBlur.enabled = false
	nodeBlur.resolution = filterResolution * 2
	nodeBlur.padding = NODE_BLUR_MIN_PADDING
	const boxSprite = new Sprite(Texture.WHITE)
	boxSprite.anchor.set(0.5)
	boxSprite.position.set(0, 0)
	const border = new Graphics()
	const glowBlur = new BlurFilter({ strengthX: 8, strengthY: 8, quality: 2 })
	glowBlur.repeatEdgePixels = true
	glowBlur.resolution = filterResolution

	const contentStyle = new TextStyle({
		fontFamily: layout.fontFamily,
		fontSize: layout.contentFontSize,
		fontWeight: "500",
		fill: 0xffffff,
	})
	const labelStyle = new TextStyle({
		fontFamily: layout.fontFamily,
		fontSize: layout.labelFontSize,
		fill: 0xffffff,
	})
	const bubbleStyle = new TextStyle({
		fontFamily: layout.fontFamily,
		fontSize: layout.bubbleFontSize ?? layout.labelFontSize,
		fill: 0xffffff,
	})

	const contentText = new Text({
		text: "",
		style: contentStyle,
		resolution: filterResolution * 2,
	})
	contentText.anchor.set(0.5)
	contentText.roundPixels = true
	const contentBlur = new BlurFilter({ strengthX: 0, strengthY: 0, quality: 2 })
	contentBlur.repeatEdgePixels = true
	contentBlur.enabled = false
	contentBlur.resolution = filterResolution
	contentText.filters = [contentBlur]
	const labelText = new Text({
		text: node.name,
		style: labelStyle,
		resolution: filterResolution * 2,
	})
	labelText.anchor.set(0.5, 0)
	labelText.roundPixels = true
	const initialLabelAlpha = labelOpacityOverrides?.[node.id] ?? (node.visualState === "idle" ? 0.45 : 0.7)
	labelText.alpha = initialLabelAlpha
	const labelBlurFilter = new BlurFilter({ strengthX: 0, strengthY: 0, quality: 2 })
	labelBlurFilter.repeatEdgePixels = true
	labelBlurFilter.enabled = false
	labelBlurFilter.resolution = filterResolution
	labelText.filters = [labelBlurFilter]
	const labelExitText = new Text({
		text: "",
		style: labelStyle,
		resolution: filterResolution * 2,
	})
	labelExitText.anchor.set(0.5, 0)
	labelExitText.roundPixels = true
	labelExitText.alpha = 0
	const labelExitBlurFilter = new BlurFilter({ strengthX: 0, strengthY: 0, quality: 2 })
	labelExitBlurFilter.repeatEdgePixels = true
	labelExitBlurFilter.enabled = false
	labelExitBlurFilter.resolution = filterResolution
	labelExitText.filters = [labelExitBlurFilter]

	const bubbleContainer = new Container()
	const bubbleBg = new Graphics()
	const bubbleText = new Text({ text: "", style: bubbleStyle })
	bubbleText.anchor.set(0.5)
	const bubbleBlur = new BlurFilter({ strengthX: 0, strengthY: 0, quality: 2 })
	bubbleBlur.repeatEdgePixels = true
	bubbleBlur.enabled = false
	bubbleBlur.resolution = filterResolution
	bubbleContainer.filters = [bubbleBlur]
	bubbleContainer.addChild(bubbleBg, bubbleText)
	bubbleContainer.visible = false

	const glow = new Graphics()
	glow.blendMode = "screen"
	glow.filters = [glowBlur]

	const sweepContainer = new Container()
	const sweepBox = new Graphics()
	sweepContainer.addChild(sweepBox)
	const failurePulseContainer = new Container()
	const failurePulseBox = new Graphics()
	failurePulseContainer.addChild(failurePulseBox)

	const icon = new Graphics()
	const iconBlur = new BlurFilter({ strengthX: 0, strengthY: 0, quality: 4, kernelSize: 11 })
	iconBlur.repeatEdgePixels = true
	iconBlur.enabled = false
	iconBlur.resolution = filterResolution * 3
	iconBlur.padding = ICON_BLUR_MIN_PADDING
	icon.filters = [iconBlur]
	const iconExit = new Graphics()
	const iconExitBlur = new BlurFilter({ strengthX: 0, strengthY: 0, quality: 4, kernelSize: 11 })
	iconExitBlur.repeatEdgePixels = true
	iconExitBlur.enabled = false
	iconExitBlur.resolution = filterResolution * 3
	iconExitBlur.padding = ICON_BLUR_MIN_PADDING
	iconExit.filters = [iconExitBlur]
	const initialIcon = getNodeIcon(node)
	const initialContent = initialIcon === "none" ? getContentText(node) : null
	const initialContentOpacity = contentOpacityOverrides?.[node.id] ?? (node.visualState === "running" ? 0 : 1)
	const initialFillOpacity = fillOpacityOverrides?.[node.id] ?? 1

	const energyFilter = createEnergyFilter(layout, tuning)
	sweepBox.filters = [energyFilter]
	energyFilter.enabled = false

	const failurePulseFilter = createFailurePulseFilter(layout, tuning)

	failurePulseBox.filters = [failurePulseFilter]
	failurePulseFilter.enabled = false
	container.filters = [nodeBlur]

	const sweepTexture = RenderTexture.create({
		width: layout.nodeSize,
		height: layout.nodeSize,
		resolution: app.renderer.resolution,
	})
	const sweepSprite = new Sprite(sweepTexture)
	sweepSprite.anchor.set(0.5)
	sweepSprite.position.set(0, 0)
	sweepSprite.visible = false

	const failurePulseTexture = RenderTexture.create({
		width: layout.nodeSize,
		height: layout.nodeSize,
		resolution: app.renderer.resolution,
	})
	const failurePulseSprite = new Sprite(failurePulseTexture)
	failurePulseSprite.anchor.set(0.5)
	failurePulseSprite.position.set(0, 0)
	failurePulseSprite.blendMode = "add"
	failurePulseSprite.visible = false

	container.addChild(glow, sweepSprite, boxSprite, failurePulseSprite, iconExit, icon, border, contentText)

	if (node.hidden) {
		container.scale.set(0)
	}

	root.addChild(container, bubbleContainer, labelExitText, labelText)

	const initialColor = palette[node.visualState] ?? palette.idle
	const initialRgb = hexToRgb(initialColor)

	const state: NodeAnimState = {
		width: layout.nodeSize,
		widthTarget: layout.nodeSize,
		height: layout.nodeSize,
		heightTarget: layout.nodeSize,
		centerX: 0,
		centerXTarget: 0,
		centerY: 0,
		centerYTarget: 0,
		hasLayout: false,
		contentOpacity: initialContentOpacity,
		contentScale: 1,
		contentBlur: 0,
		fillOpacity: initialFillOpacity,
		labelOpacity: initialLabelAlpha,
		labelBlur: 0,
		labelScale: 1,
		labelText: node.name,
		labelGlitchText: null,
		labelGlitchTick: -1,
		labelIsDeath: node.visualState === "death",
		labelExitIsDeath: false,
		labelExitText: null,
		labelExitOpacity: 0,
		labelExitBlur: 0,
		labelExitScale: 1,
		labelWasHidden: node.hidden ?? false,
		borderAlpha: palette.borderAlpha,
		prevContent: initialContent,
		contentText: initialContent ? normalizeText(initialContent) : "",
		iconKind: initialIcon,
		iconOpacity: initialIcon === "none" ? 0 : 1,
		iconScale: 1,
		iconBlur: 0,
		iconExitKind: "none",
		iconExitOpacity: 0,
		iconExitScale: 1,
		iconExitBlur: 0,
		bubbleOpacity: 0,
		bubbleScale: 1,
		bubbleBlur: 0,
		bubbleYOffset: 0,
		bubbleYOffsetTarget: 0,
		prevBubbleKey: null,
		bubbleMessage: null,
		bubbleType: null,
		bubbleFlashTimer: 0,
		colorR: initialRgb.r,
		colorG: initialRgb.g,
		colorB: initialRgb.b,
		borderColorR: 1,
		borderColorG: 1,
		borderColorB: 1,
		flashTimer: 0,
		flashDuration: tuning.flashDuration,
		flashMix: tuning.flashMix,
		flashColorR: initialRgb.r,
		flashColorG: initialRgb.g,
		flashColorB: initialRgb.b,
		failureJitterRemaining: 0,
		failurePulseTimer: 0,
		failurePulseDuration: tuning.failurePulseDuration,
		successPulseTimer: 0,
		successPulseDuration: tuning.successPulseDuration,
		jitterX: 0,
		jitterY: 0,
		jitterRot: 0,
		jitterTargetX: 0,
		jitterTargetY: 0,
		jitterTargetRot: 0,
		jitterTimer: 0,
		prevState: node.visualState,
		nodeScale: node.hidden ? 0 : 1,
		nodeBlur: node.hidden ? 6 : 0,
		wasHidden: node.hidden === true,
	}

	motion.syncFromState(state)

	return {
		container,
		motion,
		boxSprite,
		nodeBlur,
		sweepContainer,
		sweepBox,
		sweepSprite,
		sweepTexture,
		failurePulseContainer,
		failurePulseBox,
		failurePulseSprite,
		failurePulseTexture,
		failurePulseFilter,
		icon,
		iconBlur,
		iconExit,
		iconExitBlur,
		border,
		glow,
		glowBlur,
		energyFilter,
		contentText,
		contentBlur,
		labelText,
		labelBlurFilter,
		labelExitText,
		labelExitBlurFilter,
		bubbleContainer,
		bubbleBg,
		bubbleText,
		bubbleBlur,
		state,
		frame: createNodeFrame(),
		renderCache: {
			box: { width: -1, height: -1, color: -1 },
			border: {
				boxWidth: -1,
				boxHeight: -1,
				width: -1,
				color: -1,
				alpha: -1,
				pulseAlpha: -1,
				pulseColor: -1,
			},
			glow: { width: -1, height: -1, color: -1 },
			icon: { kind: "none", color: -1 },
			iconExit: { kind: "none", color: -1 },
			bubble: { width: -1, height: -1, color: -1 },
		},
		sweepFailureUntil: 0,
		pulseFailureUntil: 0,
		layout,
		tuning,
	}
}

export function destroyNodeView(view: NodeView) {
	view.motion.stop()
	if (!view.container.destroyed) view.container.filters = null
	if (!view.sweepBox.destroyed) view.sweepBox.filters = null
	if (!view.failurePulseBox.destroyed) view.failurePulseBox.filters = null
	if (!view.icon.destroyed) view.icon.filters = null
	if (!view.iconExit.destroyed) view.iconExit.filters = null
	if (!view.contentText.destroyed) view.contentText.filters = null
	if (!view.labelText.destroyed) view.labelText.filters = null
	if (!view.labelExitText.destroyed) view.labelExitText.filters = null
	if (!view.bubbleContainer.destroyed) view.bubbleContainer.filters = null
	if (!view.glow.destroyed) view.glow.filters = null

	view.container.parent?.removeChild(view.container)
	view.bubbleContainer.parent?.removeChild(view.bubbleContainer)
	view.labelText.parent?.removeChild(view.labelText)
	view.labelExitText.parent?.removeChild(view.labelExitText)

	destroyDisplayObject(view.container, { children: true })
	destroyDisplayObject(view.labelText)
	destroyDisplayObject(view.labelExitText)
	destroyDisplayObject(view.bubbleContainer, { children: true })
	destroyDisplayObject(view.sweepContainer, { children: true })
	destroyDisplayObject(view.failurePulseContainer, { children: true })
	destroyBlurFilter(view.nodeBlur)
	destroyBlurFilter(view.glowBlur)
	destroyFilter(view.energyFilter)
	destroyFilter(view.failurePulseFilter)
	destroyBlurFilter(view.iconBlur)
	destroyBlurFilter(view.iconExitBlur)
	destroyBlurFilter(view.contentBlur)
	destroyBlurFilter(view.labelBlurFilter)
	destroyBlurFilter(view.labelExitBlurFilter)
	destroyBlurFilter(view.bubbleBlur)
	destroyRenderTexture(view.sweepTexture)
	destroyRenderTexture(view.failurePulseTexture)
}

function renderNodeTransform(view: NodeView, frame: NodeFrame) {
	view.container.position.set(frame.transform.x, frame.transform.y)
	view.container.rotation = frame.transform.rotation
	view.container.scale.set(frame.transform.scale)
	applyBlurWithPadding(view.nodeBlur, view.state.nodeBlur, NODE_BLUR_MIN_PADDING)
}

function renderNodeBox(view: NodeView, frame: NodeFrame) {
	const cache = view.renderCache.box
	if (cache.width !== frame.box.width || cache.height !== frame.box.height) {
		view.boxSprite.width = frame.box.width
		view.boxSprite.height = frame.box.height
		cache.width = frame.box.width
		cache.height = frame.box.height
	}
	const safeColor = Math.max(0, Math.min(0xffffff, Math.round(frame.box.color)))
	if (cache.color !== safeColor) {
		view.boxSprite.tint = safeColor
		cache.color = safeColor
	}
	view.boxSprite.alpha = frame.box.alpha
}

function renderNodeBorder(view: NodeView, frame: NodeFrame) {
	const visible = frame.border.alpha > 0.001 || frame.border.pulseAlpha > 0.001
	view.border.visible = visible
	if (!visible) return

	const cache = view.renderCache.border
	const needsRedraw =
		cache.boxWidth !== frame.box.width ||
		cache.boxHeight !== frame.box.height ||
		cache.width !== frame.border.width ||
		cache.color !== frame.border.color ||
		cache.alpha !== frame.border.alpha ||
		cache.pulseAlpha !== frame.border.pulseAlpha ||
		cache.pulseColor !== frame.border.pulseColor

	if (!needsRedraw) return

	view.border.clear()
	view.border.setStrokeStyle({
		width: frame.border.width,
		color: frame.border.color,
		alpha: frame.border.alpha,
		alignment: 1,
		join: "round",
		cap: "round",
	})
	view.border.beginPath()
	view.border.rect(-frame.box.width / 2, -frame.box.height / 2, frame.box.width, frame.box.height)
	view.border.stroke()

	if (frame.border.pulseAlpha > 0.001) {
		view.border.setStrokeStyle({
			width: 1,
			color: frame.border.pulseColor,
			alpha: frame.border.pulseAlpha,
			alignment: 1,
			join: "round",
			cap: "round",
		})
		view.border.beginPath()
		view.border.rect(-frame.box.width / 2, -frame.box.height / 2, frame.box.width, frame.box.height)
		view.border.stroke()
	}

	cache.boxWidth = frame.box.width
	cache.boxHeight = frame.box.height
	cache.width = frame.border.width
	cache.color = frame.border.color
	cache.alpha = frame.border.alpha
	cache.pulseAlpha = frame.border.pulseAlpha
	cache.pulseColor = frame.border.pulseColor
}

function renderNodeIcons(view: NodeView, frame: NodeFrame) {
	renderIconView({
		graphics: view.iconExit,
		blur: view.iconExitBlur,
		cache: view.renderCache.iconExit,
		kind: frame.iconExit.kind,
		opacity: frame.iconExit.opacity,
		scale: frame.iconExit.scale,
		blurStrength: frame.iconExit.blur,
		baseScale: frame.iconBaseScale,
		color: frame.iconExit.color,
	})
	renderIconView({
		graphics: view.icon,
		blur: view.iconBlur,
		cache: view.renderCache.icon,
		kind: frame.icon.kind,
		opacity: frame.icon.opacity,
		scale: frame.icon.scale,
		blurStrength: frame.icon.blur,
		baseScale: frame.iconBaseScale,
		color: frame.icon.color,
	})
}

function renderNodeContent(view: NodeView, frame: NodeFrame) {
	if (frame.content.visible) {
		if (view.contentText.text !== frame.content.text) {
			view.contentText.text = frame.content.text
		}
		if (view.contentText.alpha !== frame.content.opacity) {
			view.contentText.alpha = frame.content.opacity
		}
		if (view.contentText.tint !== frame.content.color) {
			view.contentText.tint = frame.content.color
		}
		view.contentText.position.set(0, 0)
		view.contentText.scale.set(frame.content.scale)
		applyBlur(view.contentBlur, frame.content.blur)
	} else {
		if (view.contentText.text !== "") {
			view.contentText.text = ""
		}
		if (view.contentText.alpha !== 0) {
			view.contentText.alpha = 0
		}
		view.contentText.scale.set(1)
		applyBlur(view.contentBlur, 0)
	}
}

function renderNodeGlow(view: NodeView, frame: NodeFrame) {
	view.glow.visible = frame.glow.visible
	if (frame.glow.visible) {
		const cache = view.renderCache.glow
		if (cache.width !== frame.box.width || cache.height !== frame.box.height || cache.color !== frame.glow.color) {
			view.glow.clear()
			view.glow
				.rect(-frame.box.width / 2, -frame.box.height / 2, frame.box.width, frame.box.height)
				.fill({ color: frame.glow.color })
			cache.width = frame.box.width
			cache.height = frame.box.height
			cache.color = frame.glow.color
		}
		view.glow.alpha = frame.glow.alpha
	}
}

function renderNodeSweep(app: Application, view: NodeView, frame: NodeFrame) {
	const now = typeof performance === "undefined" ? Date.now() : performance.now()
	const sweepEnabled =
		frame.sweep.enabled &&
		Number.isFinite(frame.sweep.width) &&
		Number.isFinite(frame.sweep.height) &&
		frame.sweep.width > 0 &&
		frame.sweep.height > 0
	const sweepReady =
		sweepEnabled &&
		!view.sweepContainer.destroyed &&
		!view.sweepBox.destroyed &&
		!view.sweepTexture.destroyed &&
		now >= view.sweepFailureUntil
	view.energyFilter.enabled = sweepReady
	view.sweepSprite.visible = sweepReady
	view.sweepSprite.alpha = frame.box.alpha
	view.boxSprite.visible = !sweepReady
	if (!sweepReady) {
		if (sweepEnabled && now >= view.sweepFailureUntil) {
			view.sweepFailureUntil = now + 240
		}
		return
	}

	if (isPixiRendererDestroyed(app)) return

	view.sweepBox.clear()
	view.sweepBox.rect(0, 0, frame.sweep.width, frame.sweep.height).fill({
		color: frame.sweep.color,
	})

	view.energyFilter.resources.timeUniforms.uniforms.uTime = frame.sweep.time / 1000
	const sizeUniform = view.energyFilter.resources.sizeUniforms.uniforms.uSize as Float32Array
	sizeUniform[0] = frame.sweep.width
	sizeUniform[1] = frame.sweep.height
	const sweepUniforms = view.energyFilter.resources.sweepUniforms.uniforms as {
		uSpeed: number
		uBandWidth: number
		uBandSoftness: number
		uBandSpacing: number
		uBandCount: number
		uIntensity: number
		uMix: number
		uInsetX: number
		uInsetTop: number
		uInsetBottom: number
		uPulseSpeed: number
		uRotation: number
	}
	sweepUniforms.uSpeed = frame.sweep.uniforms.speed
	sweepUniforms.uBandWidth = frame.sweep.uniforms.bandWidth
	sweepUniforms.uBandSoftness = frame.sweep.uniforms.bandSoftness
	sweepUniforms.uBandSpacing = frame.sweep.uniforms.bandSpacing
	sweepUniforms.uBandCount = frame.sweep.uniforms.bandCount
	sweepUniforms.uIntensity = frame.sweep.uniforms.intensity
	sweepUniforms.uMix = frame.sweep.uniforms.mix
	sweepUniforms.uInsetX = frame.sweep.uniforms.insetX
	sweepUniforms.uInsetTop = frame.sweep.uniforms.insetTop
	sweepUniforms.uInsetBottom = frame.sweep.uniforms.insetBottom
	sweepUniforms.uPulseSpeed = frame.sweep.uniforms.pulseSpeed
	sweepUniforms.uRotation = frame.sweep.rotation

	try {
		app.renderer.render({
			container: view.sweepContainer,
			target: view.sweepTexture,
			clear: true,
		})
		view.sweepSprite.scale.set(frame.sweep.scaleX, frame.sweep.scaleY)
	} catch {
		// Filter is broken - destroy and recreate fresh
		destroyFilter(view.energyFilter)
		view.energyFilter = createEnergyFilter(view.layout, view.tuning)
		view.sweepBox.filters = [view.energyFilter]
		view.energyFilter.enabled = false
		view.sweepSprite.visible = false
		view.boxSprite.visible = true
		// Small cooldown to avoid rapid recreation loops
		view.sweepFailureUntil = now + 100
	}
}

function renderNodeFailurePulse(app: Application, view: NodeView, frame: NodeFrame) {
	const now = typeof performance === "undefined" ? Date.now() : performance.now()
	const pulseEnabled =
		frame.failurePulse.enabled &&
		Number.isFinite(frame.failurePulse.width) &&
		Number.isFinite(frame.failurePulse.height) &&
		frame.failurePulse.width > 0 &&
		frame.failurePulse.height > 0
	const pulseReady =
		pulseEnabled &&
		!view.failurePulseContainer.destroyed &&
		!view.failurePulseBox.destroyed &&
		!view.failurePulseTexture.destroyed &&
		now >= view.pulseFailureUntil
	view.failurePulseFilter.enabled = pulseReady
	view.failurePulseSprite.visible = pulseReady
	view.failurePulseSprite.alpha = frame.box.alpha
	if (!pulseReady) {
		if (pulseEnabled && now >= view.pulseFailureUntil) {
			view.pulseFailureUntil = now + 240
		}
		return
	}

	if (isPixiRendererDestroyed(app)) return

	view.failurePulseBox.clear()
	view.failurePulseBox.rect(0, 0, frame.failurePulse.width, frame.failurePulse.height).fill({
		color: 0xffffff,
	})

	view.failurePulseFilter.resources.timeUniforms.uniforms.uTime = frame.failurePulse.time
	const sizeUniform = view.failurePulseFilter.resources.sizeUniforms.uniforms.uSize as Float32Array
	sizeUniform[0] = frame.failurePulse.width
	sizeUniform[1] = frame.failurePulse.height

	const pulseUniforms = view.failurePulseFilter.resources.pulseUniforms.uniforms as {
		uProgress: number
		uWidth: number
		uSoftness: number
		uIntensity: number
		uNoise: number
		uColorMix: number
		uTail: number
		uFadeIn: number
		uFadeOut: number
		uNoiseScale: number
		uColor: Float32Array
	}
	pulseUniforms.uProgress = frame.failurePulse.uniforms.progress
	pulseUniforms.uWidth = frame.failurePulse.uniforms.width
	pulseUniforms.uSoftness = frame.failurePulse.uniforms.softness
	pulseUniforms.uIntensity = frame.failurePulse.uniforms.intensity
	pulseUniforms.uNoise = frame.failurePulse.uniforms.noise
	pulseUniforms.uColorMix = frame.failurePulse.uniforms.colorMix
	pulseUniforms.uTail = frame.failurePulse.uniforms.tail
	pulseUniforms.uFadeIn = frame.failurePulse.uniforms.fadeIn
	pulseUniforms.uFadeOut = frame.failurePulse.uniforms.fadeOut
	pulseUniforms.uNoiseScale = frame.failurePulse.uniforms.noiseScale
	pulseUniforms.uColor[0] = frame.failurePulse.color.r
	pulseUniforms.uColor[1] = frame.failurePulse.color.g
	pulseUniforms.uColor[2] = frame.failurePulse.color.b

	try {
		app.renderer.render({
			container: view.failurePulseContainer,
			target: view.failurePulseTexture,
			clear: true,
		})
		view.failurePulseSprite.scale.set(frame.failurePulse.scaleX, frame.failurePulse.scaleY)
	} catch {
		// Filter is broken - destroy and recreate fresh
		destroyFilter(view.failurePulseFilter)
		view.failurePulseFilter = createFailurePulseFilter(view.layout, view.tuning)
		view.failurePulseBox.filters = [view.failurePulseFilter]
		view.failurePulseFilter.enabled = false
		view.failurePulseSprite.visible = false
		// Small cooldown to avoid rapid recreation loops
		view.pulseFailureUntil = now + 100
	}
}

function renderNodeBubble(view: NodeView, frame: NodeFrame) {
	if (frame.bubble.visible) {
		view.bubbleContainer.visible = true
		if (view.bubbleText.text !== frame.bubble.message) {
			view.bubbleText.text = frame.bubble.message
		}
		if (view.bubbleText.style.fontSize !== frame.bubble.fontSize) {
			view.bubbleText.style.fontSize = frame.bubble.fontSize
		}
		if (view.bubbleText.style.fill !== frame.bubble.textColor) {
			view.bubbleText.style.fill = frame.bubble.textColor
		}
		view.bubbleText.alpha = 0.95

		const cache = view.renderCache.bubble
		if (
			cache.width !== frame.bubble.width ||
			cache.height !== frame.bubble.height ||
			cache.color !== frame.bubble.color
		) {
			view.bubbleBg.clear()
			view.bubbleBg.setFillStyle({ color: frame.bubble.color })
			view.bubbleBg.rect(0, 0, frame.bubble.width, frame.bubble.height).fill()
			view.bubbleBg
				.poly([
					frame.bubble.width / 2 - 6,
					frame.bubble.height,
					frame.bubble.width / 2 + 6,
					frame.bubble.height,
					frame.bubble.width / 2,
					frame.bubble.height + 6,
				])
				.fill()
			cache.width = frame.bubble.width
			cache.height = frame.bubble.height
			cache.color = frame.bubble.color
		}

		view.bubbleContainer.pivot.set(frame.bubble.width / 2, frame.bubble.height / 2)
		view.bubbleContainer.position.set(frame.bubble.x, frame.bubble.y)
		view.bubbleContainer.alpha = frame.bubble.opacity
		view.bubbleContainer.scale.set(frame.bubble.scale)
		applyBlur(view.bubbleBlur, frame.bubble.blur)
		view.bubbleText.position.set(frame.bubble.width / 2, frame.bubble.height / 2)
	} else {
		view.bubbleContainer.visible = false
		applyBlur(view.bubbleBlur, 0)
	}
}

function renderNodeLabels(view: NodeView, frame: NodeFrame) {
	const exitVisible = frame.labelExit.opacity > 0.01 && frame.labelExit.text.length > 0
	view.labelExitText.visible = exitVisible
	if (exitVisible) {
		if (view.labelExitText.text !== frame.labelExit.text) {
			view.labelExitText.text = frame.labelExit.text
		}
		if (view.labelExitText.tint !== frame.labelExit.color) {
			view.labelExitText.tint = frame.labelExit.color
		}
		view.labelExitText.alpha = frame.labelExit.opacity
		view.labelExitText.position.set(frame.labelExit.x, frame.labelExit.y)
		view.labelExitText.scale.set(frame.labelExit.scale)
		applyBlur(view.labelExitBlurFilter, frame.labelExit.blur, 0.1)
	} else {
		view.labelExitText.alpha = 0
		applyBlur(view.labelExitBlurFilter, 0)
	}

	if (view.labelText.text !== frame.label.text) {
		view.labelText.text = frame.label.text
	}
	if (view.labelText.tint !== frame.label.color) {
		view.labelText.tint = frame.label.color
	}
	view.labelText.alpha = frame.label.opacity
	view.labelText.position.set(frame.label.x, frame.label.y)
	view.labelText.scale.set(frame.label.scale)
	applyBlur(view.labelBlurFilter, frame.label.blur, 0.1)
}

function renderNodeFrame({ app, view, frame }: { app: Application; view: NodeView; frame: NodeFrame }) {
	renderNodeTransform(view, frame)
	renderNodeBox(view, frame)
	renderNodeFailurePulse(app, view, frame)
	renderNodeBorder(view, frame)
	renderNodeIcons(view, frame)
	renderNodeContent(view, frame)
	renderNodeGlow(view, frame)
	renderNodeSweep(app, view, frame)
	renderNodeBubble(view, frame)
	renderNodeLabels(view, frame)
}

export function updateNodeView({
	app,
	view,
	target,
	context,
}: {
	app: Application
	view: NodeView
	target: NodeTarget
	context: NodeAdvanceContext
}) {
	if (view.container.destroyed) return
	const frame = view.frame
	advanceNodeState({ state: view.state, target, context, frame, motion: view.motion })
	try {
		renderNodeFrame({ app, view, frame })
	} catch {
		view.energyFilter.enabled = false
		view.failurePulseFilter.enabled = false
		view.sweepSprite.visible = false
		view.failurePulseSprite.visible = false
		view.boxSprite.visible = true
	}
}

function renderIconView({
	graphics,
	blur,
	cache,
	kind,
	opacity,
	scale,
	blurStrength,
	baseScale,
	color,
}: {
	graphics: Graphics
	blur: BlurFilter
	cache: IconRenderCache
	kind: NodeIconKind
	opacity: number
	scale: number
	blurStrength: number
	baseScale: number
	color: number
}) {
	if (kind === "none") {
		graphics.visible = false
		cache.kind = "none"
		applyBlur(blur, 0)
		return
	}
	if (cache.kind !== kind || cache.color !== color) {
		drawIconKind(graphics, kind, color)
		cache.kind = kind
		cache.color = color
	}
	graphics.visible = true
	graphics.position.set(0, 0)
	graphics.alpha = opacity
	graphics.scale.set(scale * baseScale)
	applyBlurWithPadding(blur, blurStrength, ICON_BLUR_MIN_PADDING)
}
