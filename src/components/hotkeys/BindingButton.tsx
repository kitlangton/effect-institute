import { DotsThreeIcon, XIcon } from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { useMeasure } from "@/hooks/useMeasure"
import { formatKeySequence } from "@/lib/hotkeys/format"
import type { KeySequence } from "@/lib/hotkeys/types"
import { GapWrap } from "./GapWrap"
import { KeySequenceDisplay } from "./KeySequenceDisplay"

export interface BindingButtonProps {
	sequence: KeySequence
	onRemove?: () => void
	isCapturing?: boolean
	idleSize: number
	leftGap?: number
}

export function BindingButton({ sequence, onRemove, isCapturing = false, idleSize, leftGap = 0 }: BindingButtonProps) {
	const hasKeys = sequence.length > 0
	const [isHovered, setIsHovered] = useState(false)
	const [measureRef, bounds] = useMeasure<HTMLSpanElement>()
	const PADDING = 18 // px-2 = 8px * 2 + 2px border
	const DOTS_WIDTH = 26 // width for the dots icon state
	const X_WIDTH = 18 // width for X icon + margin

	const contentWidth = bounds.width > 0 ? Math.ceil(bounds.width) + PADDING : DOTS_WIDTH
	const baseWidth = hasKeys ? contentWidth : DOTS_WIDTH
	const targetWidth = !isCapturing && isHovered ? baseWidth + X_WIDTH : baseWidth

	return (
		<GapWrap leftGap={leftGap} width={targetWidth}>
			<button
				type="button"
				onClick={onRemove}
				disabled={isCapturing}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				className={`group relative flex items-center justify-center border px-2 text-xs overflow-hidden transition-colors w-full box-border ${
					isCapturing
						? "border-amber-400/50 text-amber-100 bg-amber-400/10"
						: "bg-white/5 border-white/10 text-white/70 hover:border-red-400/60 hover:text-white"
				}`}
				style={{ height: idleSize }}
				aria-label={hasKeys ? `Remove ${formatKeySequence(sequence)}` : undefined}
			>
				{/* Hidden measurement span */}
				<span ref={measureRef} className="absolute opacity-0 pointer-events-none whitespace-nowrap">
					<KeySequenceDisplay sequence={sequence} />
				</span>

				<AnimatePresence mode="popLayout" initial={false}>
					{isCapturing && !hasKeys ? (
						<motion.span
							key="listening"
							initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
							animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
							exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
							transition={{ duration: 0.12 }}
						>
							<DotsThreeIcon size={18} weight="bold" />
						</motion.span>
					) : (
						<motion.span
							key="keys"
							initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
							animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
							exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
							transition={{ duration: 0.12 }}
							className="flex items-center"
						>
							<KeySequenceDisplay sequence={sequence} animated={isCapturing} />
							{!isCapturing && (
								<motion.span
									initial={{ width: 0, opacity: 0, marginLeft: 0 }}
									animate={{
										width: isHovered ? "auto" : 0,
										opacity: isHovered ? 1 : 0,
										marginLeft: isHovered ? 6 : 0,
									}}
									transition={{ type: "spring", visualDuration: 0.15, bounce: 0 }}
									className="inline-flex items-center overflow-hidden"
								>
									<XIcon size={12} className="text-red-200/90 shrink-0" />
								</motion.span>
							)}
						</motion.span>
					)}
				</AnimatePresence>
			</button>
		</GapWrap>
	)
}
