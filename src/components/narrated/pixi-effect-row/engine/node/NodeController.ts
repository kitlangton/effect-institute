import { type AnimationPlaybackControls, animate, type MotionValue, motionValue } from "motion"
import { measureMonoText, normalizeText, type SvgEffectLayoutConfig } from "@/lib/hierarchy/svgEffectLayout"
import type { SvgEffectNodeSpec } from "@/lib/hierarchy/types"
import { taskSounds } from "@/lib/visual-effect/sounds/TaskSounds"
import { ICON_VIEWBOX, type NodeIconKind } from "../icons"
import type { NodeTarget, SpringTransition } from "../layout"
import {
	applyBrightness,
	damp,
	hexToRgb,
	type ManualSpringConfig,
	randomBetween,
	rgbToHex,
	saturateColor,
} from "../math"
import {
	animateColorMotion,
	animateScalarMotion,
	type ColorMotion,
	createColorMotion,
	createScalarMotion,
	readScalarMotion,
	type ScalarMotion,
	springFromLambda,
	syncColorMotion,
	syncScalarMotion,
} from "../motion"
import type { Palette } from "../palette"
import type { PixiEffectTuning } from "../types"

const COLOR_LAMBDA = 12
const COLOR_LAMBDA_FAST = 20
const CONTENT_START_SCALE = 0.5
const CONTENT_START_BLUR = 10
const ICON_OPACITY_LAMBDA = 18
const ICON_SCALE_LAMBDA = 18
const ICON_BLUR_LAMBDA = 18
const ICON_START_SCALE = 0.7
const ICON_START_BLUR = 6
const ICON_EXIT_SCALE = 0.9
const ICON_EXIT_BLUR = 6
const BUBBLE_OPACITY_LAMBDA = 14
const BUBBLE_SCALE_LAMBDA = 14
const BUBBLE_BLUR_LAMBDA = 16
const BUBBLE_HIDDEN_SCALE = 0.6
const BUBBLE_EXTRA_GAP = 8
const BUBBLE_HIDDEN_BLUR = 6
const WARNING_JITTER_STRENGTH_MULT = 0.6
const WARNING_JITTER_DURATION_MULT = 0.7
const WARNING_PULSE_INTENSITY_MULT = 0.6
const WARNING_PULSE_NOISE_MULT = 0.8
const WARNING_PULSE_DURATION_MULT = 0.75
const ENTER_NODE_BLUR = 6
const LABEL_ENTER_SCALE = 0.9
const LABEL_EXIT_SCALE = 0.9
const LABEL_HIDDEN_SCALE = 0.5
const LABEL_OPACITY_DURATION = 0.17
const LABEL_BLUR_DURATION = 0.25
const DEATH_LABEL_TEXT = 0xff2d2d
const GLITCH_SYMBOLS = ["#", "%", "@", "&", "*", "+", "!", "?", "≠", "≡"]
const GLITCH_TICK_MS = 140

function buildGlitchLabel(base: string) {
	const chars = Array.from(base)
	const candidates = chars.flatMap((char, index) => (char.trim().length > 0 ? [index] : []))
	if (candidates.length === 0) return base

	const maxReplacements = Math.min(2, candidates.length)
	const replacements = Math.floor(randomBetween(1, maxReplacements + 1))
	for (let index = 0; index < replacements; index += 1) {
		const pickIndex = Math.floor(Math.random() * candidates.length)
		const charIndex = candidates.splice(pickIndex, 1)[0]
		const symbol = GLITCH_SYMBOLS[Math.floor(Math.random() * GLITCH_SYMBOLS.length)] ?? "#"
		chars[charIndex] = symbol
	}
	return chars.join("")
}

export interface NodeAnimState {
	width: number
	widthTarget: number
	height: number
	heightTarget: number
	centerX: number
	centerXTarget: number
	centerY: number
	centerYTarget: number
	hasLayout: boolean
	contentOpacity: number
	contentScale: number
	contentBlur: number
	fillOpacity: number
	labelOpacity: number
	labelBlur: number
	labelScale: number
	labelText: string
	labelGlitchText: string | null
	labelGlitchTick: number
	labelIsDeath: boolean
	labelExitIsDeath: boolean
	labelExitText: string | null
	labelExitOpacity: number
	labelExitBlur: number
	labelExitScale: number
	labelWasHidden: boolean
	borderAlpha: number
	prevContent: string | null
	contentText: string
	iconKind: NodeIconKind
	iconOpacity: number
	iconScale: number
	iconBlur: number
	iconExitKind: NodeIconKind
	iconExitOpacity: number
	iconExitScale: number
	iconExitBlur: number
	bubbleOpacity: number
	bubbleScale: number
	bubbleBlur: number
	bubbleYOffset: number
	bubbleYOffsetTarget: number
	prevBubbleKey: string | null
	bubbleMessage: string | null
	bubbleType: "error" | "log" | null
	colorR: number
	colorG: number
	colorB: number
	borderColorR: number
	borderColorG: number
	borderColorB: number
	flashTimer: number
	flashDuration: number
	flashMix: number
	flashColorR: number
	flashColorG: number
	flashColorB: number
	bubbleFlashTimer: number
	failureJitterRemaining: number
	failurePulseTimer: number
	failurePulseDuration: number
	successPulseTimer: number
	successPulseDuration: number
	jitterX: number
	jitterY: number
	jitterRot: number
	jitterTargetX: number
	jitterTargetY: number
	jitterTargetRot: number
	jitterTimer: number
	prevState: SvgEffectNodeSpec["visualState"]
	nodeScale: number
	nodeBlur: number
	wasHidden: boolean
}

interface IconFrame {
	kind: NodeIconKind
	opacity: number
	scale: number
	blur: number
	color: number
}

interface BoxFrame {
	width: number
	height: number
	color: number
	alpha: number
}

interface BorderFrame {
	width: number
	color: number
	alpha: number
	pulseAlpha: number
	pulseColor: number
}

interface ContentFrame {
	text: string
	visible: boolean
	opacity: number
	scale: number
	blur: number
	color: number
}

interface GlowFrame {
	visible: boolean
	alpha: number
	color: number
}

interface SweepUniformsFrame {
	speed: number
	bandWidth: number
	bandSoftness: number
	bandSpacing: number
	bandCount: number
	intensity: number
	mix: number
	insetX: number
	insetTop: number
	insetBottom: number
	pulseSpeed: number
}

interface SweepFrame {
	enabled: boolean
	time: number
	width: number
	height: number
	color: number
	rotation: number
	scaleX: number
	scaleY: number
	uniforms: SweepUniformsFrame
}

interface FailurePulseUniformsFrame {
	progress: number
	width: number
	softness: number
	intensity: number
	noise: number
	colorMix: number
	tail: number
	fadeIn: number
	fadeOut: number
	noiseScale: number
}

interface FailurePulseFrame {
	enabled: boolean
	time: number
	width: number
	height: number
	scaleX: number
	scaleY: number
	color: { r: number; g: number; b: number }
	uniforms: FailurePulseUniformsFrame
}

interface BubbleFrame {
	visible: boolean
	message: string
	opacity: number
	scale: number
	blur: number
	width: number
	height: number
	x: number
	y: number
	color: number
	textColor: number
	fontSize: number
}

interface LabelFrame {
	text: string
	opacity: number
	blur: number
	scale: number
	x: number
	y: number
	color: number
}

interface TransformFrame {
	x: number
	y: number
	rotation: number
	scale: number
}

