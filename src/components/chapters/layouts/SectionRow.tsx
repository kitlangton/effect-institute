import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { AnimatePresence } from "motion/react"
import { Fragment, type MouseEvent, type MutableRefObject, memo, useCallback, useRef } from "react"
import { contextMenuTargetAtom } from "@/atoms/cursor"
import { debugModeAtom } from "@/atoms/debugMode"
import { activeIndexAtom, chapterAtom, type SectionData } from "@/atoms/narration"
import { sectionPromptsFamily } from "@/atoms/sectionPrompts"
import { DebugSectionBadge } from "@/components/chapters/debug/DebugSectionBadge"
import { InlineGroupHeader } from "@/components/chapters/group-headers/InlineGroupHeader"
import { NextChapterPrompt } from "@/components/chapters/NextChapterPrompt"
import { SpacePrompt } from "@/components/chapters/SpacePrompt"
import { NarratedSection } from "@/components/narrated/NarratedText"
import { useClickSound } from "@/hooks/useClickSound"
import { appSounds } from "@/sounds/AppSounds"

interface SectionRowProps {
	section: SectionData
	index: number
	groupHeaderIndex: number
	groupBoundary: { firstIndex: number; lastIndex: number } | null
	sectionRefs: MutableRefObject<(HTMLDivElement | null)[]>
	groupHeaderRefs: MutableRefObject<(HTMLDivElement | null)[]>
	onPressSpace: () => void
	onNextSection: () => void
	onNextChapter: () => void
	onGoHome: () => void
	onTogglePlayback: () => void
	onSelectSection: (index: number) => void
	onMouseEnter: (index: number) => void
	onMouseLeave: () => void
	showDivider: boolean
}

export const SectionRow = memo(function SectionRow({
	section,
	index,
	groupHeaderIndex,
	groupBoundary,
	sectionRefs,
	groupHeaderRefs,
	onPressSpace,
	onNextSection,
	onNextChapter,
	onGoHome,
	onTogglePlayback,
	onSelectSection,
	onMouseEnter,
	onMouseLeave,
	showDivider,
}: SectionRowProps) {
	// Read from atoms instead of props
	const debugMode = useAtomValue(debugModeAtom)
	const chapter = useAtomValue(chapterAtom)
	const activeIndex = useAtomValue(activeIndexAtom)
	const prompts = useAtomValue(sectionPromptsFamily(index))
	const setContextMenuTarget = useAtomSet(contextMenuTargetAtom)
	const playClick = useClickSound()

	// Derived state
	const isActive = index === activeIndex

	// Click debounce ref
	const lastClickTimeRef = useRef(0)

	const handleContextMenu = useCallback(() => {
		setContextMenuTarget({
			type: "section",
			sectionId: section.id,
			sectionIndex: index,
		})
	}, [setContextMenuTarget, section.id, index])

	const handleMouseEnter = useCallback(() => {
		onMouseEnter(index)
	}, [onMouseEnter, index])

	const handleMouseLeave = useCallback(() => {
		onMouseLeave()
	}, [onMouseLeave])

	const handleClick = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			event.stopPropagation()

			// Prevent double-firing within 100ms
			const now = Date.now()
			if (now - lastClickTimeRef.current < 100) return
			lastClickTimeRef.current = now

			// Option+click: copy deep link to clipboard
			if (event.altKey) {
				event.preventDefault()
				const url = `${window.location.origin}/chapters/${chapter}?section=${section.id}`
				navigator.clipboard.writeText(url).catch(console.error)
				appSounds.playKeyPress()
				return
			}

			// Shift+click: copy section path to clipboard (dev only)
			if (event.shiftKey && import.meta.env.DEV && chapter) {
				const path = section.groupId ? `${chapter}/${section.groupId}/${section.id}` : `${chapter}/${section.id}`
				playClick()
				navigator.clipboard.writeText(path).catch(console.error)
				return
			}

			playClick()
			if (isActive) {
				onTogglePlayback()
			} else {
				onSelectSection(index)
			}
		},
		[chapter, section.groupId, section.id, index, isActive, playClick, onTogglePlayback, onSelectSection],
	)

	return (
		<Fragment>
			{/* Group header - rendered inline, becomes reference for sticky */}
			{section.isFirstInGroup && section.groupTitle && groupHeaderIndex >= 0 && groupBoundary && (
				<InlineGroupHeader
					title={section.groupTitle}
					{...(section.groupDraft && {
						draft: section.groupDraft,
					})}
					refCallback={(el) => {
						groupHeaderRefs.current[groupHeaderIndex] = el
					}}
					firstIndex={groupBoundary.firstIndex}
					lastIndex={groupBoundary.lastIndex}
				/>
			)}

			{/* Press Space prompt - only on first section */}
			<AnimatePresence>
				{prompts.showPressSpace && <SpacePrompt variant="begin" onClick={onPressSpace} />}
			</AnimatePresence>

			{/* Section content */}
			<div
				ref={(el) => {
					sectionRefs.current[index] = el
				}}
				className="w-full cursor-default bg-black hover:bg-[var(--bg-hover)] relative"
				onContextMenu={handleContextMenu}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				onClick={handleClick}
			>
				{/* Debug controls - absolutely positioned inset */}
				{debugMode && chapter && (
					<div className="absolute top-0 left-0 right-0 z-10">
						<DebugSectionBadge chapter={chapter} section={section} />
					</div>
				)}

				<div className="p-8 max-w-[72ch] mx-auto relative">
					<NarratedSection section={section} isActive={isActive} />
				</div>
			</div>

			{/* Next section prompt - outside section div so hover doesn't highlight section */}
			<AnimatePresence>
				{prompts.showNextSection && <SpacePrompt variant="continue" onClick={onNextSection} />}
			</AnimatePresence>

			{/* Next chapter prompt - shown at end of chapter */}
			<AnimatePresence>
				{prompts.showNextChapter && prompts.nextChapterTitle && (
					<NextChapterPrompt chapterTitle={prompts.nextChapterTitle} onClick={onNextChapter} />
				)}
			</AnimatePresence>

			{/* Go home prompt - shown at end of all available chapters */}
			<AnimatePresence>{prompts.showGoHome && <SpacePrompt variant="home" onClick={onGoHome} />}</AnimatePresence>

			{/* Divider between sections - but not if next section starts a new group */}
			{/* Also add bottom border on last section */}
			{showDivider && <div className="h-px w-full bg-[var(--border-subtle)]" />}
		</Fragment>
	)
})
