import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { ArrowDownIcon } from "@phosphor-icons/react"
import { motion } from "motion/react"
import { useCallback } from "react"
import { hoverSessionAtom, optionHeldAtom, overrideTooltipAtom } from "@/atoms/cursor"

interface SpacePromptProps {
	variant: "begin" | "continue" | "home"
	onClick?: () => void
}

export function SpacePrompt({ variant, onClick }: SpacePromptProps) {
	const setHoverSession = useAtomSet(hoverSessionAtom)
	const setOverrideTooltip = useAtomSet(overrideTooltipAtom)
	const optionHeld = useAtomValue(optionHeldAtom)

	// Show tooltip and clear section hover state (only for continue/home variants)
	const handleMouseEnter = useCallback(
		(e: React.MouseEvent) => {
			if (variant === "begin" || optionHeld) return
			e.stopPropagation()
			setHoverSession({ type: "inactive" })
			const label = variant === "home" ? "Go Home" : "Continue"
			setOverrideTooltip({ icon: <ArrowDownIcon size={14} weight="bold" />, label })
		},
		[variant, optionHeld, setHoverSession, setOverrideTooltip],
	)

	const handleMouseLeave = useCallback(
		(e: React.MouseEvent) => {
			if (variant === "begin" || optionHeld) return
			e.stopPropagation()
			setOverrideTooltip(null)
		},
		[variant, optionHeld, setOverrideTooltip],
	)

	const isBegin = variant === "begin"
	const displayText = variant === "home" ? "go home" : variant

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
			{/* Border - bottom for begin, top for continue */}
			<div
				className={`absolute left-0 right-0 h-px bg-[var(--border-subtle)] z-10 ${isBegin ? "bottom-0" : "top-0"}`}
			/>

			<motion.button
				type="button"
				onClick={onClick}
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.15 }}
				className="w-full h-[44px] p-0 bg-black relative cursor-default hover:bg-[var(--bg-hover)] flex items-center justify-center"
			>
				{/* Initial flash that fades out */}
				<motion.div
					className={`absolute left-0 right-0 pointer-events-none bg-white/6 ${isBegin ? "top-0 bottom-px" : "top-px bottom-0"}`}
					initial={{ opacity: 1 }}
					animate={{ opacity: 0 }}
					transition={{ type: "spring", visualDuration: 2, bounce: 0 }}
				/>

				{/* Subtle ongoing pulse */}
				<motion.div
					className={`absolute left-0 right-0 pointer-events-none bg-white/5 ${isBegin ? "top-0 bottom-px" : "top-px bottom-0"}`}
					initial={{ opacity: 0 }}
					animate={{ opacity: [0, 1, 0] }}
					transition={{
						duration: 5,
						ease: "easeInOut",
						repeat: Infinity,
						delay: 1.5,
					}}
				/>

				<div className="flex items-center gap-2 relative z-10">
					<span className="text-white/60 text-xs font-medium tracking-wide">Press</span>
					<motion.kbd
						initial={{ backgroundColor: "rgba(255,255,255,0.25)" }}
						animate={{ backgroundColor: "rgba(255,255,255,0.15)" }}
						transition={{ type: "spring", visualDuration: 2, bounce: 0 }}
						className="px-2 h-5 text-white/70 text-[11px] font-medium flex items-center justify-center border border-[var(--border-subtle)]"
					>
						SPACE
					</motion.kbd>
					<span className="text-white/60 text-xs font-medium tracking-wide">to {displayText}</span>
				</div>
			</motion.button>
		</motion.div>
	)
}
