export interface PixiEffectArrow {
	afterIndex: number // Arrow appears after this node index
	gap?: number // Custom gap width (default: 48)
	color?: number // Arrow color (default: 0x71717a - zinc-500)
	size?: number // Arrow size (default: 30)
	direction?: "right" | "left" // Arrow direction (default: "right")
}

export interface PixiEffectOverlay {
	rect: { x: number; y: number; width: number; height: number }
	fillColor: number
	fillOpacity: number
	borderColor: number
	borderAlpha: number
	label?: { text: string; x: number; y: number; align: "left" | "center"; opacity: number }
	opacity?: number
	blur?: number
}
