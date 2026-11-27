import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { ArrowRightIcon } from "@phosphor-icons/react"
import { motion } from "motion/react"
import { useCallback } from "react"
import { hoverSessionAtom, optionHeldAtom, overrideTooltipAtom } from "@/atoms/cursor"

interface NextChapterPromptProps {
	chapterTitle: string
	onClick?: () => void
}

export function NextChapterPrompt({ chapterTitle, onClick }: NextChapterPromptProps) {
	const setHoverSession = useAtomSet(hoverSessionAtom)
	const setOverrideTooltip = useAtomSet(overrideTooltipAtom)
	const optionHeld = useAtomValue(optionHeldAtom)

	const handleMouseEnter = useCallback(
		(e: React.MouseEvent) => {
			if (optionHeld) return
			e.stopPropagation()
			setHoverSession({ type: "inactive" })
			setOverrideTooltip({ icon: <ArrowRightIcon size={14} weight="bold" />, label: "Next Chapter" })
		},
		[optionHeld, setHoverSession, setOverrideTooltip],
	)

	const handleMouseLeave = useCallback(
		(e: React.MouseEvent) => {
			if (optionHeld) return
			e.stopPropagation()
			setOverrideTooltip(null)
		},
		[optionHeld, setOverrideTooltip],
	)

	return (
		<motion.div
			initial={{ height: 0 }}
			animate={{ height: 44 }}
			exit={{ height: 0 }}
			transition={{ type: "spring", visualDuration: 0.3, bounce: 0 }}
			className="w-full overflow-hidden relative"
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			{/* Top border */}
			<div className="absolute top-0 left-0 right-0 h-px bg-[var(--border-subtle)] z-10" />

			<motion.button
				type="button"
				onClick={onClick}
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.15 }}
				className="w-full h-[44px] p-0 bg-black relative cursor-default hover:bg-[var(--bg-hover)] flex items-center justify-center"
			>
				{/* Pulse animation */}
				<motion.div
					className="absolute left-0 right-0 top-px bottom-0 pointer-events-none bg-white/5"
					animate={{ opacity: [0, 1, 0] }}
					transition={{
						duration: 3,
						ease: "easeInOut",
						repeat: Infinity,
					}}
				/>

				<div className="flex items-center gap-2 relative z-10">
					<span className="text-white/50 text-xs font-medium tracking-wide">Press</span>
					<kbd className="px-1.5 py-0.5 bg-white/10 text-white/60 text-[10px] font-medium">Space</kbd>
					<span className="text-white/50 text-xs font-medium tracking-wide">to continue to</span>
					<span className="text-white/70 text-xs font-medium">{chapterTitle}</span>
					<ArrowRightIcon size={12} weight="bold" className="text-white/40" />
				</div>
			</motion.button>
		</motion.div>
	)
}
