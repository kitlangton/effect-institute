import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react"
import { LinkIcon } from "@phosphor-icons/react"
import { useNavigate } from "@tanstack/react-router"
import { AnimatePresence, motion } from "motion/react"
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { playbackStateAtom } from "@/atoms/audioPlayer"
import { hoverSessionAtom, optionHeldAtom, overrideTooltipAtom } from "@/atoms/cursor"
import { activeIndexAtom, lastChapterAtom, type SectionData } from "@/atoms/narration"
import { outlineModeAtom } from "@/atoms/outline"
import { responsiveSettingsAtom } from "@/atoms/responsiveSettings"
import type { AudioController } from "@/hooks/useAudioController"
import { useClickSound } from "@/hooks/useClickSound"
import { useDesktopLayoutScroll } from "@/hooks/useDesktopLayoutScroll"
import { FooterLinks } from "../../FooterLinks"
import { CompletionRingPortal } from "../../narrated/CompletionRingPortal"
import { PulsingDotGrid } from "../backgrounds/PulsingDotGrid"
import { CodePanel } from "../code-panel/CodePanel"
import { NAV_BAR_HEIGHT } from "../constants"
import { StickyGroupHeader } from "../group-headers/StickyGroupHeader"
import { ChapterTitleBar } from "../header/ChapterTitleBar"
import { GroupOutline } from "./GroupOutline"
import { SectionContextMenu } from "./SectionContextMenu"
import { SectionIndicator } from "./SectionIndicator"
import { SectionRow } from "./SectionRow"

// Dev-only recording bar. Keep both the definition and the use below as ternaries on import.meta.env.DEV:
// that is the form the bundler removes from production builds (an early return without an else is not).
const AuthoringBar = import.meta.env.DEV
	? lazy(() => import("@/authoring/client").then((m) => ({ default: m.AuthoringBar })))
	: null

interface DesktopLayoutProps {
	chapter: string
	chapterTitle: string
	sections: readonly SectionData[]
	activeSection: SectionData | undefined
	restartTrigger?: number
	controller: AudioController
}

