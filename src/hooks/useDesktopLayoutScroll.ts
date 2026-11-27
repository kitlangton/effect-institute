import { animate, type MotionValue, useMotionValue } from "motion/react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { SectionData } from "@/atoms/narration"
import { GROUP_HEADER_HEIGHT, NAV_BAR_HEIGHT } from "@/components/chapters/constants"

type GroupBoundary = {
	groupId: string
	groupTitle: string
	groupDraft?: boolean
	firstIndex: number
	lastIndex: number
}

type StickyGroup = {
	id: string
	title: string
	draft?: boolean
	firstIndex: number
	lastIndex: number
}

interface UseDesktopLayoutScrollProps {
	sections: readonly SectionData[]
	activeIndex: number
	fontSize: number
	lineHeightPx: number
	leftMaxWidth: string
}

interface UseDesktopLayoutScrollResult {
	// Refs to attach to DOM elements
	containerRef: React.RefObject<HTMLDivElement | null>
	contentRef: React.RefObject<HTMLDivElement | null>
	sectionRefs: React.MutableRefObject<(HTMLDivElement | null)[]>
	groupHeaderRefs: React.MutableRefObject<(HTMLDivElement | null)[]>
	// Computed values
	offset: MotionValue<number>
	stickyGroup: StickyGroup | null
	nextGroupApproaching: boolean
	pushProgress: number
	groupBoundaries: GroupBoundary[]
}

