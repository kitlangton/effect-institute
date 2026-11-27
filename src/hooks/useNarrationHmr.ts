import { useEffect } from "react"

/**
 * Dev-only HMR wiring for narration JSON updates.
 * Triggers a section refresh when a chapter is rebuilt, without a full page reload.
 * No effect in production.
 */
export function useNarrationHmr(options: { chapter: string; refreshSections: () => void }) {
	const { chapter, refreshSections } = options

	useEffect(() => {
		if (!import.meta.hot) return

		const handler = (data: { chapter?: string }) => {
			// Only refresh if we're viewing the chapter that was rebuilt
			if (data.chapter && data.chapter !== chapter) return
			refreshSections()
		}

		import.meta.hot.on("narration-update", handler as unknown as () => void)
		return () => import.meta.hot?.off("narration-update", handler as unknown as () => void)
	}, [chapter, refreshSections])
}
