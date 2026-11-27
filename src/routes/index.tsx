import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useCallback, useRef, useState } from "react"
import { NAV_BAR_HEIGHT } from "@/components/chapters/constants"
import { FeedbackTicker } from "@/components/chapters/FeedbackTicker"
import { FooterEffectLink } from "@/components/chapters/FooterEffectLink"
import { IndexNavBar } from "@/components/chapters/header/IndexNavBar"
import { FooterLinks } from "@/components/FooterLinks"
import { ChapterList, findSelectableChapterIndex } from "@/components/home/ChapterList"
import { HeroBadge } from "@/components/home/HeroBadge"
import { useHomeChapters } from "@/components/home/useHomeChapters"
import { WelcomeBanner } from "@/components/home/WelcomeBanner"
import { useClickSound } from "@/hooks/useClickSound"
import { useHotkeys } from "@/hooks/useHotkeys"

export const Route = createFileRoute("/")({
	loader: () => ({
		feedbackSeed: Math.floor(Math.random() * 2 ** 32),
	}),
	component: ChaptersIndexPage,
})

function ChaptersIndexPage() {
	const { feedbackSeed } = Route.useLoaderData()
	const navigate = useNavigate()
	const [selectedIndex, setSelectedIndex] = useState(-1)
	const itemRefs = useRef<Map<number, HTMLElement>>(new Map())
	const playClick = useClickSound()

	const { chapters, chapterProgress, continueTarget, progressLoading, error } = useHomeChapters(setSelectedIndex)

	const clickAnd = useCallback(
		(action?: () => void) => {
			action?.()
			playClick()
		},
		[playClick],
	)

	const registerItemRef = useCallback((index: number, el: HTMLElement | null) => {
		if (el) itemRefs.current.set(index, el)
		else itemRefs.current.delete(index)
	}, [])

	useHotkeys({
		context: "home",
		enabled: chapters.length > 0,
		handlers: {
			"nav.nextItem": () => {
				clickAnd(() => {
					setSelectedIndex((prev) => {
						const next = findSelectableChapterIndex(chapters, prev, 1)
						if (next >= 0) itemRefs.current.get(next)?.scrollIntoView({ block: "nearest" })
						return next
					})
				})
				return true
			},
			"nav.prevItem": () => {
				clickAnd(() => {
					setSelectedIndex((prev) => {
						const next = findSelectableChapterIndex(chapters, prev, -1)
						if (next >= 0) itemRefs.current.get(next)?.scrollIntoView({ block: "nearest" })
						return next
					})
				})
				return true
			},
			"home.openSelected": () => {
				if (selectedIndex < 0) return false
				const chapter = chapters[selectedIndex]
				if (!chapter || chapter.comingSoon) return false
				clickAnd(() => navigate({ to: "/chapters/$chapter", params: { chapter: chapter.id } }))
				return true
			},
			"home.clearSelection": () => {
				if (selectedIndex < 0) return false
				setSelectedIndex(-1)
				return true
			},
		},
	})

	if (error) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-black text-red-400">
				Error loading chapters: {error}
			</div>
		)
	}

	return (
		<div className="relative min-h-dvh bg-black overflow-y-auto flex justify-center">
			<div className="max-w-2xl w-full sm:border-x border-[var(--border-subtle)] sm:mx-8 flex flex-col min-h-dvh">
				<IndexNavBar />

				<div className="border-b border-[var(--border-subtle)] bg-white/[0.02]">
					<div className="py-3">
						<FeedbackTicker seed={feedbackSeed} />
					</div>
				</div>

				<HeroBadge />

				<WelcomeBanner />

				<ChapterList
					chapters={chapters}
					chapterProgress={chapterProgress}
					continueTarget={continueTarget}
					isLoading={chapters.length === 0}
					progressLoading={progressLoading}
					selectedIndex={selectedIndex}
					registerItemRef={registerItemRef}
					onContinue={(target) => {
						clickAnd(() =>
							navigate({
								to: "/chapters/$chapter",
								params: { chapter: target.chapterId },
								search: { section: target.sectionId },
							}),
						)
					}}
					onChapterClick={playClick}
				/>

				<div
					className="flex-none bg-black border-t border-[var(--border-subtle)] flex items-center justify-between"
					style={{ height: NAV_BAR_HEIGHT }}
				>
					<FooterEffectLink />
					<div className="flex items-center h-full">
						<FooterLinks />
					</div>
				</div>
			</div>
		</div>
	)
}
