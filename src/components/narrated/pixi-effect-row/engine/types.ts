export interface PixiEffectTuning {
	sweepEnabled: boolean
	sweepSpeed: number
	sweepWidth: number
	sweepSoftness: number
	sweepSpacing: number
	sweepCount: number
	sweepIntensity: number
	sweepMix: number
	sweepInsetX: number
	sweepInsetTop: number
	sweepInsetBottom: number
	sweepPulseSpeed: number
	collapseRunning: boolean
	runningHeightScale: number
	jitterRunning: boolean
	jitterRunningRotate: boolean
	flashDuration: number
	flashMix: number
	flashSuccessDuration: number
	flashSuccessMix: number
	flashSuccessSaturation: number
	flashSuccessBrightness: number
	flashFailureDuration: number
	flashFailureMix: number
	flashFailureSaturation: number
	flashFailureBrightness: number
	contentPopBounce: number
	contentPopDuration: number
	contentBlurDuration: number
	failureJitterStrength: number
	failureJitterDuration: number
	failurePulseEnabled: boolean
	failurePulseDuration: number
	failurePulseWidth: number
	failurePulseSoftness: number
	failurePulseIntensity: number
	failurePulseNoise: number
	failurePulseColorMix: number
	failurePulseEase: number
	failurePulseTail: number
	failurePulseFadeIn: number
	failurePulseFadeOut: number
	failurePulseNoiseScale: number
	successPulseEnabled: boolean
	successPulseDuration: number
	successPulseIntensity: number
	successPulseNoise: number
	successPulseSoftness: number
	successPulseTail: number
	successPulseEase: number
	successPulseFadeOut: number
	bubbleFlashDuration: number
	bubbleFlashMix: number
	bubbleRiseOffset: number
	bubbleRiseDuration: number
	bubbleRiseBounce: number
	glowEnabled: boolean
	runningScale: number
}

export interface PixiStageTransform {
	scale?: number
	opacity?: number
	x?: number
	y?: number
	pivotX?: number
	pivotY?: number
}

export interface PixiNodeTransform {
	scale?: number
	opacity?: number
	x?: number
	y?: number
	blur?: number
	pivotX?: number
	pivotY?: number
}

export interface PixiEffectFrame {
	nodes: Array<{
		id: string
		width: number
		height: number
		centerX: number
		centerY: number
	}>
}