export interface NodeFrame {
	transform: TransformFrame
	box: BoxFrame
	border: BorderFrame
	iconBaseScale: number
	icon: IconFrame
	iconExit: IconFrame
	content: ContentFrame
	glow: GlowFrame
	sweep: SweepFrame
	failurePulse: FailurePulseFrame
	bubble: BubbleFrame
	label: LabelFrame
	labelExit: LabelFrame
}

export interface NodeMotionDriver {
	width: MotionValue<number>
	height: MotionValue<number>
	centerX: MotionValue<number>
	centerY: MotionValue<number>
	contentScale: MotionValue<number>
	contentBlur: MotionValue<number>
	bubbleYOffset: MotionValue<number>
	contentOpacity: ScalarMotion
	fillOpacity: ScalarMotion
	borderAlpha: ScalarMotion
	fillColor: ColorMotion
	borderColor: ColorMotion
	nodeScale: ScalarMotion
	nodeBlur: ScalarMotion
	iconOpacity: ScalarMotion
	iconScale: ScalarMotion
	iconBlur: ScalarMotion
	iconExitOpacity: ScalarMotion
	iconExitScale: ScalarMotion
	iconExitBlur: ScalarMotion
	bubbleOpacity: ScalarMotion
	bubbleScale: ScalarMotion
	bubbleBlur: ScalarMotion
	labelOpacity: ScalarMotion
	labelBlur: ScalarMotion
	labelScale: ScalarMotion
	labelExitOpacity: ScalarMotion
	labelExitBlur: ScalarMotion
	labelExitScale: ScalarMotion
	animateWidth: (target: number, spring: SpringTransition) => void
	animateHeight: (target: number, spring: SpringTransition) => void
	animateCenterX: (target: number, spring: ManualSpringConfig) => void
	animateCenterY: (target: number, spring: ManualSpringConfig) => void
	animateContentScale: (target: number, spring: SpringTransition) => void
	animateContentBlur: (target: number, spring: SpringTransition) => void
	animateBubbleYOffset: (target: number, spring: SpringTransition) => void
	setCenter: (x: number, y: number) => void
	syncFromState: (state: NodeAnimState) => void
	stop: () => void
}

export interface NodeAdvanceContext {
	dt: number
	time: number
	layout: SvgEffectLayoutConfig
	tuning: PixiEffectTuning
	palette: Palette
	positionSpring: ManualSpringConfig
	heightSpringRunning: SpringTransition
	heightSpringRest: SpringTransition
	opacityLambda: number
	fillOpacityLambda: number
	borderAlphaLambda: number
	jitterLambda: number
}

interface NodeAdvanceFlags {
	isRunning: boolean
	isCompleted: boolean
	isFailed: boolean
	isInterrupted: boolean
	isHidden: boolean
	isEntering: boolean
}

interface NodeAdvanceScope {
	state: NodeAnimState
	target: NodeTarget
	frame: NodeFrame
	context: NodeAdvanceContext
	flags: NodeAdvanceFlags
	motion: NodeMotionDriver
}

export function createNodeFrame(): NodeFrame {
	return {
		transform: { x: 0, y: 0, rotation: 0, scale: 1 },
		box: { width: 0, height: 0, color: 0, alpha: 1 },
		border: { width: 1, color: 0xffffff, alpha: 0, pulseAlpha: 0, pulseColor: 0 },
		iconBaseScale: 1,
		icon: { kind: "none", opacity: 0, scale: 1, blur: 0, color: 0xffffff },
		iconExit: { kind: "none", opacity: 0, scale: 1, blur: 0, color: 0xffffff },
		content: { text: "", visible: false, opacity: 0, scale: 1, blur: 0, color: 0xffffff },
		glow: { visible: false, alpha: 0, color: 0 },
		sweep: {
			enabled: false,
			time: 0,
			width: 0,
			height: 0,
			color: 0,
			rotation: 0,
			scaleX: 1,
			scaleY: 1,
			uniforms: {
				speed: 0,
				bandWidth: 0,
				bandSoftness: 0,
				bandSpacing: 0,
				bandCount: 0,
				intensity: 0,
				mix: 0,
				insetX: 0,
				insetTop: 0,
				insetBottom: 0,
				pulseSpeed: 0,
			},
		},
		failurePulse: {
			enabled: false,
			time: 0,
			width: 0,
			height: 0,
			scaleX: 1,
			scaleY: 1,
			color: { r: 1, g: 0, b: 0 },
			uniforms: {
				progress: 0,
				width: 0,
				softness: 0,
				intensity: 0,
				noise: 0,
				colorMix: 0,
				tail: 0,
				fadeIn: 0,
				fadeOut: 0,
				noiseScale: 1,
			},
		},
		bubble: {
			visible: false,
			message: "",
			opacity: 0,
			scale: 1,
			blur: 0,
			width: 0,
			height: 0,
			x: 0,
			y: 0,
			color: 0,
			textColor: 0xffffff,
			fontSize: 0,
		},
		label: { text: "", opacity: 0, blur: 0, scale: 1, x: 0, y: 0, color: 0xffffff },
		labelExit: { text: "", opacity: 0, blur: 0, scale: 1, x: 0, y: 0, color: 0xffffff },
	}
}

