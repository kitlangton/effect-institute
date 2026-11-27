import { useAtomValue } from "@effect/atom-react"
import { computePosition, flip, offset, type Placement, shift } from "@floating-ui/react"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { baseTooltipAtom, overrideTooltipAtom } from "@/atoms/cursor"

/**
 * Virtual element that tracks the cursor position for Floating UI.
 */
function createVirtualElement(x: number, y: number) {
	return {
		getBoundingClientRect() {
			return {
				width: 0,
				height: 0,
				x,
				y,
				top: y,
				left: x,
				right: x,
				bottom: y,
			}
		},
	}
}

/**
 * Global cursor-following tooltip renderer.
 * Reads content from baseTooltipAtom / overrideTooltipAtom and positions using Floating UI
 * to automatically avoid viewport edges.
 */
export function CursorTooltipRenderer() {
	const baseContent = useAtomValue(baseTooltipAtom)
	const overrideContent = useAtomValue(overrideTooltipAtom)
	const content = overrideContent ?? baseContent
	const tooltipRef = useRef<HTMLDivElement>(null)

	// Track cursor position - null until first mouse move
	const cursorPos = useRef<{ x: number; y: number } | null>(null)
	// Track pending rAF for throttling
	const rafId = useRef<number | null>(null)

	// Computed position from Floating UI - null until valid position is computed
	const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
	const [, setPlacement] = useState<Placement>("bottom-start")

	// Helper to compute position
	const updatePosition = useCallback((clientX: number, clientY: number) => {
		if (!tooltipRef.current) return
		const virtualEl = createVirtualElement(clientX, clientY)
		computePosition(virtualEl, tooltipRef.current, {
			placement: "bottom-start",
			middleware: [
				offset({ mainAxis: 16, crossAxis: 8 }),
				flip({
					fallbackPlacements: ["top-start", "bottom-end", "top-end"],
				}),
				shift({ padding: 8 }),
			],
		}).then(({ x, y, placement }) => {
			setPosition({ x, y })
			setPlacement(placement)
		})
	}, [])

	// When content appears and we have cursor position, compute position immediately
	useLayoutEffect(() => {
		if (content && cursorPos.current && tooltipRef.current) {
			updatePosition(cursorPos.current.x, cursorPos.current.y)
		} else if (!content) {
			setPosition(null)
		}
	}, [content, updatePosition])

	// Track mouse position globally, throttled to rAF
	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			cursorPos.current = { x: e.clientX, y: e.clientY }

			// Compute position using Floating UI, throttled to animation frame
			if (tooltipRef.current && content) {
				if (rafId.current !== null) {
					cancelAnimationFrame(rafId.current)
				}
				rafId.current = requestAnimationFrame(() => {
					rafId.current = null
					if (cursorPos.current) {
						updatePosition(cursorPos.current.x, cursorPos.current.y)
					}
				})
			}
		}

		window.addEventListener("mousemove", handleMouseMove)
		return () => {
			window.removeEventListener("mousemove", handleMouseMove)
			if (rafId.current !== null) {
				cancelAnimationFrame(rafId.current)
			}
		}
	}, [content, updatePosition])

	// Always render when content exists (so ref exists), but only show when position is valid
	const isVisible = content && position

	return (
		<AnimatePresence>
			{content && (
				<motion.div
					ref={tooltipRef}
					className="fixed top-0 left-0 pointer-events-none z-9999"
					style={{
						x: position?.x ?? -9999,
						y: position?.y ?? -9999,
					}}
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{
						opacity: isVisible ? 1 : 0,
						scale: isVisible ? 1 : 0.9,
					}}
					exit={{ opacity: 0, scale: 0.9 }}
					transition={{ duration: 0.1 }}
				>
					<div className="bg-neutral-900 text-white text-xs font-medium shadow-lg border border-[var(--border-subtle)] max-w-80 overflow-hidden">
						{content.title ? (
							<>
								<div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-[var(--border-subtle)] text-white/70">
									{content.icon && <span className="flex items-center shrink-0">{content.icon}</span>}
									<span className="uppercase tracking-wide text-[10px]">{content.title}</span>
								</div>
								<div className="px-2.5 py-2">
									<span>{content.label}</span>
								</div>
							</>
						) : (
							<div className="flex items-start gap-1.5 px-2.5 py-1.5">
								{content.icon && <span className="flex items-center shrink-0 mt-0.5">{content.icon}</span>}
								<span>{content.label}</span>
								{content.shortcut && (
									<kbd className="px-1.5 py-0.5 bg-white/10 text-[10px] font-mono text-white/70">
										{content.shortcut}
									</kbd>
								)}
							</div>
						)}
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
