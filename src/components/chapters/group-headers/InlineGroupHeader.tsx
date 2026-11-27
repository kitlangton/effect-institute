import { useAtomValue } from "@effect/atom-react"
import { motion } from "motion/react"
import { activeIndexAtom, completedSectionsAtom } from "@/atoms/narration"
import { RollingGroupHeader } from "@/components/narrated/RollingGroupHeader"
import { GROUP_HEADER_HEIGHT } from "../constants"

interface InlineGroupHeaderProps {
	title: string
	draft?: boolean
	refCallback?: (el: HTMLDivElement | null) => void
	firstIndex: number
	lastIndex: number
}

export function InlineGroupHeader({ title, draft, refCallback, firstIndex, lastIndex }: InlineGroupHeaderProps) {
	// Read from atoms instead of props
	const completedSections = useAtomValue(completedSectionsAtom)
	const activeIndex = useAtomValue(activeIndexAtom)
	const isActive = activeIndex >= firstIndex && activeIndex <= lastIndex
	return (
		<div ref={refCallback} className="relative z-20">
			<div
				className="px-8 text-sm font-medium tracking-wide text-white/50 uppercase border-y border-[var(--border-subtle)] bg-black flex items-center relative overflow-hidden"
				style={{ height: GROUP_HEADER_HEIGHT }}
			>
				{/* Content wrapper with dimming */}
				<motion.div
					className="flex-1 flex items-center gap-3"
					animate={{ opacity: isActive ? 1 : 0.4 }}
					transition={{ duration: 0.2 }}
				>
					<RollingGroupHeader
						title={title}
						firstIndex={firstIndex}
						lastIndex={lastIndex}
						completedSections={completedSections}
						currentIndex={activeIndex}
						lineHeight={GROUP_HEADER_HEIGHT}
					/>
					{draft && import.meta.env.DEV && (
						<span className="px-2 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wide">
							Draft
						</span>
					)}
				</motion.div>
			</div>
		</div>
	)
}