export function createNodeMotionDriver(initialSize: number): NodeMotionDriver {
	const width = motionValue(initialSize)
	const height = motionValue(initialSize)
	const centerX = motionValue(0)
	const centerY = motionValue(0)
	const contentScale = motionValue(1)
	const contentBlur = motionValue(0)
	const bubbleYOffset = motionValue(0)
	const contentOpacity = createScalarMotion(1)
	const fillOpacity = createScalarMotion(1)
	const borderAlpha = createScalarMotion(0)
	const fillColor = createColorMotion({ r: 0, g: 0, b: 0 })
	const borderColor = createColorMotion({ r: 0, g: 0, b: 0 })
	const nodeScale = createScalarMotion(1)
	const nodeBlur = createScalarMotion(0)
	const iconOpacity = createScalarMotion(0)
	const iconScale = createScalarMotion(1)
	const iconBlur = createScalarMotion(0)
	const iconExitOpacity = createScalarMotion(0)
	const iconExitScale = createScalarMotion(1)
	const iconExitBlur = createScalarMotion(0)
	const bubbleOpacity = createScalarMotion(0)
	const bubbleScale = createScalarMotion(1)
	const bubbleBlur = createScalarMotion(0)
	const labelOpacity = createScalarMotion(0)
	const labelBlur = createScalarMotion(0)
	const labelScale = createScalarMotion(1)
	const labelExitOpacity = createScalarMotion(0)
	const labelExitBlur = createScalarMotion(0)
	const labelExitScale = createScalarMotion(1)

	let widthControl: AnimationPlaybackControls | null = null
	let heightControl: AnimationPlaybackControls | null = null
	let centerXControl: AnimationPlaybackControls | null = null
	let centerYControl: AnimationPlaybackControls | null = null
	let contentScaleControl: AnimationPlaybackControls | null = null
	let contentBlurControl: AnimationPlaybackControls | null = null
	let bubbleYOffsetControl: AnimationPlaybackControls | null = null

	return {
		width,
		height,
		centerX,
		centerY,
		contentScale,
		contentBlur,
		bubbleYOffset,
		contentOpacity,
		fillOpacity,
		borderAlpha,
		fillColor,
		borderColor,
		nodeScale,
		nodeBlur,
		iconOpacity,
		iconScale,
		iconBlur,
		iconExitOpacity,
		iconExitScale,
		iconExitBlur,
		bubbleOpacity,
		bubbleScale,
		bubbleBlur,
		labelOpacity,
		labelBlur,
		labelScale,
		labelExitOpacity,
		labelExitBlur,
		labelExitScale,
		animateWidth: (target, spring) => {
			widthControl?.stop()
			widthControl = animate(width, target, spring)
		},
		animateHeight: (target, spring) => {
			heightControl?.stop()
			heightControl = animate(height, target, spring)
		},
		animateCenterX: (target, spring) => {
			centerXControl?.stop()
			centerXControl = animate(centerX, target, {
				type: "spring",
				stiffness: spring.stiffness,
				damping: spring.damping,
				mass: spring.mass,
			})
		},
		animateCenterY: (target, spring) => {
			centerYControl?.stop()
			centerYControl = animate(centerY, target, {
				type: "spring",
				stiffness: spring.stiffness,
				damping: spring.damping,
				mass: spring.mass,
			})
		},
		animateContentScale: (target, spring) => {
			contentScaleControl?.stop()
			contentScaleControl = animate(contentScale, target, spring)
		},
		animateContentBlur: (target, spring) => {
			contentBlurControl?.stop()
			contentBlurControl = animate(contentBlur, target, spring)
		},
		animateBubbleYOffset: (target, spring) => {
			bubbleYOffsetControl?.stop()
			bubbleYOffsetControl = animate(bubbleYOffset, target, spring)
		},
		setCenter: (x, y) => {
			centerXControl?.stop()
			centerYControl?.stop()
			centerX.set(x)
			centerY.set(y)
		},
		syncFromState: (state) => {
			width.set(state.width)
			height.set(state.height)
			centerX.set(state.centerX)
			centerY.set(state.centerY)
			contentScale.set(state.contentScale)
			contentBlur.set(state.contentBlur)
			bubbleYOffset.set(state.bubbleYOffset)
			syncScalarMotion(contentOpacity, state.contentOpacity)
			syncScalarMotion(fillOpacity, state.fillOpacity)
			syncScalarMotion(borderAlpha, state.borderAlpha)
			syncColorMotion(fillColor, {
				r: state.colorR,
				g: state.colorG,
				b: state.colorB,
			})
			syncColorMotion(borderColor, {
				r: state.borderColorR,
				g: state.borderColorG,
				b: state.borderColorB,
			})
			syncScalarMotion(nodeScale, state.nodeScale)
			syncScalarMotion(nodeBlur, state.nodeBlur)
			syncScalarMotion(iconOpacity, state.iconOpacity)
			syncScalarMotion(iconScale, state.iconScale)
			syncScalarMotion(iconBlur, state.iconBlur)
			syncScalarMotion(iconExitOpacity, state.iconExitOpacity)
			syncScalarMotion(iconExitScale, state.iconExitScale)
			syncScalarMotion(iconExitBlur, state.iconExitBlur)
			syncScalarMotion(bubbleOpacity, state.bubbleOpacity)
			syncScalarMotion(bubbleScale, state.bubbleScale)
			syncScalarMotion(bubbleBlur, state.bubbleBlur)
			syncScalarMotion(labelOpacity, state.labelOpacity)
			syncScalarMotion(labelBlur, state.labelBlur)
			syncScalarMotion(labelScale, state.labelScale)
			syncScalarMotion(labelExitOpacity, state.labelExitOpacity)
			syncScalarMotion(labelExitBlur, state.labelExitBlur)
			syncScalarMotion(labelExitScale, state.labelExitScale)
		},
		stop: () => {
			for (const control of [
				widthControl,
				heightControl,
				centerXControl,
				centerYControl,
				contentScaleControl,
				contentBlurControl,
				bubbleYOffsetControl,
			]) {
				control?.stop()
			}
			for (const scalar of [
				contentOpacity,
				fillOpacity,
				borderAlpha,
				fillColor.r,
				fillColor.g,
				fillColor.b,
				borderColor.r,
				borderColor.g,
				borderColor.b,
				nodeScale,
				nodeBlur,
				iconOpacity,
				iconScale,
				iconBlur,
				iconExitOpacity,
				iconExitScale,
				iconExitBlur,
				bubbleOpacity,
				bubbleScale,
				bubbleBlur,
				labelOpacity,
				labelBlur,
				labelScale,
				labelExitOpacity,
				labelExitBlur,
				labelExitScale,
			]) {
				scalar.control?.stop()
			}
		},
	}
}

function getNodeFlags(target: NodeTarget): NodeAdvanceFlags {
	return {
		isRunning: target.isRunning,
		isCompleted: target.isCompleted,
		isFailed: target.isFailed,
		isInterrupted: target.isInterrupted,
		isHidden: target.isHidden,
		isEntering: target.isEntering,
	}
}