export function DesktopLayout({
	chapter,
	chapterTitle,
	sections,
	activeSection,
	restartTrigger = 0,
	controller,
}: DesktopLayoutProps) {
	const activeIndex = useAtomValue(activeIndexAtom)
	const [outlineMode, setOutlineMode] = useAtom(outlineModeAtom)
	const navigate = useNavigate()
	const playClick = useClickSound()
	const playbackState = useAtomValue(playbackStateAtom)
	const [, setHoverSession] = useAtom(hoverSessionAtom)

	const hoveringSectionRef = useRef<number>(-1)
	const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const [feedbackOpen, setFeedbackOpen] = useState(false)
	const [feedbackSectionId, setFeedbackSectionId] = useState<string | null>(null)

	const setOverrideTooltip = useAtomSet(overrideTooltipAtom)
	const setOptionHeld = useAtomSet(optionHeldAtom)

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Alt") {
				setOptionHeld(true)
				setOverrideTooltip({ icon: <LinkIcon size={14} weight="bold" />, label: "Copy link" })
			}
		}
		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.key === "Alt") {
				setOptionHeld(false)
				setOverrideTooltip(null)
			}
		}
		const handleBlur = () => {
			setOptionHeld(false)
			setOverrideTooltip(null)
		}

		window.addEventListener("keydown", handleKeyDown)
		window.addEventListener("keyup", handleKeyUp)
		window.addEventListener("blur", handleBlur)
		return () => {
			window.removeEventListener("keydown", handleKeyDown)
			window.removeEventListener("keyup", handleKeyUp)
			window.removeEventListener("blur", handleBlur)
		}
	}, [setOverrideTooltip, setOptionHeld])

	const copyToClipboard = useCallback((value: string) => {
		if (typeof navigator === "undefined" || !navigator.clipboard) return
		navigator.clipboard.writeText(value).catch((err) => {
			console.error("[ContextMenu] Copy failed", err)
		})
	}, [])

	const handleFeedback = useCallback((sectionId: string) => {
		setFeedbackSectionId(sectionId)
		setFeedbackOpen(true)
	}, [])

	const openInEditor = useCallback((path: string) => {
		if (!import.meta.env.DEV) return
		fetch(`/__open-in-editor?file=${encodeURIComponent(path)}`).catch((err) => {
			console.error("[ContextMenu] Open in editor failed", err)
		})
	}, [])

	const handleSelectGroup = useCallback(
		(firstIndex: number) => {
			setOutlineMode(false)
			controller?.goToSection(firstIndex)
		},
		[controller, setOutlineMode],
	)

	const { fontSize, lineHeightPx, lineHeightRatio, leftMaxWidth } = useAtomValue(responsiveSettingsAtom)

	const {
		containerRef,
		contentRef,
		sectionRefs,
		groupHeaderRefs,
		offset,
		stickyGroup,
		nextGroupApproaching,
		pushProgress,
		groupBoundaries,
	} = useDesktopLayoutScroll({
		sections,
		activeIndex,
		fontSize,
		lineHeightPx,
		leftMaxWidth,
	})

	const groupHeaderIndexById = useMemo(() => {
		const map = new Map<string, number>()
		for (const [index, boundary] of groupBoundaries.entries()) {
			map.set(boundary.groupId, index)
		}
		return map
	}, [groupBoundaries])

	const clickAnd = useCallback(
		(action?: () => void) => {
			playClick()
			action?.()
		},
		[playClick],
	)

	const handlePressSpace = useCallback(() => {
		clickAnd(() => controller?.toggle())
	}, [clickAnd, controller])

	const handleNextSection = useCallback(() => {
		clickAnd(() => controller?.continueToNext?.())
	}, [clickAnd, controller])

	const handleNextChapter = useCallback(() => {
		clickAnd(() => controller?.goToNextChapter?.())
	}, [clickAnd, controller])

	const setLastChapter = useAtomSet(lastChapterAtom)
	const handleGoHome = useCallback(() => {
		clickAnd(() => {
			setLastChapter(chapter)
			navigate({ to: "/" })
		})
	}, [clickAnd, navigate, setLastChapter, chapter])

	const handleRowMouseEnter = useCallback(
		(index: number) => {
			if (settleTimeoutRef.current) {
				clearTimeout(settleTimeoutRef.current)
				settleTimeoutRef.current = null
			}
			hoveringSectionRef.current = index

			setHoverSession({
				type: "active",
				sectionIndex: index,
			})
		},
		[setHoverSession],
	)

	const handleRowMouseLeave = useCallback(() => {
		hoveringSectionRef.current = -1
		settleTimeoutRef.current = setTimeout(() => {
			if (hoveringSectionRef.current === -1) {
				setHoverSession({ type: "inactive" })
			}
		}, 50)
	}, [setHoverSession])

	return (
		<div
			className="h-screen bg-black flex justify-center"
			style={
				{
					"--left-text-size": `${fontSize}px`,
					"--code-text-size": `${fontSize}px`,
					"--code-line-height": lineHeightRatio,
					"--code-line-height-px": `${lineHeightPx}px`,
				} as React.CSSProperties
			}
		>
			<div className="flex w-full max-w-screen-2xl border-x border-[var(--border-subtle)] relative">
				{/* Left side: Narrated text */}
				<div
					ref={containerRef}
					className="h-full overflow-hidden border-r border-[var(--border-subtle)] relative"
					style={{
						width: "50%",
						flexBasis: "50%",
						maxWidth: leftMaxWidth,
					}}
				>
					<PulsingDotGrid className="z-0" />

					<ChapterTitleBar
						title={chapterTitle}
						chapterId={chapter}
						activeSectionId={activeSection?.id}
						feedbackOpen={feedbackOpen}
						onFeedbackOpenChange={setFeedbackOpen}
						feedbackSectionId={feedbackSectionId}
					/>

					<AnimatePresence>
						{stickyGroup && (
							<StickyGroupHeader
								group={stickyGroup}
								nextGroupApproaching={nextGroupApproaching}
								pushProgress={pushProgress}
								firstIndex={stickyGroup.firstIndex}
								lastIndex={stickyGroup.lastIndex}
							/>
						)}
					</AnimatePresence>

					<SectionContextMenu
						chapter={chapter}
						onFeedback={handleFeedback}
						onOpenInEditor={openInEditor}
						onCopyPath={copyToClipboard}
					>
						<motion.div
							ref={contentRef}
							className="w-full absolute left-0 z-15"
							style={{ top: 0, fontSize: "var(--left-text-size)", y: offset }}
						>
							{sections.map((section, index) => {
								const groupHeaderIndex =
									section.isFirstInGroup && section.groupId ? (groupHeaderIndexById.get(section.groupId) ?? -1) : -1
								const groupBoundary = groupHeaderIndex >= 0 ? groupBoundaries[groupHeaderIndex] : null
								const showDivider =
									index === sections.length - 1 || (index < sections.length - 1 && !sections[index + 1].isFirstInGroup)

								return (
									<SectionRow
										key={section.id}
										section={section}
										index={index}
										groupHeaderIndex={groupHeaderIndex}
										groupBoundary={groupBoundary}
										sectionRefs={sectionRefs}
										groupHeaderRefs={groupHeaderRefs}
										onPressSpace={handlePressSpace}
										onNextSection={handleNextSection}
										onNextChapter={handleNextChapter}
										onGoHome={handleGoHome}
										onTogglePlayback={controller.toggle}
										onSelectSection={controller.goToSection}
										onMouseEnter={handleRowMouseEnter}
										onMouseLeave={handleRowMouseLeave}
										showDivider={showDivider}
									/>
								)
							})}
						</motion.div>
					</SectionContextMenu>

					<SectionIndicator
						activeIndex={activeIndex}
						totalSections={sections.length}
						isPlaying={playbackState === "playing"}
						isUnavailable={playbackState === "unavailable"}
						restartTrigger={restartTrigger}
						onPlayPause={() => controller?.toggle()}
						onRestart={() => controller?.restart()}
						onPrev={() => controller?.prevSection()}
						onNext={() => controller?.nextSection()}
					/>

					{outlineMode && (
						<GroupOutline groupBoundaries={groupBoundaries} sections={sections} onSelectSection={handleSelectGroup} />
					)}
				</div>

				{/* Right side: Code + optional component */}
				{activeSection && (
					<div className="flex-1 flex flex-col min-h-0 relative">
						<CodePanel section={activeSection} sectionIndex={activeIndex} />
						<div
							className="absolute bottom-0 left-0 right-0 flex items-center justify-end border-t border-[var(--border-subtle)] bg-black z-20"
							style={{ height: NAV_BAR_HEIGHT }}
						>
							{import.meta.env.DEV && AuthoringBar ? (
								<Suspense fallback={null}>
									<AuthoringBar chapter={chapter} sectionId={activeSection.id} />
								</Suspense>
							) : null}
							<FooterLinks uppercase />
						</div>
					</div>
				)}

				<CompletionRingPortal />
			</div>
		</div>
	)
}
