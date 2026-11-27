export const GROUP_HEADER_HEIGHT = 48 // px
export const NAV_BAR_HEIGHT = 48 // px

// Dot grid background configuration
export const DOT_GRID = {
	dotSize: 3, // px
	spacing: 18, // px between dots
	baseOpacity: 0.08,
	rippleOpacity: 0.25, // additional opacity for ripple highlight
	spawnInterval: 600, // ms between new ripples
	rippleDuration: 4000, // ms for ripple to fully expand
	maxRippleRadius: 350, // px
	ringWidth: 40, // px width of the ripple ring
} as const