function advanceNodeMotion(scope: NodeAdvanceScope) {
	const { state, target, frame, context, flags, motion } = scope
	const {
		dt,
		tuning,
		positionSpring,
		heightSpringRunning,
		heightSpringRest,
		opacityLambda,
		fillOpacityLambda,
		jitterLambda,
	} = context

	const isFirstLayout = !state.hasLayout
	if (isFirstLayout) {
		state.widthTarget = target.targetWidth
		state.heightTarget = target.targetHeight
		motion.width.set(target.targetWidth)
		motion.height.set(target.targetHeight)
		state.width = target.targetWidth
		state.height = target.targetHeight
		state.contentOpacity = target.contentOpacityTarget
		state.fillOpacity = target.fillOpacityTarget
		state.labelOpacity = target.labelOpacityTarget
		state.labelBlur = 0
		if (flags.isEntering && !flags.isHidden) {
			state.nodeScale = 0
			state.nodeBlur = ENTER_NODE_BLUR
			state.contentOpacity = 0
			state.fillOpacity = 0
			state.labelOpacity = 0
			state.borderAlpha = 0
			state.iconOpacity = 0
			syncScalarMotion(motion.nodeScale, state.nodeScale)
			syncScalarMotion(motion.nodeBlur, state.nodeBlur)
			syncScalarMotion(motion.contentOpacity, state.contentOpacity)
			syncScalarMotion(motion.fillOpacity, state.fillOpacity)
			syncScalarMotion(motion.labelOpacity, state.labelOpacity)
			syncScalarMotion(motion.borderAlpha, state.borderAlpha)
			syncScalarMotion(motion.iconOpacity, state.iconOpacity)
		}
	}

	if (Math.abs(target.targetWidth - state.widthTarget) > 0.5) {
		state.widthTarget = target.targetWidth
		motion.animateWidth(target.targetWidth, target.widthSpring)
	}

	const heightSpring = flags.isRunning ? heightSpringRunning : heightSpringRest
	if (Math.abs(target.targetHeight - state.heightTarget) > 0.5) {
		state.heightTarget = target.targetHeight
		motion.animateHeight(target.targetHeight, heightSpring)
	}

	const nextWidth = motion.width.get()
	const nextHeight = motion.height.get()
	const maxDimension = 2000
	if (Number.isFinite(nextWidth)) {
		state.width = Math.max(0, Math.min(maxDimension, nextWidth))
	}
	if (Number.isFinite(nextHeight)) {
		state.height = Math.max(0, Math.min(maxDimension, nextHeight))
	}

	const opacitySpring = springFromLambda(opacityLambda)
	const fillOpacitySpring = springFromLambda(fillOpacityLambda)
	animateScalarMotion(motion.contentOpacity, target.contentOpacityTarget, opacitySpring)
	animateScalarMotion(motion.fillOpacity, target.fillOpacityTarget, fillOpacitySpring)
	state.contentOpacity = readScalarMotion(motion.contentOpacity, state.contentOpacity)
	state.fillOpacity = readScalarMotion(motion.fillOpacity, state.fillOpacity)

	if (flags.isRunning && tuning.jitterRunning) {
		state.jitterTimer -= dt
		if (state.jitterTimer <= 0) {
			state.jitterTimer = randomBetween(0.08, 0.16)
			state.jitterTargetX = randomBetween(-1.8, 1.8)
			state.jitterTargetY = randomBetween(-0.8, 0.8)
			state.jitterTargetRot = tuning.jitterRunningRotate ? randomBetween(-0.04, 0.04) : 0
		}
	} else if ((flags.isFailed || flags.isInterrupted) && state.failureJitterRemaining > 0) {
		state.failureJitterRemaining = Math.max(0, state.failureJitterRemaining - dt)
		state.jitterTimer -= dt
		if (state.jitterTimer <= 0) {
			state.jitterTimer = randomBetween(0.03, 0.06)
			const durationScale = flags.isInterrupted ? WARNING_JITTER_DURATION_MULT : 1
			const failureDuration = Math.max(0.01, tuning.failureJitterDuration) * durationScale
			const strength = Math.max(0.25, state.failureJitterRemaining / failureDuration)
			const warningScale = flags.isInterrupted ? WARNING_JITTER_STRENGTH_MULT : 1
			const jitterScale = tuning.failureJitterStrength * warningScale * 1.6
			state.jitterTargetX = randomBetween(-6 * strength * jitterScale, 6 * strength * jitterScale)
			state.jitterTargetY = randomBetween(-4.5 * strength * jitterScale, 4.5 * strength * jitterScale)
			state.jitterTargetRot = randomBetween(-0.14 * strength * jitterScale, 0.14 * strength * jitterScale)
		}
	} else {
		state.failureJitterRemaining = 0
		state.jitterTargetX = 0
		state.jitterTargetY = 0
		state.jitterTargetRot = 0
	}

	const failureJitterActive = (flags.isFailed || flags.isInterrupted) && state.failureJitterRemaining > 0
	const jitterLambdaBoost = flags.isInterrupted ? 1.2 : 1.5
	const jitterLambdaActive = failureJitterActive ? jitterLambda * jitterLambdaBoost : jitterLambda
	state.jitterX = damp(state.jitterX, state.jitterTargetX, dt, jitterLambdaActive)
	state.jitterY = damp(state.jitterY, state.jitterTargetY, dt, jitterLambdaActive)
	state.jitterRot = damp(state.jitterRot, state.jitterTargetRot, dt, jitterLambdaActive)

	const targetCenterX = flags.isHidden ? state.centerX : target.targetCenterX
	const targetCenterY = flags.isHidden ? state.centerY : target.targetCenterY

	const hiddenChanged = state.wasHidden !== flags.isHidden
	state.wasHidden = flags.isHidden

	if (!state.hasLayout || hiddenChanged) {
		state.centerXTarget = targetCenterX
		state.centerYTarget = targetCenterY
		motion.setCenter(targetCenterX, targetCenterY)
		state.centerX = targetCenterX
		state.centerY = targetCenterY
		state.hasLayout = true
	} else {
		if (Math.abs(targetCenterX - state.centerXTarget) > 0.5) {
			state.centerXTarget = targetCenterX
			motion.animateCenterX(targetCenterX, positionSpring)
		}
		if (Math.abs(targetCenterY - state.centerYTarget) > 0.5) {
			state.centerYTarget = targetCenterY
			motion.animateCenterY(targetCenterY, positionSpring)
		}

		const nextCenterX = motion.centerX.get()
		if (Number.isFinite(nextCenterX)) {
			state.centerX = nextCenterX
		}
		const nextCenterY = motion.centerY.get()
		if (Number.isFinite(nextCenterY)) {
			state.centerY = nextCenterY
		}
	}

	const scaleTarget = target.scaleTarget
	const blurTarget = target.blurTarget
	animateScalarMotion(motion.nodeScale, scaleTarget, opacitySpring)
	animateScalarMotion(motion.nodeBlur, blurTarget, opacitySpring, 0.01)
	state.nodeScale = readScalarMotion(motion.nodeScale, state.nodeScale)
	state.nodeBlur = readScalarMotion(motion.nodeBlur, state.nodeBlur)

	frame.transform.x = state.centerX + state.jitterX
	frame.transform.y = state.centerY + state.jitterY
	frame.transform.rotation = state.jitterRot
	frame.transform.scale = state.nodeScale

	frame.box.width = state.width
	frame.box.height = state.height
}

function advanceNodeVisualState(scope: NodeAdvanceScope): SvgEffectNodeSpec["visualState"] {
	const { state, target, context } = scope
	const { tuning } = context
	const node = target.node
	const previousState = state.prevState

	if (previousState === node.visualState) return previousState

	state.prevState = node.visualState
	const baseColor = context.palette[node.visualState] ?? context.palette.idle
	let flashDuration = tuning.flashDuration
	let flashMix = tuning.flashMix
	let flashSaturation = 1
	let flashBrightness = 0
	if (node.visualState === "completed") {
		flashDuration = tuning.flashSuccessDuration
		flashMix = tuning.flashSuccessMix
		flashSaturation = tuning.flashSuccessSaturation
		flashBrightness = tuning.flashSuccessBrightness
	} else if (node.visualState === "failed" || node.visualState === "death") {
		flashDuration = tuning.flashFailureDuration
		flashMix = tuning.flashFailureMix
		flashSaturation = tuning.flashFailureSaturation
		flashBrightness = tuning.flashFailureBrightness
	}
	const flashBase = node.visualState === "death" ? (context.palette.failed ?? 0xef4444) : baseColor
	const saturatedRgb = flashSaturation === 1 ? hexToRgb(flashBase) : saturateColor(flashBase, flashSaturation)
	const flashRgb = flashBrightness > 0 ? applyBrightness(saturatedRgb, flashBrightness) : saturatedRgb
	state.flashTimer = flashDuration
	state.flashDuration = flashDuration
	state.flashMix = flashMix
	state.flashColorR = flashRgb.r
	state.flashColorG = flashRgb.g
	state.flashColorB = flashRgb.b
	if (node.visualState === "running") {
		taskSounds.playRunning()
	}
	if (node.visualState === "completed") {
		taskSounds.playSuccess()
	}
	if (node.visualState === "failed") {
		taskSounds.playFailure()
	}
	if (node.visualState === "death") {
		taskSounds.playDeath()
	}
	if (node.visualState === "interrupted") {
		taskSounds.playInterrupted()
	}
	if (node.visualState === "completed") {
		state.successPulseDuration = tuning.successPulseDuration
		state.successPulseTimer = tuning.successPulseDuration
	} else if (node.visualState === "failed" || node.visualState === "death") {
		state.failureJitterRemaining = tuning.failureJitterDuration
		state.jitterTimer = 0
		state.failurePulseDuration = tuning.failurePulseDuration
		state.failurePulseTimer = tuning.failurePulseDuration
	} else if (node.visualState === "interrupted") {
		state.failureJitterRemaining = tuning.failureJitterDuration * WARNING_JITTER_DURATION_MULT
		state.jitterTimer = 0
		state.failurePulseDuration = tuning.failurePulseDuration * WARNING_PULSE_DURATION_MULT
		state.failurePulseTimer = state.failurePulseDuration
	} else if (previousState === "failed" || previousState === "interrupted" || previousState === "death") {
		state.failureJitterRemaining = 0
		state.failurePulseTimer = 0
	}

	return previousState
}

