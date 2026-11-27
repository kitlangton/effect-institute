/**
 * Color utilities for code annotations (marks, glows, etc.)
 */

/** Base RGB values for annotation colors */
const BASE_COLORS: Record<string, readonly [number, number, number]> = {
	yellow: [234, 179, 8],
	green: [34, 197, 94],
	blue: [59, 130, 246],
	red: [239, 68, 68],
	purple: [168, 85, 247],
	pink: [236, 72, 153],
	orange: [249, 115, 22],
	gray: [107, 114, 128],
}

/** Resolve color name, handling aliases */
function resolveColor(color: string | undefined, defaultColor: string): readonly [number, number, number] {
	const name = color?.toLowerCase() ?? defaultColor
	// Handle grey → gray alias
	const normalized = name === "grey" ? "gray" : name
	return BASE_COLORS[normalized] ?? BASE_COLORS[defaultColor]
}

/**
 * Get highlight colors for marks (semi-transparent background + border)
 */
export function getHighlightColor(color?: string): {
	background: string
	border: string
} {
	const [r, g, b] = resolveColor(color, "yellow")
	return {
		background: `rgba(${r}, ${g}, ${b}, 0.3)`,
		border: `rgba(${r}, ${g}, ${b}, 0.8)`,
	}
}

/**
 * Get glow color (solid color for blur effect)
 */
export function getGlowColor(color?: string): string {
	const [r, g, b] = resolveColor(color, "green")
	return `rgba(${r}, ${g}, ${b}, 1)`
}
