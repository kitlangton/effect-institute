import type { BlurFilter } from "pixi.js"

export interface ManualSpringConfig {
	stiffness: number
	damping: number
	mass: number
}

export function stepSpring(value: number, velocity: number, target: number, dt: number, config: ManualSpringConfig) {
	const force = -config.stiffness * (value - target)
	const accel = (force - config.damping * velocity) / config.mass
	let nextVelocity = velocity + accel * dt
	// Clamp velocity to prevent runaway behavior from rapid target changes
	const maxVelocity = 5000
	nextVelocity = Math.max(-maxVelocity, Math.min(maxVelocity, nextVelocity))
	const nextValue = value + nextVelocity * dt
	return { value: nextValue, velocity: nextVelocity }
}

export function damp(value: number, target: number, dt: number, lambda: number) {
	return value + (target - value) * (1 - Math.exp(-lambda * dt))
}

export function randomBetween(min: number, max: number) {
	return min + Math.random() * (max - min)
}

export function hexToRgb(color: number) {
	return {
		r: (color >> 16) & 0xff,
		g: (color >> 8) & 0xff,
		b: color & 0xff,
	}
}

export function rgbToHex(r: number, g: number, b: number) {
	const rr = Math.max(0, Math.min(255, Math.round(r)))
	const gg = Math.max(0, Math.min(255, Math.round(g)))
	const bb = Math.max(0, Math.min(255, Math.round(b)))
	return (rr << 16) | (gg << 8) | bb
}

function rgbToHsl(r: number, g: number, b: number) {
	const rn = r / 255
	const gn = g / 255
	const bn = b / 255
	const max = Math.max(rn, gn, bn)
	const min = Math.min(rn, gn, bn)
	const delta = max - min
	let h = 0
	let s = 0
	const l = (max + min) / 2

	if (delta !== 0) {
		s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
		switch (max) {
			case rn:
				h = (gn - bn) / delta + (gn < bn ? 6 : 0)
				break
			case gn:
				h = (bn - rn) / delta + 2
				break
			default:
				h = (rn - gn) / delta + 4
				break
		}
		h /= 6
	}

	return { h, s, l }
}

function hslToRgb(h: number, s: number, l: number) {
	if (s === 0) {
		const v = Math.round(l * 255)
		return { r: v, g: v, b: v }
	}

	const q = l < 0.5 ? l * (1 + s) : l + s - l * s
	const p = 2 * l - q

	const toChannel = (t: number) => {
		let tt = t
		if (tt < 0) tt += 1
		if (tt > 1) tt -= 1
		if (tt < 1 / 6) return p + (q - p) * 6 * tt
		if (tt < 1 / 2) return q
		if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
		return p
	}

	const r = Math.round(toChannel(h + 1 / 3) * 255)
	const g = Math.round(toChannel(h) * 255)
	const b = Math.round(toChannel(h - 1 / 3) * 255)
	return { r, g, b }
}

export function saturateColor(color: number, factor: number) {
	const rgb = hexToRgb(color)
	const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
	const s = Math.max(0, Math.min(1, hsl.s * factor))
	return hslToRgb(hsl.h, s, hsl.l)
}

export function applyBrightness(rgb: { r: number; g: number; b: number }, brightness: number) {
	const mix = Math.max(0, Math.min(1, brightness))
	return {
		r: Math.round(rgb.r + (255 - rgb.r) * mix),
		g: Math.round(rgb.g + (255 - rgb.g) * mix),
		b: Math.round(rgb.b + (255 - rgb.b) * mix),
	}
}

export function applyBlurXY(filter: BlurFilter, strengthX: number, strengthY: number, threshold = 0.05) {
	const safeX = Math.max(0, strengthX)
	const safeY = Math.max(0, strengthY)
	const enabled = Math.max(safeX, safeY) > threshold
	filter.enabled = enabled
	filter.strengthX = enabled ? safeX : 0
	filter.strengthY = enabled ? safeY : 0
}

export function applyBlur(filter: BlurFilter, strength: number, threshold = 0.05) {
	applyBlurXY(filter, strength, strength, threshold)
}

export function dampRgb<T extends Record<string, number>>(
	state: T,
	keys: { r: keyof T; g: keyof T; b: keyof T },
	target: { r: number; g: number; b: number },
	dt: number,
	lambda: number,
) {
	state[keys.r] = damp(state[keys.r] as number, target.r, dt, lambda) as T[keyof T]
	state[keys.g] = damp(state[keys.g] as number, target.g, dt, lambda) as T[keyof T]
	state[keys.b] = damp(state[keys.b] as number, target.b, dt, lambda) as T[keyof T]
}
