import { useAtomValue } from "@effect/atom-react"
import { motion } from "motion/react"
import { activeIndexAtom, completedSectionsAtom } from "@/atoms/narration"
import { RollingGroupHeader } from "@/components/narrated/RollingGroupHeader"
import { GROUP_HEADER_HEIGHT, NAV_BAR_HEIGHT } from "../constants"

interface StickyGroupHeaderProps {
	group: { id: string; title: string; draft?: boolean }
	nextGroupApproaching: boolean
	pushProgress: number
	firstIndex: number
	lastIndex: number
}

export function StickyGroupHeader({
	group,
	nextGroupApproaching,
	pushProgress,
	firstIndex,
	lastIndex,
}: StickyGroupHeaderProps) {
	// Read from atoms instead of props
	const completedSections = useAtomValue(completedSectionsAtom)
	const activeIndex = useAtomValue(activeIndexAtom)
	const isActive = activeIndex >= firstIndex && activeIndex <= lastIndex
	return (
		<motion.div
			className="absolute left-0 right-0 z-20"
			style={{ top: NAV_BAR_HEIGHT, height: GROUP_HEADER_HEIGHT }}
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.15 }}
		>
			<motion.div
				className="px-8 text-sm font-medium tracking-wide text-white/50 uppercase border-b border-[var(--border-subtle)] bg-black flex items-center relative overflow-hidden"
				style={{ height: GROUP_HEADER_HEIGHT }}
				initial={false}
				animate={{
					y: nextGroupApproaching ? -pushProgress * GROUP_HEADER_HEIGHT : 0,
				}}
				transition={{ type: "spring", visualDuration: 0.15, bounce: 0 }}
			>
				{/* Content wrapper with dimming */}
				<motion.div
					className="flex-1 flex items-center gap-3"
					animate={{ opacity: isActive ? 1 : 0.4 }}
					transition={{ duration: 0.2 }}
				>
					<RollingGroupHeader
						title={group.title}
						firstIndex={firstIndex}
						lastIndex={lastIndex}
						completedSections={completedSections}
						currentIndex={activeIndex}
						lineHeight={GROUP_HEADER_HEIGHT}
					/>
					{group.draft && import.meta.env.DEV && (
						<span className="px-2 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wide">
							Draft
						</span>
					)}
				</motion.div>
			</motion.div>
		</motion.div>
	)
}
