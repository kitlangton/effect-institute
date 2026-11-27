import { Atom } from "effect/reactivity"

export interface ResponsiveSettings {
	fontSize: number
	lineHeightRatio: number
	lineHeightPx: number
	leftMaxWidth: string
	breakpoint: "mobile" | "narrow" | "medium" | "full"
}

// Breakpoint thresholds
const BREAKPOINTS = {
	mobile: 768,
	narrow: 1140,
	medium: 1400,
} as const

// Font sizes per breakpoint
const FONT_SIZES = {
	mobile: 14,
	narrow: 15,
	medium: 17,
	full: 19,
} as const

// Line height ratios per breakpoint
const LINE_HEIGHT_RATIOS = {
	mobile: 1.55,
	narrow: 1.55,
	medium: 1.55,
	full: 1.55,
} as const

// Left column max width per breakpoint
const LEFT_MAX_WIDTHS = {
	mobile: "100%",
	narrow: "460px",
	medium: "560px",
	full: "640px",
} as const

// Detect if device is touch-primary (phones/tablets)
function isTouchDevice(): boolean {
	if (typeof window === "undefined") return false
	// Check for coarse pointer (touch) as primary input
	return window.matchMedia("(pointer: coarse)").matches
}

function calculateSettings(width: number, height: number): ResponsiveSettings {
	let breakpoint: ResponsiveSettings["breakpoint"]

	// On touch devices, use mobile layout if either dimension is small
	// This handles landscape phones where width > 768 but height is small
	const isTouch = isTouchDevice()
	const smallestDimension = Math.min(width, height)
	const forceMobile = isTouch && smallestDimension < BREAKPOINTS.mobile

	if (width < BREAKPOINTS.mobile || forceMobile) {
		breakpoint = "mobile"
	} else if (width < BREAKPOINTS.narrow) {
		breakpoint = "narrow"
	} else if (width < BREAKPOINTS.medium) {
		breakpoint = "medium"
	} else {
		breakpoint = "full"
	}

	const fontSize = FONT_SIZES[breakpoint]
	const lineHeightRatio = LINE_HEIGHT_RATIOS[breakpoint]
	const lineHeightPx = fontSize * lineHeightRatio
	const leftMaxWidth = LEFT_MAX_WIDTHS[breakpoint]

	return { fontSize, lineHeightRatio, lineHeightPx, leftMaxWidth, breakpoint }
}

// Get initial value (SSR-safe)
const getInitialSettings = (): ResponsiveSettings => {
	if (typeof window === "undefined") {
		return calculateSettings(1920, 1080) // Default to full width on server
	}
	return calculateSettings(window.innerWidth, window.innerHeight)
}

// Atom that reads window width and updates on resize
export const responsiveSettingsAtom = Atom.readable((get) => {
	// SSR guard
	if (typeof window === "undefined") {
		return getInitialSettings()
	}

	// Calculate current settings
	const settings = calculateSettings(window.innerWidth, window.innerHeight)

	// Set up resize listener
	const handleResize = () => {
		const newSettings = calculateSettings(window.innerWidth, window.innerHeight)
		get.setSelf(newSettings)
	}

	window.addEventListener("resize", handleResize)
	get.addFinalizer(() => {
		window.removeEventListener("resize", handleResize)
	})

	return settings
})
