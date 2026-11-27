"use client"

import React from "react"
import { useNeoCodeMeasurementsManager } from "./NeoCodeMeasurementsContext"
import type { TextMeasurement, TextMeasurementRequest } from "./NeoCodeMeasurementsManager"

export type { TextMeasurement } from "./NeoCodeMeasurementsManager"

export interface UseTextMeasurementOptions {
	lineId: string
	lineText: string
	start: number
	end: number
	measureLineId?: string
	enabled?: boolean
	codeBlockRef: React.RefObject<HTMLPreElement | null>
}

/**
 * Shared hook for measuring text position within a code block.
 * Used by overlay components (Mark, Glow, Squiggle, Cursor, Burst).
 *
 * Returns raw measurements - components apply their own padding/offsets.
 */
export function useTextMeasurement({
	lineId,
	lineText,
	start,
	end,
	measureLineId,
	enabled = true,
	codeBlockRef,
}: UseTextMeasurementOptions): {
	measurement: TextMeasurement | null
	/** The request the current measurement was taken for (may lag the props) */
	measuredRequest: TextMeasurementRequest | null
	hasInitialized: boolean
} {
	const [measured, setMeasured] = React.useState<{
		measurement: TextMeasurement | null
		request: TextMeasurementRequest
	} | null>(null)
	const [hasInitialized, setHasInitialized] = React.useState(false)

	const manager = useNeoCodeMeasurementsManager()
	const key = React.useId()

	const request = React.useMemo<TextMeasurementRequest>(
		() => ({
			lineId,
			lineText,
			start,
			end,
			...(measureLineId !== undefined && { measureLineId }),
		}),
		[lineId, lineText, start, end, measureLineId],
	)

	React.useEffect(() => {
		if (!manager || !enabled) return

		// Initialize request + subscribe
		setHasInitialized(manager.getHasInitialized(key))
		const unsubscribe = manager.subscribe(key, request, (m, measuredFor) => {
			setMeasured({ measurement: m, request: measuredFor })
			if (m) {
				setHasInitialized(true)
			}
		})

		return unsubscribe
	}, [manager, key, enabled])

	React.useEffect(() => {
		if (!manager || !enabled) return
		manager.updateRequest(key, request)
	}, [manager, key, enabled, request])

	React.useEffect(() => {
		if (manager || !enabled) return

		const measurePosition = () => {
			const codeBlock = codeBlockRef.current
			if (!codeBlock) return

			const lineSelector = request.measureLineId
				? `[data-measure-line-id="${request.measureLineId}"]`
				: `[data-line-id="${request.lineId}"]`
			const lineElement = codeBlock.querySelector(lineSelector) as HTMLElement | null
			if (!lineElement) return

			// Skip if this line is animating out (low opacity)
			const computedStyle = window.getComputedStyle(lineElement)
			const opacity = parseFloat(computedStyle.opacity || "1")
			if (opacity < 0.5) return

			const lineRect = lineElement.getBoundingClientRect()
			const blockRect = codeBlock.getBoundingClientRect()

			// Best-effort: temp span (no observers, no caching)
			const tempSpan = document.createElement("span")
			tempSpan.style.visibility = "hidden"
			tempSpan.style.position = "absolute"
			tempSpan.style.whiteSpace = "pre"
			tempSpan.style.font = computedStyle.font
			document.body.appendChild(tempSpan)

			tempSpan.textContent = request.lineText.slice(0, request.start)
			const textOffsetX = tempSpan.offsetWidth

			tempSpan.textContent = request.lineText.slice(request.start, request.end)
			const textWidth = tempSpan.offsetWidth

			document.body.removeChild(tempSpan)

			setMeasured({
				measurement: {
					lineTop: lineRect.top - blockRect.top,
					lineLeft: lineRect.left - blockRect.left,
					lineHeight: lineRect.height,
					textOffsetX,
					textWidth,
				},
				request,
			})
			setHasInitialized(true)
		}

		measurePosition()
		const raf = requestAnimationFrame(measurePosition)
		return () => cancelAnimationFrame(raf)
	}, [manager, enabled, request, codeBlockRef])

	return {
		measurement: measured?.measurement ?? null,
		measuredRequest: measured?.request ?? null,
		hasInitialized,
	}
}
