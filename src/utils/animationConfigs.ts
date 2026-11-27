/**
 * Centralized animation configuration presets for consistent timing across the app.
 */

export const springConfigs = {
	/** Fast, snappy animations (0.2s, no bounce) */
	fast: { type: "spring" as const, visualDuration: 0.2, bounce: 0.0 },

	/** Default smooth animations (0.3s, no bounce) */
	default: { type: "spring" as const, visualDuration: 0.3, bounce: 0.0 },

	/** Slower, more deliberate animations (0.4s, no bounce) */
	smooth: { type: "spring" as const, visualDuration: 0.4, bounce: 0.0 },

	/** Playful bouncy animations (0.3s, moderate bounce) */
	bouncy: { type: "spring" as const, visualDuration: 0.3, bounce: 0.3 },
} as const