function advanceNodeColorsAndBorder(scope: NodeAdvanceScope, previousState: SvgEffectNodeSpec["visualState"]): number {
	const { state, target, frame, context, motion, flags } = scope
	const { dt, time, palette, borderAlphaLambda, tuning } = context
	const node = target.node

	const fillHex = palette[node.visualState] ?? palette.idle
	const targetRgb = hexToRgb(fillHex)
	const colorLambda = previousState === "failed" && node.visualState === "completed" ? COLOR_LAMBDA_FAST : COLOR_LAMBDA
	const colorSpring = springFromLambda(colorLambda)
	animateColorMotion(motion.fillColor, targetRgb, colorSpring)
	state.colorR = readScalarMotion(motion.fillColor.r, state.colorR)
	state.colorG = readScalarMotion(motion.fillColor.g, state.colorG)
	state.colorB = readScalarMotion(motion.fillColor.b, state.colorB)

	state.flashTimer = Math.max(0, state.flashTimer - dt)
	const flashDuration = Math.max(0.001, state.flashDuration || tuning.flashDuration)
	const flash = state.flashTimer > 0 ? Math.sin((state.flashTimer / flashDuration) * Math.PI * 0.5) : 0
	const flashMix = flash * (state.flashMix ?? tuning.flashMix)
	const finalR = Math.round(state.colorR + (state.flashColorR - state.colorR) * flashMix)
	const finalG = Math.round(state.colorG + (state.flashColorG - state.colorG) * flashMix)
	const finalB = Math.round(state.colorB + (state.flashColorB - state.colorB) * flashMix)
	const finalColor = rgbToHex(finalR, finalG, finalB)

	frame.box.color = finalColor
	frame.box.alpha = state.fillOpacity

	const borderSpring = springFromLambda(borderAlphaLambda)
	animateScalarMotion(motion.borderAlpha, target.borderAlphaTarget, borderSpring)
	state.borderAlpha = readScalarMotion(motion.borderAlpha, state.borderAlpha)
	const targetBorderColor = target.borderColorOverride ?? palette.border
	const targetBorderRgb = hexToRgb(targetBorderColor)
	const borderColorLambda = 8
	const borderColorSpring = springFromLambda(borderColorLambda)
	animateColorMotion(motion.borderColor, targetBorderRgb, borderColorSpring)
	state.borderColorR = readScalarMotion(motion.borderColor.r, state.borderColorR)
	state.borderColorG = readScalarMotion(motion.borderColor.g, state.borderColorG)
	state.borderColorB = readScalarMotion(motion.borderColor.b, state.borderColorB)
	const animatedBorderColor = rgbToHex(state.borderColorR, state.borderColorG, state.borderColorB)

	frame.border.width = target.borderWidthOverride ?? 1
	frame.border.color = animatedBorderColor
	frame.border.alpha = state.borderAlpha
	frame.border.pulseColor = palette.runningBorder
	if (flags.isRunning && target.borderAlphaOverride === undefined) {
		frame.border.pulseAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time / 220))
	} else {
		frame.border.pulseAlpha = 0
	}

	return finalColor
}

function advanceNodeIconsAndContent(scope: NodeAdvanceScope) {
	const { state, target, frame, context, motion } = scope
	const { layout, palette } = context

	const contentPopSpring: SpringTransition = {
		type: "spring",
		bounce: context.tuning.contentPopBounce,
		visualDuration: context.tuning.contentPopDuration,
	}
	const contentBlurSpring: SpringTransition = {
		type: "spring",
		bounce: 0,
		visualDuration: context.tuning.contentBlurDuration,
	}

	const desiredIcon = target.iconKind
	if (desiredIcon !== state.iconKind) {
		state.iconExitKind = state.iconKind
		state.iconExitOpacity = state.iconOpacity
		state.iconExitScale = state.iconScale
		state.iconExitBlur = state.iconBlur
		syncScalarMotion(motion.iconExitOpacity, state.iconExitOpacity)
		syncScalarMotion(motion.iconExitScale, state.iconExitScale)
		syncScalarMotion(motion.iconExitBlur, state.iconExitBlur)
		state.iconKind = desiredIcon
		if (desiredIcon === "none") {
			state.iconOpacity = 0
			state.iconScale = 1
			state.iconBlur = 0
			syncScalarMotion(motion.iconOpacity, state.iconOpacity)
			syncScalarMotion(motion.iconScale, state.iconScale)
			syncScalarMotion(motion.iconBlur, state.iconBlur)
		} else {
			state.iconOpacity = 0
			state.iconScale = ICON_START_SCALE
			state.iconBlur = ICON_START_BLUR
			syncScalarMotion(motion.iconOpacity, state.iconOpacity)
			syncScalarMotion(motion.iconScale, state.iconScale)
			syncScalarMotion(motion.iconBlur, state.iconBlur)
		}
	}

	const iconOverride = target.iconOpacityOverride
	const iconTargetOpacity = iconOverride ?? (state.iconKind === "none" ? 0 : 1)

	const wasHidden = state.iconOpacity < 0.05
	const becomingVisible = iconTargetOpacity > 0.5 && wasHidden
	if (becomingVisible) {
		state.iconScale = ICON_START_SCALE
		state.iconBlur = ICON_START_BLUR
		syncScalarMotion(motion.iconScale, state.iconScale)
		syncScalarMotion(motion.iconBlur, state.iconBlur)
	}

	const iconOpacitySpring = springFromLambda(ICON_OPACITY_LAMBDA)
	const iconScaleSpring = springFromLambda(ICON_SCALE_LAMBDA)
	const iconBlurSpring = springFromLambda(ICON_BLUR_LAMBDA)
	animateScalarMotion(motion.iconOpacity, iconTargetOpacity, iconOpacitySpring)
	animateScalarMotion(motion.iconScale, 1, iconScaleSpring)
	animateScalarMotion(motion.iconBlur, 0, iconBlurSpring)
	state.iconOpacity = readScalarMotion(motion.iconOpacity, state.iconOpacity)
	state.iconScale = readScalarMotion(motion.iconScale, state.iconScale)
	state.iconBlur = readScalarMotion(motion.iconBlur, state.iconBlur)

	if (iconOverride !== undefined) {
		animateScalarMotion(motion.iconExitOpacity, 0, iconOpacitySpring)
	}

	if (state.iconExitKind !== "none") {
		animateScalarMotion(motion.iconExitOpacity, 0, iconOpacitySpring)
		animateScalarMotion(motion.iconExitScale, ICON_EXIT_SCALE, iconScaleSpring)
		animateScalarMotion(motion.iconExitBlur, ICON_EXIT_BLUR, iconBlurSpring)
		state.iconExitOpacity = readScalarMotion(motion.iconExitOpacity, state.iconExitOpacity)
		state.iconExitScale = readScalarMotion(motion.iconExitScale, state.iconExitScale)
		state.iconExitBlur = readScalarMotion(motion.iconExitBlur, state.iconExitBlur)
		if (state.iconExitOpacity < 0.02) {
			state.iconExitKind = "none"
			state.iconExitOpacity = 0
			state.iconExitScale = 1
			state.iconExitBlur = 0
			syncScalarMotion(motion.iconExitOpacity, state.iconExitOpacity)
			syncScalarMotion(motion.iconExitScale, state.iconExitScale)
			syncScalarMotion(motion.iconExitBlur, state.iconExitBlur)
		}
	}

	const showIcon = state.iconKind !== "none"
	const content = showIcon ? null : target.content
	const resultScale = target.resultScale
	if (content !== state.prevContent) {
		state.prevContent = content
		state.contentText = content ? normalizeText(content) : ""
		if (content) {
			motion.contentScale.set(CONTENT_START_SCALE)
			motion.contentBlur.set(CONTENT_START_BLUR)
			motion.animateContentScale(1, contentPopSpring)
			motion.animateContentBlur(0, contentBlurSpring)
		} else {
			motion.contentScale.set(1)
			motion.contentBlur.set(0)
		}
	}
	const rawContentScale = motion.contentScale.get()
	state.contentScale = Number.isFinite(rawContentScale) ? Math.max(0.1, Math.min(1.2, rawContentScale)) : 1
	const rawContentBlur = motion.contentBlur.get()
	state.contentBlur = Number.isFinite(rawContentBlur) ? Math.max(0, Math.min(50, rawContentBlur)) : 0

	frame.iconBaseScale = (layout.nodeSize * 0.45) / ICON_VIEWBOX
	frame.icon.kind = showIcon ? state.iconKind : "none"
	frame.icon.opacity = state.iconOpacity
	frame.icon.scale = state.iconScale
	frame.icon.blur = state.iconBlur
	const isDeath = target.node.visualState === "death"
	const deathIconColor = 0xff2d2d
	frame.icon.color = isDeath ? deathIconColor : palette.textPrimary
	frame.iconExit.kind = state.iconExitKind
	frame.iconExit.opacity = state.iconExitOpacity
	frame.iconExit.scale = state.iconExitScale
	frame.iconExit.blur = state.iconExitBlur
	frame.iconExit.color = isDeath ? deathIconColor : palette.textPrimary

	frame.content.visible = Boolean(content)
	frame.content.text = state.contentText
	frame.content.opacity = state.contentOpacity * 0.9
	frame.content.scale = state.contentScale * resultScale
	frame.content.blur = state.contentBlur
	frame.content.color = palette.textPrimary
}

