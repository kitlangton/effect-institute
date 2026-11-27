/**
 * Hook for reconstructing frames from template + state format.
 *
 * Memoizes reconstruction so repeated renders don't recompute.
 *
 * @module
 */

import { useMemo } from "react"
import { expandFrame } from "./compress"
import type { Frame, TemplateSlideshowData } from "./types"

/**
 * Hook to get a reconstructed frame from template slideshow data.
 *
 * Memoizes reconstruction - only recomputes when snapshot changes.
 */
export function useFrame(data: TemplateSlideshowData, snapshot: number): Frame | null {
	return useMemo(() => {
		const frameCount = data.frames.length
		if (frameCount === 0) return null

		const clampedSnapshot = Math.min(Math.max(snapshot, 0), frameCount - 1)
		const frameState = data.frames[clampedSnapshot]

		return expandFrame(frameState, data.template)
	}, [data, snapshot])
}
