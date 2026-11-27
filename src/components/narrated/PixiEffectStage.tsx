import { motion } from "motion/react"
import { Application } from "pixi.js"
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { getDevicePixelRatio, isPixiApplicationUsable } from "./pixi-effect-row/engine/application"

function useRafState<T>(initial: T) {
	const [value, setValue] = useState(initial)
	const frameRef = useRef<number | null>(null)
	const latestRef = useRef(initial)

	const setRaf = useCallback((next: T) => {
		latestRef.current = next
		if (frameRef.current !== null) return
		frameRef.current = requestAnimationFrame(() => {
			frameRef.current = null
			setValue(latestRef.current)
		})
	}, [])

	useEffect(
		() => () => {
			if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
		},
		[],
	)

	return [value, setRaf] as const
}

interface PixiEffectStageProps {
	height: number
	visible?: boolean
	children: (ctx: { app: Application; width: number }) => ReactNode
}

export function PixiEffectStage({ height, visible = true, children }: PixiEffectStageProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const appRef = useRef<Application | null>(null)
	const widthRef = useRef(0)
	const heightRef = useRef(height)
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const [app, setApp] = useState<Application | null>(null)
	const [width, setWidth] = useRafState(0)

	heightRef.current = height

	useLayoutEffect(() => {
		if (!containerRef.current) return
		let disposed = false
		let initialized = false
		const appInstance = new Application()
		let observer: ResizeObserver | null = null

		const setup = async () => {
			await appInstance.init({
				backgroundAlpha: 0,
				antialias: true,
				resolution: getDevicePixelRatio(),
				autoDensity: true,
				preference: "webgl",
				width: 1,
				height: 1,
			})
			initialized = true

			if (disposed) {
				appInstance.destroy(true, { children: true })
				return
			}

			appRef.current = appInstance
			canvasRef.current = appInstance.canvas as HTMLCanvasElement | null
			setApp(appInstance)
			if (canvasRef.current) {
				canvasRef.current.style.background = "#000"
				// Position canvas absolutely so it doesn't affect container sizing
				// This allows the container to shrink and the ResizeObserver to fire
				canvasRef.current.style.position = "absolute"
				canvasRef.current.style.top = "0"
				canvasRef.current.style.left = "0"
				containerRef.current?.appendChild(canvasRef.current)
			}

			const resize = () => {
				if (!containerRef.current || disposed || !isPixiApplicationUsable(appInstance)) return
				const rect = containerRef.current.getBoundingClientRect()
				widthRef.current = rect.width
				setWidth(rect.width)
				appInstance.renderer.resize(rect.width, heightRef.current, getDevicePixelRatio())
			}

			resize()
			observer = new ResizeObserver(resize)
			if (containerRef.current) observer.observe(containerRef.current)
		}

		void setup()

		return () => {
			disposed = true
			observer?.disconnect()
			setApp((current) => (current === appInstance ? null : current))
			widthRef.current = 0
			const canvas = canvasRef.current
			if (appRef.current === appInstance) {
				appRef.current = null
			}
			if (initialized && isPixiApplicationUsable(appInstance)) {
				appInstance.destroy(true, { children: true })
			}
			if (containerRef.current && canvas && canvas.parentNode === containerRef.current) {
				containerRef.current.removeChild(canvas)
			}
			canvasRef.current = null
		}
	}, [setWidth])

	useEffect(() => {
		if (!isPixiApplicationUsable(appRef.current)) return
		appRef.current.renderer.resize(widthRef.current || appRef.current.renderer.width, height, getDevicePixelRatio())
	}, [height])

	const displayHeight = visible ? height : 0
	const readyApp = isPixiApplicationUsable(app) && appRef.current === app && width > 1 ? app : null

	return (
		<motion.div
			className="w-full overflow-hidden"
			initial={false}
			animate={{ height: displayHeight }}
			transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
		>
			<div ref={containerRef} className="relative w-full" style={{ minHeight: height, height }}>
				{readyApp ? children({ app: readyApp, width }) : null}
			</div>
		</motion.div>
	)
}