function advanceNodeGlowAndSweep(scope: NodeAdvanceScope, finalColor: number) {
	const { state, frame, context, flags } = scope
	const { time, layout, tuning, palette } = context

	frame.glow.visible = flags.isRunning && tuning.glowEnabled
	frame.glow.alpha = frame.glow.visible ? 0.2 + 0.15 * (0.5 + 0.5 * Math.sin(time / 180)) : 0
	frame.glow.color = palette.running

	frame.sweep.enabled = flags.isRunning && tuning.sweepEnabled
	frame.sweep.time = time
	frame.sweep.width = layout.nodeSize
	frame.sweep.height = layout.nodeSize
	frame.sweep.color = finalColor
	frame.sweep.rotation = state.jitterRot
	frame.sweep.scaleX = layout.nodeSize > 0 ? state.width / layout.nodeSize : 1
	frame.sweep.scaleY = layout.nodeSize > 0 ? state.height / layout.nodeSize : 1
	frame.sweep.uniforms.speed = tuning.sweepSpeed
	frame.sweep.uniforms.bandWidth = tuning.sweepWidth
	frame.sweep.uniforms.bandSoftness = tuning.sweepSoftness
	frame.sweep.uniforms.bandSpacing = tuning.sweepSpacing
	frame.sweep.uniforms.bandCount = Math.max(1, Math.min(4, Math.round(tuning.sweepCount)))
	frame.sweep.uniforms.intensity = tuning.sweepIntensity
	frame.sweep.uniforms.mix = tuning.sweepMix
	frame.sweep.uniforms.insetX = tuning.sweepInsetX
	frame.sweep.uniforms.insetTop = tuning.sweepInsetTop
	frame.sweep.uniforms.insetBottom = tuning.sweepInsetBottom
	frame.sweep.uniforms.pulseSpeed = tuning.sweepPulseSpeed
}

function advanceNodeFailurePulse(scope: NodeAdvanceScope) {
	const { state, frame, context, flags, target } = scope
	const { dt, time, layout, tuning, palette } = context
	const isDeath = target.node.visualState === "death"

	// Decrement both timers
	state.failurePulseTimer = Math.max(0, state.failurePulseTimer - dt)
	state.successPulseTimer = Math.max(0, state.successPulseTimer - dt)

	// Determine which pulse type is active
	const isWarning = flags.isInterrupted && state.failurePulseTimer > 0
	const isFailure = flags.isFailed && state.failurePulseTimer > 0
	const isSuccess = flags.isCompleted && state.successPulseTimer > 0 && tuning.successPulseEnabled

	// Check if any pulse should be enabled
	const failureEnabled = tuning.failurePulseEnabled && (isFailure || isWarning)
	const successEnabled = isSuccess
	const enabled = failureEnabled || successEnabled

	if (!enabled) {
		frame.failurePulse.enabled = false
		return
	}

	frame.failurePulse.enabled = true
	frame.failurePulse.time = time / 1000
	frame.failurePulse.width = layout.nodeSize
	frame.failurePulse.height = layout.nodeSize
	frame.failurePulse.scaleX = layout.nodeSize > 0 ? state.width / layout.nodeSize : 1
	frame.failurePulse.scaleY = layout.nodeSize > 0 ? state.height / layout.nodeSize : 1
	frame.failurePulse.uniforms.width = tuning.failurePulseWidth
	frame.failurePulse.uniforms.colorMix = tuning.failurePulseColorMix
	frame.failurePulse.uniforms.fadeIn = tuning.failurePulseFadeIn
	frame.failurePulse.uniforms.noiseScale = tuning.failurePulseNoiseScale

	// Use appropriate parameters based on pulse type
	if (isSuccess) {
		frame.failurePulse.uniforms.intensity = tuning.successPulseIntensity
		frame.failurePulse.uniforms.noise = tuning.successPulseNoise
		frame.failurePulse.uniforms.softness = tuning.successPulseSoftness
		frame.failurePulse.uniforms.tail = tuning.successPulseTail
		frame.failurePulse.uniforms.fadeOut = tuning.successPulseFadeOut
	} else {
		frame.failurePulse.uniforms.softness = tuning.failurePulseSoftness
		frame.failurePulse.uniforms.tail = tuning.failurePulseTail
		frame.failurePulse.uniforms.fadeOut = tuning.failurePulseFadeOut
		const intensityScale = isWarning ? WARNING_PULSE_INTENSITY_MULT : 1
		const noiseScale = isWarning ? WARNING_PULSE_NOISE_MULT : 1
		frame.failurePulse.uniforms.intensity = tuning.failurePulseIntensity * intensityScale
		frame.failurePulse.uniforms.noise = tuning.failurePulseNoise * noiseScale
	}

	// Calculate progress based on which pulse is active
	let duration: number
	let timer: number
	let ease: number
	if (isSuccess) {
		duration = Math.max(0.001, state.successPulseDuration || tuning.successPulseDuration)
		timer = state.successPulseTimer
		ease = Math.max(1, tuning.successPulseEase)
	} else {
		duration = Math.max(0.001, state.failurePulseDuration || tuning.failurePulseDuration)
		timer = state.failurePulseTimer
		ease = Math.max(1, tuning.failurePulseEase)
	}
	const t = 1 - timer / duration
	const eased = 1 - (1 - Math.max(0, Math.min(1, t))) ** ease
	frame.failurePulse.uniforms.progress = Math.max(0, Math.min(1, eased))

	// Set color based on pulse type
	let baseColor: number
	let pulseSaturation: number
	let pulseBrightness: number
	if (isSuccess) {
		baseColor = palette.completed ?? palette.idle
		pulseSaturation = tuning.flashSuccessSaturation
		pulseBrightness = tuning.flashSuccessBrightness
	} else if (isWarning) {
		baseColor = palette.interrupted ?? palette.idle
		pulseSaturation = tuning.flashFailureSaturation
		pulseBrightness = tuning.flashFailureBrightness
	} else if (isDeath) {
		baseColor = palette.death ?? palette.failed ?? palette.idle
		pulseSaturation = tuning.flashFailureSaturation
		pulseBrightness = tuning.flashFailureBrightness
	} else {
		baseColor = palette.failed ?? palette.idle
		pulseSaturation = tuning.flashFailureSaturation
		pulseBrightness = tuning.flashFailureBrightness
	}

	const saturated = pulseSaturation === 1 ? hexToRgb(baseColor) : saturateColor(baseColor, pulseSaturation)
	const pulseRgb = pulseBrightness > 0 ? applyBrightness(saturated, pulseBrightness) : saturated
	frame.failurePulse.color = {
		r: pulseRgb.r / 255,
		g: pulseRgb.g / 255,
		b: pulseRgb.b / 255,
	}
}

