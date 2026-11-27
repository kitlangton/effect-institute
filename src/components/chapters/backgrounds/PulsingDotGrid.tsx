import React, { useCallback, useEffect, useRef } from "react"
import { useClickSound } from "@/hooks/useClickSound"
import { DOT_GRID } from "../constants"

interface PulsingDotGridProps {
	className?: string
	baseOpacity?: number
}

interface Pulse {
	x: number
	y: number
	startTime: number
}

// Physics-based easing: starts fast, decelerates naturally
const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - 2 ** (-10 * t))

export const PulsingDotGrid = React.memo(function PulsingDotGrid({ className = "", baseOpacity }: PulsingDotGridProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const animationRef = useRef<number>(0)
	const pulsesRef = useRef<Pulse[]>([])
	const isAnimatingRef = useRef(false)
	const dimensionsRef = useRef({ width: 0, height: 0 })
	const playClick = useClickSound()

	// Config
	const pulseDuration = 900 // ms
	const pulseMaxRadius = 180 // px
	const waveWidth = 50 // px - width of the wave

	const drawStatic = useCallback(
		(ctx: CanvasRenderingContext2D) => {
			const { width, height } = dimensionsRef.current
			ctx.clearRect(0, 0, width, height)

			const cols = Math.ceil(width / DOT_GRID.spacing) + 1
			const rows = Math.ceil(height / DOT_GRID.spacing) + 1
			const opacity = baseOpacity ?? DOT_GRID.baseOpacity

			ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`
			for (let row = 0; row < rows; row++) {
				for (let col = 0; col < cols; col++) {
					const x = col * DOT_GRID.spacing
					const y = row * DOT_GRID.spacing
					ctx.fillRect(x - DOT_GRID.dotSize / 2, y - DOT_GRID.dotSize / 2, DOT_GRID.dotSize, DOT_GRID.dotSize)
				}
			}
		},
		[baseOpacity],
	)

	const animate = useCallback(
		(ctx: CanvasRenderingContext2D, currentTime: number) => {
			const { width, height } = dimensionsRef.current

			// Remove expired pulses
			pulsesRef.current = pulsesRef.current.filter((p) => currentTime - p.startTime < pulseDuration)

			// Stop animating if no pulses
			if (pulsesRef.current.length === 0) {
				isAnimatingRef.current = false
				drawStatic(ctx)
				return
			}

			ctx.clearRect(0, 0, width, height)

			const cols = Math.ceil(width / DOT_GRID.spacing) + 1
			const rows = Math.ceil(height / DOT_GRID.spacing) + 1
			const base = baseOpacity ?? DOT_GRID.baseOpacity
			const pulses = pulsesRef.current

			for (let row = 0; row < rows; row++) {
				for (let col = 0; col < cols; col++) {
					const x = col * DOT_GRID.spacing
					const y = row * DOT_GRID.spacing

					let influence = 0

					for (const pulse of pulses) {
						const progress = (currentTime - pulse.startTime) / pulseDuration

						if (progress >= 1) continue

						const dx = x - pulse.x
						const dy = y - pulse.y
						const dist = Math.sqrt(dx * dx + dy * dy)

						// Physics-based expanding wave
						const easedProgress = easeOutExpo(progress)
						const currentRadius = easedProgress * pulseMaxRadius
						const distFromWave = dist - currentRadius

						// Gaussian-like wave profile (smooth bell curve)
						const sigma = waveWidth * (0.4 + progress * 0.6) // wave spreads as it travels
						const waveShape = Math.exp(-(distFromWave * distFromWave) / (2 * sigma * sigma))

						// Exponential damping (energy dissipates over time)
						const damping = Math.exp(-3 * progress)

						// Slight inner glow that fades quickly
						const innerGlow = dist < currentRadius ? Math.exp(-dist / 30) * Math.exp(-8 * progress) : 0

						const waveInfluence = waveShape * damping * 0.75 + innerGlow * 0.3
						influence = Math.max(influence, waveInfluence)
					}

					const opacity = base + influence * DOT_GRID.rippleOpacity

					ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`
					ctx.fillRect(x - DOT_GRID.dotSize / 2, y - DOT_GRID.dotSize / 2, DOT_GRID.dotSize, DOT_GRID.dotSize)
				}
			}

			animationRef.current = requestAnimationFrame((t) => animate(ctx, t))
		},
		[baseOpacity, drawStatic],
	)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const ctx = canvas.getContext("2d")
		if (!ctx) return

		const resizeCanvas = () => {
			const rect = canvas.getBoundingClientRect()
			const dpr = window.devicePixelRatio || 1
			dimensionsRef.current = { width: rect.width, height: rect.height }
			canvas.width = rect.width * dpr
			canvas.height = rect.height * dpr
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
			if (!isAnimatingRef.current) {
				drawStatic(ctx)
			}
		}

		resizeCanvas()
		window.addEventListener("resize", resizeCanvas)

		const handleClick = (e: MouseEvent) => {
			// Only trigger ripple when clicking directly on the parent container,
			// not on any child elements (buttons, debug badges, etc.)
			const parent = canvas.parentElement
			if (e.target !== parent) return

			const canvasRect = canvas.getBoundingClientRect()
			const x = e.clientX - canvasRect.left
			const y = e.clientY - canvasRect.top
			const { width, height } = dimensionsRef.current

			if (x >= 0 && x <= width && y >= 0 && y <= height) {
				pulsesRef.current.push({
					x,
					y,
					startTime: performance.now(),
				})

				// Play click sound
				playClick()

				// Start animation loop if not already running
				if (!isAnimatingRef.current) {
					isAnimatingRef.current = true
					animationRef.current = requestAnimationFrame((t) => animate(ctx, t))
				}
			}
		}

		const parent = canvas.parentElement
		if (parent) {
			parent.addEventListener("click", handleClick)
		}

		return () => {
			window.removeEventListener("resize", resizeCanvas)
			if (parent) {
				parent.removeEventListener("click", handleClick)
			}
			cancelAnimationFrame(animationRef.current)
		}
	}, [animate, drawStatic, playClick])

	return (
		<canvas
			ref={canvasRef}
			className={`absolute inset-0 pointer-events-none ${className}`}
			style={{ width: "100%", height: "100%" }}
		/>
	)
})
