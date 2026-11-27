import { AnimatePresence, motion } from "motion/react"
import type { KeySequence } from "@/lib/hotkeys/types"
import { KeyComboDisplay } from "./KeyComboDisplay"

export function KeySequenceDisplay({ sequence, animated }: { sequence: KeySequence; animated?: boolean }) {
	if (!animated) {
		return (
			<>
				{sequence.map((combo, i) => (
					<span key={i}>
						{i > 0 && <span className="text-white/30 mx-1">then</span>}
						<KeyComboDisplay combo={combo} />
					</span>
				))}
			</>
		)
	}

	return (
		<AnimatePresence mode="popLayout" initial={false}>
			{sequence.map((combo, i) => (
				<motion.span
					key={i}
					initial={{ opacity: 0, width: 0, filter: "blur(4px)" }}
					animate={{ opacity: 1, width: "auto", filter: "blur(0px)" }}
					exit={{ opacity: 0, width: 0, filter: "blur(4px)" }}
					transition={{ type: "spring", visualDuration: 0.15, bounce: 0 }}
					className="inline-flex items-center overflow-hidden whitespace-nowrap"
				>
					{i > 0 && <span className="text-white/30 mx-1">then</span>}
					<KeyComboDisplay combo={combo} />
				</motion.span>
			))}
		</AnimatePresence>
	)
}
