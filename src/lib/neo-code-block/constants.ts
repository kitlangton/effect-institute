/* ------------------------------------------------------------------ */
/* Mark Styling & Transitions                                          */
/* ------------------------------------------------------------------ */

export const MARK_PADDING = 6
export const MARK_VERTICAL_PADDING = 0
export const MARK_BORDER_WIDTH = 1
export const MARK_INITIAL_BLUR = "blur(5px)"
export const MARK_ANIMATE_BLUR = "blur(0px)"
export const MARK_INITIAL_OPACITY = 0
export const MARK_ANIMATE_OPACITY = 0.8
export const MARK_EXIT_OPACITY = 0

export const MARK_TRANSITION = {
	type: "spring" as const,
	visualDuration: 0.3,
	bounce: 0.2,
}

export const MARK_OPACITY_TRANSITION = {
	duration: 0.2,
	ease: "easeOut" as const,
}

/* ------------------------------------------------------------------ */
/* Spotlight/Dimming                                                   */
/* ------------------------------------------------------------------ */

export const SPOTLIGHT_DIMMED_OPACITY = 0.4
export const SPOTLIGHT_FULL_OPACITY = 1
export const SPOTLIGHT_TRANSITION_DURATION = 0.3

/* ------------------------------------------------------------------ */
/* Variable Part Transitions                                           */
/* ------------------------------------------------------------------ */

export const VARIABLE_PART_TRANSITION = {
	type: "spring" as const,
	visualDuration: 0.4,
	bounce: 0,
	restDelta: 0.1,
}

export const VARIABLE_PART_OPACITY_TRANSITION = {
	type: "spring" as const,
	visualDuration: 0.4,
	bounce: 0,
	restDelta: 0.1,
}

export const VARIABLE_PART_ANIMATE_OPACITY = 1
export const VARIABLE_PART_EXIT_OPACITY = 0

/* ------------------------------------------------------------------ */
/* Line & Container Transitions                                        */
/* ------------------------------------------------------------------ */

export const LINE_TRANSITION = {
	type: "spring" as const,
	bounce: 0.0,
	visualDuration: 0.45,
}

export const LINE_OPACITY_TRANSITION = {
	duration: 0.3,
	ease: "easeInOut" as const,
}

export const LINE_INITIAL_BLUR = "blur(4px)"
export const LINE_ANIMATE_BLUR = "blur(0px)"
export const LINE_INITIAL_OPACITY = 0
export const LINE_ANIMATE_OPACITY = 1
export const LINE_DIMMED_OPACITY = 0.4

export const CONTAINER_TRANSITION = {
	type: "spring" as const,
	bounce: 0,
	visualDuration: 0.35,
}

/* ------------------------------------------------------------------ */
/* Cursor                                                              */
/* ------------------------------------------------------------------ */

export const CURSOR_SIZE = 24
export const CURSOR_OFFSET = { x: 4, y: 0 }

export const CURSOR_TRANSITION = {
	type: "spring" as const,
	visualDuration: 0.5,
	bounce: 0,
}

/* ------------------------------------------------------------------ */
/* Glow Effect                                                         */
/* ------------------------------------------------------------------ */

export const GLOW_VERTICAL_PADDING = 2
export const GLOW_BLUR_RADIUS = 32
export const GLOW_INITIAL_OPACITY = 0
export const GLOW_ANIMATE_OPACITY = 0.35
export const GLOW_EXIT_OPACITY = 0

export const GLOW_TRANSITION = {
	type: "spring" as const,
	visualDuration: 0.6,
	bounce: 0.1,
}

export const GLOW_OPACITY_TRANSITION = {
	duration: 0.5,
	ease: "easeOut" as const,
}