function advanceNodeBubble(scope: NodeAdvanceScope) {
	const { state, target, frame, context, flags, motion } = scope
	const { dt, layout, tuning, palette } = context
	const bubble = target.bubble
	const bubbleVisible = bubble && !target.isHidden

	const bubbleRiseSpring: SpringTransition = {
		type: "spring",
		bounce: tuning.bubbleRiseBounce,
		visualDuration: tuning.bubbleRiseDuration,
	}
	const bubbleHiddenYOffset = tuning.bubbleRiseOffset

	if (bubbleVisible) {
		const bubbleKey = `${bubble.type}:${bubble.message}`
		if (bubbleKey !== state.prevBubbleKey) {
			state.prevBubbleKey = bubbleKey
			state.bubbleOpacity = 0
			state.bubbleScale = BUBBLE_HIDDEN_SCALE
			state.bubbleBlur = BUBBLE_HIDDEN_BLUR
			syncScalarMotion(motion.bubbleOpacity, state.bubbleOpacity)
			syncScalarMotion(motion.bubbleScale, state.bubbleScale)
			syncScalarMotion(motion.bubbleBlur, state.bubbleBlur)
			state.bubbleYOffset = bubbleHiddenYOffset
			state.bubbleYOffsetTarget = 0
			motion.bubbleYOffset.set(bubbleHiddenYOffset)
			motion.animateBubbleYOffset(0, bubbleRiseSpring)
			state.bubbleFlashTimer = tuning.bubbleFlashDuration
			if (bubble.type === "log") {
				taskSounds.playNotificationChime()
			}
		}
		state.bubbleMessage = bubble.message
		state.bubbleType = bubble.type
	}

	const hasBubble = state.bubbleMessage !== null && state.bubbleType !== null
	const bubbleTargetOpacity = bubbleVisible ? 1 : 0
	const bubbleTargetScale = bubbleVisible ? 1 : BUBBLE_HIDDEN_SCALE
	const bubbleTargetBlur = bubbleVisible ? 0 : BUBBLE_HIDDEN_BLUR
	const bubbleTargetYOffset = bubbleVisible ? 0 : bubbleHiddenYOffset
	const bubbleOpacitySpring = springFromLambda(BUBBLE_OPACITY_LAMBDA)
	const bubbleScaleSpring = springFromLambda(BUBBLE_SCALE_LAMBDA)
	const bubbleBlurSpring = springFromLambda(BUBBLE_BLUR_LAMBDA)
	animateScalarMotion(motion.bubbleOpacity, bubbleTargetOpacity, bubbleOpacitySpring)
	animateScalarMotion(motion.bubbleScale, bubbleTargetScale, bubbleScaleSpring)
	animateScalarMotion(motion.bubbleBlur, bubbleTargetBlur, bubbleBlurSpring)
	state.bubbleOpacity = readScalarMotion(motion.bubbleOpacity, state.bubbleOpacity)
	state.bubbleScale = readScalarMotion(motion.bubbleScale, state.bubbleScale)
	state.bubbleBlur = readScalarMotion(motion.bubbleBlur, state.bubbleBlur)
	if (Math.abs(bubbleTargetYOffset - state.bubbleYOffsetTarget) > 0.01) {
		state.bubbleYOffsetTarget = bubbleTargetYOffset
		motion.animateBubbleYOffset(bubbleTargetYOffset, bubbleRiseSpring)
	}
	const rawBubbleYOffset = motion.bubbleYOffset.get()
	state.bubbleYOffset = Number.isFinite(rawBubbleYOffset) ? Math.max(-500, Math.min(500, rawBubbleYOffset)) : 0
	state.bubbleFlashTimer = Math.max(0, state.bubbleFlashTimer - dt)
	const bubbleFlashDuration = Math.max(0.001, tuning.bubbleFlashDuration)
	const bubbleFlash =
		state.bubbleFlashTimer > 0 ? Math.sin((state.bubbleFlashTimer / bubbleFlashDuration) * Math.PI * 0.5) : 0
	const bubbleFlashMix = bubbleFlash * tuning.bubbleFlashMix

	const nodeTopY = state.centerY - state.height / 2
	if (hasBubble && state.bubbleOpacity > 0.02) {
		const message = state.bubbleMessage ?? ""
		const bubbleType = state.bubbleType ?? "log"
		const bubbleBase = bubbleType === "error" ? palette.errorBubble : palette.logBubble
		const bubbleRgb = hexToRgb(bubbleBase)
		const bubbleColor = rgbToHex(
			Math.round(bubbleRgb.r + (255 - bubbleRgb.r) * bubbleFlashMix),
			Math.round(bubbleRgb.g + (255 - bubbleRgb.g) * bubbleFlashMix),
			Math.round(bubbleRgb.b + (255 - bubbleRgb.b) * bubbleFlashMix),
		)
		const bubbleFontSize = layout.bubbleFontSize ?? layout.labelFontSize
		const bubbleTextWidth = measureMonoText(message, bubbleFontSize, layout.charWidthRatio)
		const bubbleWidth = Math.ceil(bubbleTextWidth + layout.bubblePaddingX * 2)
		const jitterActive = flags.isFailed && bubbleType === "error" && state.failureJitterRemaining > 0
		const bubbleJitterX = jitterActive ? state.jitterX * 0.6 : 0
		const bubbleJitterY = jitterActive ? state.jitterY * 0.6 : 0

		frame.bubble.visible = true
		frame.bubble.message = message
		frame.bubble.opacity = state.bubbleOpacity
		frame.bubble.scale = state.bubbleScale
		frame.bubble.blur = state.bubbleBlur
		frame.bubble.width = bubbleWidth
		frame.bubble.height = layout.bubbleHeight
		frame.bubble.x = state.centerX + bubbleJitterX
		frame.bubble.y =
			nodeTopY - layout.bubbleGap - layout.bubbleHeight / 2 - BUBBLE_EXTRA_GAP + bubbleJitterY + state.bubbleYOffset
		frame.bubble.color = bubbleColor
		frame.bubble.textColor = bubbleType === "error" ? 0xfef2f2 : 0xffffff
		frame.bubble.fontSize = bubbleFontSize
	} else {
		frame.bubble.visible = false
		if (!bubble && state.bubbleOpacity <= 0.02) {
			state.prevBubbleKey = null
			state.bubbleMessage = null
			state.bubbleType = null
			state.bubbleFlashTimer = 0
		}
	}
}