export function useDesktopLayoutScroll({
	sections,
	activeIndex,
	fontSize,
	lineHeightPx,
	leftMaxWidth,
}: UseDesktopLayoutScrollProps): UseDesktopLayoutScrollResult {
	const offset = useMotionValue(0)
	const offsetAnimationRef = useRef<ReturnType<typeof animate> | null>(null)
	const willChangeIdRef = useRef(0)
	const lastOffsetRef = useRef<number | null>(null)
	const sectionRefs = useRef<(HTMLDivElement | null)[]>([])
	const groupHeaderRefs = useRef<(HTMLDivElement | null)[]>([])
	const containerRef = useRef<HTMLDivElement | null>(null)
	const contentRef = useRef<HTMLDivElement | null>(null)

	const [stickyGroup, setStickyGroup] = useState<StickyGroup | null>(null)
	const [nextGroupApproaching, setNextGroupApproaching] = useState(false)
	const [pushProgress, setPushProgress] = useState(0)

	// Store natural center positions (using layout values, unaffected by transforms)
	const naturalCenters = useRef<number[]>([])
	const groupHeaderPositions = useRef<number[]>([])
	const layoutReadyRef = useRef(false)
	const remeasureRafRef = useRef<number | null>(null)

	// Compute the vertical center of the actually visible area (exclude top UI + bottom fade)
	const computeContainerCenter = useCallback((container: HTMLDivElement) => {
		const TOP_UI = NAV_BAR_HEIGHT + GROUP_HEADER_HEIGHT
		const BOTTOM_UI = 32 // bottom fade overlay height
		const available = container.clientHeight - TOP_UI - BOTTOM_UI
		if (available <= 0) return container.clientHeight / 2
		return TOP_UI + available / 2
	}, [])

	// Compute group boundaries for sticky header calculation
	const groupBoundaries = useMemo(() => {
		const boundaries: GroupBoundary[] = []
		let pendingGroup: {
			groupId: string
			groupTitle: string
			groupDraft?: boolean
			firstIndex: number
		} | null = null

		for (let index = 0; index < sections.length; index++) {
			const section = sections[index]
			if (section.isFirstInGroup && section.groupId && section.groupTitle) {
				// Close previous group
				if (pendingGroup) {
					boundaries.push({ ...pendingGroup, lastIndex: index - 1 })
				}
				// Start new group
				pendingGroup = {
					groupId: section.groupId,
					groupTitle: section.groupTitle,
					...(section.groupDraft && { groupDraft: section.groupDraft }),
					firstIndex: index,
				}
			}
		}

		// Close final group
		if (pendingGroup) {
			boundaries.push({ ...pendingGroup, lastIndex: sections.length - 1 })
		}

		return boundaries
	}, [sections])

	const measureLayout = useCallback(() => {
		if (sections.length === 0) return

		const content = contentRef.current
		const container = containerRef.current
		if (!content || !container) return

		layoutReadyRef.current = false
		const padding = parseInt(getComputedStyle(content).paddingTop ?? "0", 10) || 0
		const sectionEls = sectionRefs.current.slice(0, sections.length)
		const activeEl = sectionEls[activeIndex]
		if (!activeEl) return

		naturalCenters.current = sectionEls.map((el) => {
			if (!el) return 0
			return padding + el.offsetTop + el.offsetHeight / 2
		})

		groupHeaderPositions.current = groupHeaderRefs.current.map((el) => {
			if (!el) return 0
			return padding + el.offsetTop
		})

		if (naturalCenters.current.length === 0) return
		layoutReadyRef.current = true
	}, [activeIndex, sections.length])

	const updateDerivedLayout = useCallback(
		(forceMeasure = false) => {
			if (forceMeasure || !layoutReadyRef.current) {
				measureLayout()
			}

			const container = containerRef.current
			const activeEl = sectionRefs.current[activeIndex]
			if (!container || !layoutReadyRef.current || naturalCenters.current.length === 0 || !activeEl) {
				if (remeasureRafRef.current === null) {
					remeasureRafRef.current = requestAnimationFrame(() => {
						remeasureRafRef.current = null
						updateDerivedLayout(true)
					})
				}
				return
			}

			const containerCenter = computeContainerCenter(container)
			const activeCenter = naturalCenters.current[activeIndex] || 0
			const newOffset = containerCenter - activeCenter
			if (lastOffsetRef.current === null) {
				lastOffsetRef.current = newOffset
				offset.set(newOffset)
				return
			}

			if (lastOffsetRef.current !== newOffset) {
				offsetAnimationRef.current?.stop()
				lastOffsetRef.current = newOffset
				const animation = animate(offset, newOffset, {
					type: "spring",
					visualDuration: 0.4,
					bounce: 0.0,
				})
				offsetAnimationRef.current = animation

				const el = contentRef.current
				if (el) {
					const willChangeId = ++willChangeIdRef.current
					el.style.willChange = "transform"
					animation.finished
						.catch(() => undefined)
						.then(() => {
							if (offsetAnimationRef.current === animation) {
								offsetAnimationRef.current = null
							}
							if (willChangeIdRef.current === willChangeId && contentRef.current === el) {
								el.style.willChange = ""
							}
						})
				}
			} else if (!offsetAnimationRef.current) {
				offset.set(newOffset)
			}

			// Calculate which group header should be sticky
			const STRIPES_HEIGHT = GROUP_HEADER_HEIGHT
			const STICKY_TOP = NAV_BAR_HEIGHT

			let activeGroupForSticky: StickyGroup | null = null
			let approaching = false
			let progress = 0

			for (let i = groupBoundaries.length - 1; i >= 0; i--) {
				const boundary = groupBoundaries[i]
				const headerPos = groupHeaderPositions.current[i] ?? 0
				const titlePos = headerPos + STRIPES_HEIGHT
				const transformedTitlePos = titlePos + newOffset

				if (transformedTitlePos < STICKY_TOP + GROUP_HEADER_HEIGHT) {
					activeGroupForSticky = {
						id: boundary.groupId,
						title: boundary.groupTitle,
						...(boundary.groupDraft && { draft: boundary.groupDraft }),
						firstIndex: boundary.firstIndex,
						lastIndex: boundary.lastIndex,
					}

					if (i < groupBoundaries.length - 1) {
						const nextHeaderPos = groupHeaderPositions.current[i + 1] ?? 0
						const nextTitlePos = nextHeaderPos + STRIPES_HEIGHT
						const nextTransformedTitlePos = nextTitlePos + newOffset

						if (nextTransformedTitlePos < STICKY_TOP + GROUP_HEADER_HEIGHT * 2) {
							approaching = true
							progress = Math.max(
								0,
								Math.min(1, 1 - (nextTransformedTitlePos - STICKY_TOP - GROUP_HEADER_HEIGHT) / GROUP_HEADER_HEIGHT),
							)
						}
					}
					break
				}
			}

			setStickyGroup(activeGroupForSticky)
			setNextGroupApproaching(approaching)
			setPushProgress(progress)
		},
		[activeIndex, computeContainerCenter, groupBoundaries, measureLayout],
	)

	// Re-run measurements whenever layout-affecting inputs change
	useLayoutEffect(() => {
		updateDerivedLayout(true)
	}, [updateDerivedLayout, sections, fontSize, lineHeightPx, leftMaxWidth])

	// Update derived layout on active section change without re-measuring
	useEffect(() => {
		updateDerivedLayout()
	}, [activeIndex, updateDerivedLayout])

	// Ensure initial alignment once refs have real layout
	useEffect(() => {
		if (sections.length === 0) return

		let rafId = 0
		let attempts = 0

		const tick = () => {
			attempts += 1
			const container = containerRef.current
			const activeEl = sectionRefs.current[activeIndex]

			if (container && activeEl && activeEl.offsetHeight > 0) {
				updateDerivedLayout(true)
				return
			}

			if (attempts < 10) {
				rafId = requestAnimationFrame(tick)
			}
		}

		rafId = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(rafId)
	}, [activeIndex, sections.length, updateDerivedLayout])

	// Respond to viewport resizes
	useEffect(() => {
		const handleResize = () => updateDerivedLayout(true)
		window.addEventListener("resize", handleResize)
		return () => window.removeEventListener("resize", handleResize)
	}, [updateDerivedLayout])

	// Keep measurements fresh when container or content size changes
	useEffect(() => {
		const ro = new ResizeObserver(() => updateDerivedLayout(true))
		if (containerRef.current) ro.observe(containerRef.current)
		if (contentRef.current) ro.observe(contentRef.current)
		return () => ro.disconnect()
	}, [updateDerivedLayout])

	useEffect(() => {
		return () => {
			offsetAnimationRef.current?.stop()
			if (remeasureRafRef.current !== null) {
				cancelAnimationFrame(remeasureRafRef.current)
				remeasureRafRef.current = null
			}
		}
	}, [])

	return {
		containerRef,
		contentRef,
		sectionRefs,
		groupHeaderRefs,
		offset,
		stickyGroup,
		nextGroupApproaching,
		pushProgress,
		groupBoundaries,
	}
}
