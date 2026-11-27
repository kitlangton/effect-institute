export interface Palette {
	idle: number
	running: number
	completed: number
	failed: number
	interrupted: number
	death: number
	textPrimary: number
	textSecondary: number
	textMuted: number
	border: number
	borderAlpha: number
	runningBorder: number
	errorBubble: number
	logBubble: number
}

export function buildColorMap(): Palette {
	return {
		idle: 0x475569, // slate-600
		running: 0x3b82f6, // blue-500
		completed: 0x15803d, // green-700
		failed: 0xef4444, // red-500
		interrupted: 0xf97316, // orange-500
		death: 0x0b0b0b, // near-black
		textPrimary: 0xffffff, // Use white, opacity handled separately
		textSecondary: 0xffffff,
		textMuted: 0xffffff,
		border: 0xffffff,
		borderAlpha: 0.18,
		runningBorder: 0x64c8ff,
		errorBubble: 0xef4444, // red-500
		logBubble: 0x3b82f6, // blue-500
	}
}
