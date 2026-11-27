import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { activeIndexAtom, completedSectionsAtom, type SectionData } from "@/atoms/narration"
import { outlineModeAtom } from "@/atoms/outline"
import { GroupProgressSquares } from "@/components/narrated/RollingGroupHeader"
import { useClickSound } from "@/hooks/useClickSound"
import { GROUP_HEADER_HEIGHT, NAV_BAR_HEIGHT } from "../constants"

interface GroupBoundary {
	groupId: string
	groupTitle: string
	groupDraft?: boolean
	firstIndex: number
	lastIndex: number
}

interface GroupOutlineProps {
	groupBoundaries: GroupBoundary[]
	sections: readonly SectionData[]
	onSelectSection: (index: number) => void
}

// Colors matching RollingGroupHeader
const EMERALD_REST = "var(--color-success)"
const BG_INACTIVE = "rgba(255, 255, 255, 0.12)"

export function GroupOutline({ groupBoundaries, sections, onSelectSection }: GroupOutlineProps) {
	// Read from atoms instead of props
	const completedSections = useAtomValue(completedSectionsAtom)
	const activeIndex = useAtomValue(activeIndexAtom)
	const setOutlineMode = useAtomSet(outlineModeAtom)
	const isDev = import.meta.env.DEV
	const playClick = useClickSound()

	return (
		<div
			className="absolute inset-0 z-30 flex flex-col"
			style={{ paddingTop: NAV_BAR_HEIGHT }}
			onClick={() => setOutlineMode(false)}
		>
			{/* Dark overlay */}
			<div className="absolute inset-0 bg-black/50" />

			{/* Group buttons with nested sections */}
			<div className="relative flex-1 overflow-y-auto">
				{groupBoundaries.map((group) => {
					const isGroupActive = activeIndex >= group.firstIndex && activeIndex <= group.lastIndex

					// Get sections for this group (only used in dev mode)
					const groupSections = isDev ? sections.slice(group.firstIndex, group.lastIndex + 1) : []

					return (
						<div key={group.groupId}>
							{/* Group header */}
							<button
								type="button"
								className={`
									w-full px-8 text-left text-sm font-medium tracking-wide uppercase
									flex items-center justify-between cursor-default
									${isGroupActive ? "bg-[var(--bg-active)] text-white" : "bg-black text-white/50 hover:bg-[var(--bg-hover)]"}
								`}
								style={{
									height: GROUP_HEADER_HEIGHT,
									borderBottom: "1px solid var(--border-subtle)",
								}}
								onClick={(e) => {
									e.stopPropagation()
									playClick()
									onSelectSection(group.firstIndex)
								}}
							>
								<span className="flex items-center gap-3">
									{group.groupTitle}
									{group.groupDraft && isDev && (
										<span className="px-2 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wide">
											Draft
										</span>
									)}
								</span>
								<GroupProgressSquares
									firstIndex={group.firstIndex}
									lastIndex={group.lastIndex}
									completedSections={completedSections}
									currentIndex={activeIndex}
								/>
							</button>

							{/* Nested section list - dev mode only */}
							{isDev && (
								<div className="bg-black" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
									{groupSections.map((section, i) => {
										const sectionIndex = group.firstIndex + i
										const isActive = sectionIndex === activeIndex
										const isCompleted = completedSections.has(sectionIndex)

										return (
											<button
												key={section.id}
												type="button"
												className={`
													w-full pl-12 pr-8 py-2 text-left text-xs cursor-default
													flex items-center gap-2
													${isActive ? "text-white bg-white/8" : "text-white/40 hover:text-white/60 hover:bg-white/4"}
												`}
												onClick={(e) => {
													e.stopPropagation()
													playClick()
													onSelectSection(sectionIndex)
												}}
											>
												{/* Completion indicator - square to match progress squares */}
												<div
													className="flex-shrink-0"
													style={{
														width: 6,
														height: 6,
														backgroundColor: isCompleted ? EMERALD_REST : BG_INACTIVE,
													}}
												/>
												<span>{section.id}</span>
											</button>
										)
									})}
								</div>
							)}
						</div>
					)
				})}
			</div>
		</div>
	)
}
