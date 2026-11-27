// Synth-based completion sound variants (different tones and effects)
export const COMPLETION_VARIANTS = [
	// === SINGLE NOTE DINGS ===
	{ key: "ding-bell", label: "Bell Ding", description: "Pure sine bell" },
	{ key: "ding-crystal", label: "Crystal Ding", description: "Bright triangle chime" },
	{ key: "ding-soft", label: "Soft Ding", description: "Warm muted tone" },
	{ key: "ding-pluck", label: "Pluck Ding", description: "Quick marimba-like" },
	{ key: "ding-shimmer", label: "Shimmer Ding", description: "Reverb tail sparkle" },
	{ key: "ding-chip", label: "Chip Ding", description: "8-bit coin sound" },
	// Square wave (NES)
	{ key: "square-fourth", label: "Square Fourth", description: "NES-style ascending 4th" },
	{ key: "square-fifth", label: "Square Fifth", description: "NES-style ascending 5th" },
	{ key: "square-octave", label: "Square Octave", description: "NES-style octave jump" },
	// Triangle wave (SNES)
	{ key: "tri-fourth", label: "Triangle Fourth", description: "Softer SNES-style 4th" },
	{ key: "tri-fifth", label: "Triangle Fifth", description: "Softer SNES-style 5th" },
	{ key: "tri-major", label: "Triangle Major", description: "Major third interval" },
	// Pulse wave (Game Boy)
	{ key: "pulse-fourth", label: "Pulse Fourth", description: "Game Boy style 4th" },
	{ key: "pulse-fifth", label: "Pulse Fifth", description: "Game Boy style 5th" },
	// Sine wave (clean)
	{ key: "sine-fourth", label: "Sine Fourth", description: "Pure clean 4th" },
	{ key: "sine-fifth", label: "Sine Fifth", description: "Pure clean 5th" },
	// With reverb
	{ key: "reverb-fourth", label: "Reverb Fourth", description: "Spacious 4th" },
	{ key: "reverb-fifth", label: "Reverb Fifth", description: "Spacious 5th" },
] as const

export type CompletionVariant = (typeof COMPLETION_VARIANTS)[number]["key"]