function advanceNodeLabel(scope: NodeAdvanceScope) {
	const { state, target, frame, context, motion } = scope
	const { layout, palette } = context
	const isDeath = target.node.visualState === "death"
	if (isDeath) {
		const glitchTick = Math.floor(context.time / GLITCH_TICK_MS)
		if (glitchTick !== state.labelGlitchTick) {
			state.labelGlitchTick = glitchTick
			state.labelGlitchText = buildGlitchLabel(target.node.name)
		}
	} else {
		state.labelGlitchText = null
		state.labelGlitchTick = -1
	}
	const nextLabel = isDeath ? (state.labelGlitchText ?? target.node.name) : target.node.name
	const nextLabelIsDeath = isDeath
	const becameHidden = target.isHidden && !state.labelWasHidden
	if (becameHidden && state.labelText.length > 0) {
		state.labelExitText = state.labelText
		state.labelExitIsDeath = state.labelIsDeath
		state.labelExitOpacity = state.labelOpacity
		state.labelExitBlur = state.labelBlur
		state.labelExitScale = state.labelScale
		syncScalarMotion(motion.labelExitOpacity, state.labelExitOpacity)
		syncScalarMotion(motion.labelExitBlur, state.labelExitBlur)
		syncScalarMotion(motion.labelExitScale, state.labelExitScale)
	}
	state.labelWasHidden = target.isHidden
	const labelChanged = nextLabel !== state.labelText || nextLabelIsDeath !== state.labelIsDeath
	if (labelChanged) {
		if (isDeath) {
			state.labelText = nextLabel
			state.labelIsDeath = nextLabelIsDeath
		} else {
			if (state.labelText.length > 0) {
				state.labelExitText = state.labelText
				state.labelExitIsDeath = state.labelIsDeath
				state.labelExitOpacity = state.labelOpacity
				state.labelExitBlur = state.labelBlur
				state.labelExitScale = state.labelScale
				syncScalarMotion(motion.labelExitOpacity, state.labelExitOpacity)
				syncScalarMotion(motion.labelExitBlur, state.labelExitBlur)
				syncScalarMotion(motion.labelExitScale, state.labelExitScale)
			}
			state.labelText = nextLabel
			state.labelIsDeath = nextLabelIsDeath
			state.labelOpacity = 0
			state.labelBlur = 4
			state.labelScale = LABEL_ENTER_SCALE
			syncScalarMotion(motion.labelOpacity, state.labelOpacity)
			syncScalarMotion(motion.labelBlur, state.labelBlur)
			syncScalarMotion(motion.labelScale, state.labelScale)
		}
	}

	frame.label.text = state.labelText
	frame.label.color = state.labelIsDeath ? DEATH_LABEL_TEXT : palette.textSecondary
	const labelAlphaTarget = target.labelOpacityTarget
	const labelOpacitySpring: SpringTransition = {
		type: "spring",
		bounce: 0,
		visualDuration: LABEL_OPACITY_DURATION,
	}
	animateScalarMotion(motion.labelOpacity, labelAlphaTarget, labelOpacitySpring)
	state.labelOpacity = readScalarMotion(motion.labelOpacity, state.labelOpacity)
	const labelBlurTarget = state.labelOpacity < 0.3 ? 4 : 0
	const labelBlurSpring: SpringTransition = {
		type: "spring",
		bounce: 0,
		visualDuration: LABEL_BLUR_DURATION,
	}
	animateScalarMotion(motion.labelBlur, labelBlurTarget, labelBlurSpring)
	state.labelBlur = readScalarMotion(motion.labelBlur, state.labelBlur)
	if (target.isHidden && state.labelOpacity <= 0.01 && Math.abs(state.labelScale - LABEL_HIDDEN_SCALE) > 0.01) {
		state.labelScale = LABEL_HIDDEN_SCALE
		syncScalarMotion(motion.labelScale, state.labelScale)
	}
	const labelScaleTarget = target.isHidden ? LABEL_HIDDEN_SCALE : 1
	animateScalarMotion(motion.labelScale, labelScaleTarget, labelOpacitySpring)
	state.labelScale = readScalarMotion(motion.labelScale, state.labelScale)
	if (target.isHidden && state.labelExitText) {
		animateScalarMotion(motion.labelExitScale, LABEL_HIDDEN_SCALE, labelOpacitySpring)
		state.labelExitScale = readScalarMotion(motion.labelExitScale, state.labelExitScale)
	}

	frame.label.opacity = state.labelOpacity
	frame.label.blur = state.labelBlur
	frame.label.scale = state.labelScale
	frame.label.x = state.centerX
	const labelHeight = target.baseHeight
	frame.label.y = state.centerY + labelHeight / 2 + layout.labelGap

	if (state.labelExitText) {
		animateScalarMotion(motion.labelExitOpacity, 0, labelOpacitySpring)
		state.labelExitOpacity = readScalarMotion(motion.labelExitOpacity, state.labelExitOpacity)
		const exitBlurTarget = state.labelExitOpacity < 0.3 ? 4 : 0
		animateScalarMotion(motion.labelExitBlur, exitBlurTarget, labelBlurSpring)
		state.labelExitBlur = readScalarMotion(motion.labelExitBlur, state.labelExitBlur)
		animateScalarMotion(motion.labelExitScale, LABEL_EXIT_SCALE, labelOpacitySpring)
		state.labelExitScale = readScalarMotion(motion.labelExitScale, state.labelExitScale)

		frame.labelExit.text = state.labelExitText
		frame.labelExit.color = state.labelExitIsDeath ? DEATH_LABEL_TEXT : palette.textSecondary
		frame.labelExit.opacity = state.labelExitOpacity
		frame.labelExit.blur = state.labelExitBlur
		frame.labelExit.scale = state.labelExitScale
		frame.labelExit.x = state.centerX
		frame.labelExit.y = frame.label.y

		if (state.labelExitOpacity <= 0.02) {
			state.labelExitText = null
			state.labelExitIsDeath = false
		}
	} else {
		state.labelExitIsDeath = false
		frame.labelExit.text = ""
		frame.labelExit.opacity = 0
		frame.labelExit.blur = 0
		frame.labelExit.scale = 1
		frame.labelExit.color = palette.textSecondary
		frame.labelExit.x = frame.label.x
		frame.labelExit.y = frame.label.y
	}
}

export function advanceNodeState({
	state,
	target,
	context,
	frame,
	motion,
}: {
	state: NodeAnimState
	target: NodeTarget
	context: NodeAdvanceContext
	frame: NodeFrame
	motion: NodeMotionDriver
}) {
	const flags = getNodeFlags(target)
	const scope: NodeAdvanceScope = { state, target, frame, context, flags, motion }

	advanceNodeMotion(scope)
	const previousState = advanceNodeVisualState(scope)
	const finalColor = advanceNodeColorsAndBorder(scope, previousState)
	advanceNodeIconsAndContent(scope)
	advanceNodeGlowAndSweep(scope, finalColor)
	advanceNodeFailurePulse(scope)
	advanceNodeBubble(scope)
	advanceNodeLabel(scope)
}
