import type { SpringTransition } from "./layout"
import type { ManualSpringConfig } from "./math"
import type { PixiEffectTuning } from "./types"

export const defaultPixiEffectTuning: PixiEffectTuning = {
	sweepEnabled: true,
	sweepSpeed: 500,
	sweepWidth: 40,
	sweepSoftness: 39,
	sweepSpacing: 122,
	sweepCount: 3,
	sweepIntensity: 0.5,
	sweepMix: 0.31,
	sweepInsetX: 0,
	sweepInsetTop: 0,
	sweepInsetBottom: 0,
	sweepPulseSpeed: 7.6,
	collapseRunning: true,
	runningHeightScale: 0.4,
	jitterRunning: true,
	jitterRunningRotate: true,
	flashDuration: 1.0,
	flashMix: 0.2,
	flashSuccessDuration: 1.0,
	flashSuccessMix: 0.6,
	flashSuccessSaturation: 1.4,
	flashSuccessBrightness: 0.15,
	flashFailureDuration: 0.6,
	flashFailureMix: 0.5,
	flashFailureSaturation: 1.4,
	flashFailureBrightness: 0.15,
	contentPopBounce: 0.4,
	contentPopDuration: 0.25,
	contentBlurDuration: 0.15,
	failureJitterStrength: 0.8,
	failureJitterDuration: 0.7,
	failurePulseEnabled: true,
	failurePulseDuration: 0.55,
	failurePulseWidth: 2,
	failurePulseSoftness: 16,
	failurePulseIntensity: 0.9,
	failurePulseNoise: 0.6,
	failurePulseColorMix: 0,
	failurePulseEase: 4,
	failurePulseTail: 0.6,
	failurePulseFadeIn: 0.12,
	failurePulseFadeOut: 0.85,
	failurePulseNoiseScale: 1.4,
	successPulseEnabled: true,
	successPulseDuration: 1.0,
	successPulseIntensity: 0.28,
	successPulseNoise: 0.0,
	successPulseSoftness: 24,
	successPulseTail: 0.6,
	successPulseEase: 1.5,
	successPulseFadeOut: 0.25,
	bubbleFlashDuration: 0.18,
	bubbleFlashMix: 0.3,
	bubbleRiseOffset: 32,
	bubbleRiseDuration: 0.25,
	bubbleRiseBounce: 0.5,
	glowEnabled: true,
	runningScale: 0.95,
}

export const WIDTH_SPRING: SpringTransition = {
	type: "spring",
	bounce: 0.35,
	visualDuration: 0.35,
}

export const WIDTH_SPRING_BOUNCY: SpringTransition = {
	type: "spring",
	bounce: 0.35,
	visualDuration: 0.35,
}

export const HEIGHT_SPRING_RUNNING: SpringTransition = {
	type: "spring",
	bounce: 0.5,
	visualDuration: 0.2,
}

export const HEIGHT_SPRING_REST: SpringTransition = {
	type: "spring",
	bounce: 0.5,
	visualDuration: 0.2,
}

export const POSITION_SPRING: ManualSpringConfig = {
	stiffness: 220,
	damping: 24,
	mass: 0.8,
}

export const OPACITY_LAMBDA = 18
export const BORDER_ALPHA_LAMBDA = 10
export const FILL_OPACITY_LAMBDA = 10
export const TRANSFORM_LAMBDA = 16
export const JITTER_LAMBDA = 20
