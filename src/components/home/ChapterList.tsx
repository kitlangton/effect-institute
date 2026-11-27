import { ArrowRightIcon, CaretRightIcon, CheckIcon, ClockCountdownIcon } from "@phosphor-icons/react"
import { Link } from "@tanstack/react-router"
import { NAV_BAR_HEIGHT } from "@/components/chapters/constants"
import { ChapterProgressRing } from "@/components/chapters/progress/ChapterProgressRing"
import { getPublishedSectionCount, getPublishedSectionIds } from "@/lib/content/manifest"
import type { ChapterManifest, ChapterMetadata } from "@/lib/tooling/types"

export interface ChapterProgress {
	total: number
	completed: number
}

export interface ContinueTarget {
	chapterId: string
	sectionId: string
}

export function findSelectableChapterIndex(
	chapters: readonly ChapterMetadata[],
	from: number,
	direction: 1 | -1,
): number {
	if (from < 0) {
		if (direction === 1) return chapters.findIndex((c) => !c.comingSoon)
		for (let i = chapters.length - 1; i >= 0; i -= 1) {
			if (!chapters[i].comingSoon) return i
		}
		return -1
	}

	for (let next = from + direction; next >= 0 && next < chapters.length; next += direction) {
		if (!chapters[next].comingSoon) return next
	}
	return from
}

export function computeChapterProgress(
	chapters: readonly ChapterMetadata[],
	completedByChapter: Record<string, string[]>,
	manifestByChapter: ReadonlyMap<string, ChapterManifest>,
): {
	progressMap: Map<string, ChapterProgress>
	continueTarget: ContinueTarget | null
} {
	const progressMap = new Map<string, ChapterProgress>()
	let continueTarget: ContinueTarget | null = null

	for (const chapter of chapters) {
		const completedSectionIds = completedByChapter[chapter.id] ?? []
		const manifest = manifestByChapter.get(chapter.id)
		const total = chapter.sectionsCount ?? (manifest ? getPublishedSectionCount(manifest) : undefined)
		const publishedIds = manifest ? new Set(getPublishedSectionIds(manifest)) : null
		const completed = publishedIds
			? completedSectionIds.filter((id) => publishedIds.has(id)).length
			: completedSectionIds.length

		if (typeof total === "number") {
			progressMap.set(chapter.id, { total, completed })
		}

		if (!continueTarget && manifest && publishedIds) {
			const completedSet = new Set(completedSectionIds)
			const incompleteId = getPublishedSectionIds(manifest).find((id) => !completedSet.has(id))
			if (incompleteId) {
				continueTarget = { chapterId: chapter.id, sectionId: incompleteId }
			}
		}
	}

	return { progressMap, continueTarget }
}

interface ChapterListProps {
	chapters: readonly ChapterMetadata[]
	chapterProgress: ReadonlyMap<string, ChapterProgress>
	continueTarget: ContinueTarget | null
	isLoading: boolean
	progressLoading: boolean
	selectedIndex: number
	registerItemRef: (index: number, el: HTMLElement | null) => void
	onContinue: (target: ContinueTarget) => void
	onChapterClick: () => void
}

