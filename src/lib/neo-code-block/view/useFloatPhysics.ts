"use client"

import React from "react"

/**
 * Physics state for a floating element.
 */
export interface FloatState {
	x: number
	y: number
	vx: number
	vy: number
	opacity: number
}

/**
 * Configuration for float physics behavior.
 */
export interface FloatConfig {
	/** Duration in ms before element fully fades (default: 2000) */
	duration?: number
	/** Upward force per frame (default: 0.008) */
	lift?: number
	/** Random horizontal wobble magnitude (default: 0.02) */
	wobble?: number
	/** Velocity damping factor per frame (default: 0.995) */
	damping?: number
	/** Initial velocity range (default: { vx: 0.4, vy: 0.4 }) */
	initialVelocity?: { vx: number; vy: number }
}

const DEFAULT_CONFIG: Required<FloatConfig> = {
	duration: 2000,
	lift: 0.008,
	wobble: 0.02,
	damping: 0.995,
	initialVelocity: { vx: 0.4, vy: 0.4 },
}

/**
 * Hook that provides physics-based floating animation.
 *
 * Call `start(x, y)` to begin the physics simulation from a position.
 * The returned `state` updates each frame via requestAnimationFrame.
 * Returns `null` when animation completes.
 *
 * @example
 * ```tsx
 * const { state, start } = useFloatPhysics({ duration: 2500 })
 *
 * // Start floating when Motion entrance completes
 * <motion.div onAnimationComplete={() => start(100, 50)}>
 *
 * // Apply physics state
 * {state && (
 *   <div style={{
 *     transform: `translate(${state.x}px, ${state.y}px)`,
 *     opacity: state.opacity
 *   }} />
 * )}
 * ```
 */
export function useFloatPhysics(config: FloatConfig = {}) {
	const cfg = { ...DEFAULT_CONFIG, ...config }
	const [state, setState] = React.useState<FloatState | null>(null)
	const frameRef = React.useRef<number>(0)
	const stateRef = React.useRef<FloatState | null>(null)
	const startTimeRef = React.useRef<number>(0)

	const start = React.useCallback(
		(x: number, y: number) => {
			// Initialize with random velocity
			const initial: FloatState = {
				x,
				y,
				vx: (Math.random() - 0.5) * cfg.initialVelocity.vx,
				vy: -cfg.initialVelocity.vy * (0.5 + Math.random() * 0.5), // upward
				opacity: 1,
			}

			stateRef.current = initial
			startTimeRef.current = 0
			setState(initial)

			const animate = (timestamp: number) => {
				if (!startTimeRef.current) startTimeRef.current = timestamp
				const elapsed = timestamp - startTimeRef.current
				const s = stateRef.current

				if (!s) return

				// Apply forces
				s.vy -= cfg.lift // upward drift
				s.vx += (Math.random() - 0.5) * cfg.wobble // random wobble

				// Damping
				s.vx *= cfg.damping
				s.vy *= cfg.damping

				// Update position
				s.x += s.vx
				s.y += s.vy

				// Fade over time
				const progress = elapsed / cfg.duration
				s.opacity = Math.max(0, 1 - progress)

				// Check completion
				if (progress >= 1) {
					stateRef.current = null
					setState(null)
					return
				}

				setState({ ...s })
				frameRef.current = requestAnimationFrame(animate)
			}

			frameRef.current = requestAnimationFrame(animate)
		},
		[cfg],
	)

	// Cleanup on unmount
	React.useEffect(() => {
		return () => {
			if (frameRef.current) {
				cancelAnimationFrame(frameRef.current)
			}
		}
	}, [])

	return { state, start }
}
