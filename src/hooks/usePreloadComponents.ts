/**
 * Hook to preload components for adjacent sections.
 *
 * When the active section changes, this preloads components for nearby
 * sections so they're ready when the user navigates to them.
 */

import { useEffect, useRef } from "react"
import type { SectionData } from "@/atoms/narration"
import { preloadComponent } from "@/components/narrated/componentRegistry"

/**
 * Preload components for sections within range of the active section.
 *
 * @param sections - All sections in the chapter
 * @param activeIndex - Currently active section index
 * @param range - How many sections before/after to preload (default: 2)
 */
export function usePreloadComponents(sections: readonly SectionData[], activeIndex: number, range = 2): void {
	// Track which components we've already triggered preload for
	const preloadedRef = useRef<Set<string>>(new Set())

	useEffect(() => {
		if (sections.length === 0) return

		// Calculate range of sections to preload
		const startIndex = Math.max(0, activeIndex - range)
		const endIndex = Math.min(sections.length - 1, activeIndex + range)

		// Preload components for each section in range
		for (let i = startIndex; i <= endIndex; i++) {
			const section = sections[i]
			const componentName = section?.componentFlow?.name
			if (componentName && !preloadedRef.current.has(componentName)) {
				preloadedRef.current.add(componentName)
				preloadComponent(componentName)
			}
		}
	}, [sections, activeIndex, range])
}