export function ChapterList({
	chapters,
	chapterProgress,
	continueTarget,
	isLoading,
	progressLoading,
	selectedIndex,
	registerItemRef,
	onContinue,
	onChapterClick,
}: ChapterListProps) {
	const hasAnyProgress = Array.from(chapterProgress.values()).some((p) => p.completed > 0)
	const continueLabel = continueTarget ? (hasAnyProgress ? "Continue" : "Get Started") : "All caught up"

	return (
		<>
			{/* Chapters header */}
			<div
				className="px-5 border-t border-[var(--border-subtle)] flex items-center justify-between"
				style={{ height: NAV_BAR_HEIGHT }}
			>
				<h1 className="text-xs uppercase tracking-[0.3em] text-white/40">Chapters</h1>
				{!isLoading && !progressLoading && (
					<button
						type="button"
						disabled={!continueTarget}
						onClick={() => {
							if (continueTarget) onContinue(continueTarget)
						}}
						className="group flex items-center gap-1.5 -mr-5 pl-4 pr-4 h-full border-l border-[var(--border-subtle)] bg-clip-padding text-xs uppercase tracking-[0.3em] text-white/40 hover:text-white/70 hover:bg-white/5 whitespace-nowrap cursor-default disabled:opacity-100 disabled:text-white/50 disabled:hover:bg-transparent disabled:hover:text-white/50"
					>
						<span>{continueLabel}</span>
						{continueTarget ? (
							<ArrowRightIcon size={14} weight="bold" className="text-white/40 group-hover:text-white/70" />
						) : (
							<CheckIcon size={14} weight="bold" className="text-white/50" />
						)}
					</button>
				)}
			</div>

			{/* Chapter list */}
			<div className="flex-1 min-h-0 mb-8">
				{isLoading
					? Array.from({ length: 3 }).map((_, i) => (
							<div key={i} className="p-5 border-t border-[var(--border-subtle)] bg-black animate-pulse">
								<div className="flex items-start gap-4">
									<div className="flex-1 min-w-0">
										<div className="h-5 w-32 bg-white/10 rounded" />
										<div className="h-4 w-48 bg-white/5 rounded mt-2" />
									</div>
								</div>
							</div>
						))
					: chapters.map((chapter, index) => {
							const borderClass = index === chapters.length - 1 ? "border-b" : ""
							const isSelected = index === selectedIndex

							if (chapter.comingSoon) {
								return (
									<div
										key={chapter.id}
										ref={(el) => registerItemRef(index, el)}
										className={`group block p-5 border-t border-[var(--border-subtle)] bg-black ${borderClass}`}
										style={{ transition: "none" }}
									>
										<h2 className="text-lg font-medium text-white/50">{chapter.title}</h2>
										{chapter.description && (
											<div className="mt-1.5 flex items-end justify-between gap-4">
												<p className="text-sm text-white/40 leading-relaxed">{chapter.description}</p>
												<div className="flex items-center gap-1.5 flex-none">
													<span className="text-xs font-medium text-white/40 uppercase tracking-wide">Later</span>
													<ClockCountdownIcon size={16} weight="bold" className="text-white/30" />
												</div>
											</div>
										)}
									</div>
								)
							}

							const progress = chapterProgress.get(chapter.id)

							return (
								<Link
									key={chapter.id}
									ref={(el) => registerItemRef(index, el)}
									to="/chapters/$chapter"
									params={{ chapter: chapter.id }}
									onClick={onChapterClick}
									className={`group block p-5 border-t border-[var(--border-subtle)] cursor-default relative ${borderClass} ${isSelected ? "bg-white/4" : "bg-black hover:bg-[var(--bg-hover)]"}`}
									style={{ transition: "none" }}
								>
									<div className="flex items-center gap-4">
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<h2 className="text-lg font-medium text-white">{chapter.title}</h2>
												{chapter.draft && import.meta.env.DEV && (
													<span className="px-2 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wide">
														Draft
													</span>
												)}
											</div>
											{chapter.description && (
												<p className="mt-1.5 text-sm text-white/50 leading-relaxed">{chapter.description}</p>
											)}
										</div>
										{progressLoading ? null : progress && progress.total > 0 ? null : (
											<CaretRightIcon
												size={16}
												weight="bold"
												className={`flex-none ${isSelected ? "text-white/40" : "text-white/20 group-hover:text-white/40"}`}
											/>
										)}
									</div>
									{!progressLoading && progress && progress.total > 0 && (
										<div className="absolute top-5 right-5">
											<ChapterProgressRing completed={progress.completed} total={progress.total} size={16} />
										</div>
									)}
								</Link>
							)
						})}
			</div>
		</>
	)
}
