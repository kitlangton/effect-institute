import { type AnimationPlaybackControls, animate, type MotionValue, motionValue } from "motion"

export interface ScalarMotion {
	value: MotionValue<number>
	target: number
	control: AnimationPlaybackControls | null
}

export interface ColorMotion {
	r: ScalarMotion
	g: ScalarMotion
	b: ScalarMotion
}

export type SpringTransition = {
	type: "spring"
	bounce?: number
	visualDuration?: number
}

export function createScalarMotion(initial: number): ScalarMotion {
	return { value: motionValue(initial), target: initial, control: null }
}

export function createColorMotion(rgb: { r: number; g: number; b: number }): ColorMotion {
	return {
		r: createScalarMotion(rgb.r),
		g: createScalarMotion(rgb.g),
		b: createScalarMotion(rgb.b),
	}
}

export function syncScalarMotion(motion: ScalarMotion, value: number) {
	motion.control?.stop()
	motion.target = value
	motion.value.set(value)
}

export function syncColorMotion(motion: ColorMotion, rgb: { r: number; g: number; b: number }) {
	syncScalarMotion(motion.r, rgb.r)
	syncScalarMotion(motion.g, rgb.g)
	syncScalarMotion(motion.b, rgb.b)
}

export function animateScalarMotion(motion: ScalarMotion, target: number, spring: SpringTransition, threshold = 0.001) {
	if (Math.abs(target - motion.target) <= threshold) return
	motion.target = target
	motion.control?.stop()
	motion.control = animate(motion.value, target, spring)
}

export function animateColorMotion(
	motion: ColorMotion,
	target: { r: number; g: number; b: number },
	spring: SpringTransition,
	threshold = 0.5,
) {
	animateScalarMotion(motion.r, target.r, spring, threshold)
	animateScalarMotion(motion.g, target.g, spring, threshold)
	animateScalarMotion(motion.b, target.b, spring, threshold)
}

export function readScalarMotion(motion: ScalarMotion, fallback: number) {
	const value = motion.value.get()
	return Number.isFinite(value) ? value : fallback
}

export function springFromLambda(lambda: number): SpringTransition {
	const safeLambda = Math.max(0.01, lambda)
	const duration = Math.max(0.12, Math.min(0.6, 3 / safeLambda))
	return { type: "spring", bounce: 0, visualDuration: duration }
}
