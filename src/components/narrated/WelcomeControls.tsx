import { ArrowCounterClockwiseIcon, FastForwardIcon, RewindIcon } from "@phosphor-icons/react"
import { motion } from "motion/react"
import { useEffect, useRef } from "react"
import { appSounds } from "@/sounds/AppSounds"
import type { StepDrivenComponentProps } from "./componentRegistry"
import { Key } from "./Key"

interface WelcomeControlsState {
	highlightedKey: "none" | "restart" | "seek_left" | "seek_right"
	hasRotated: boolean
}

export function WelcomeControls({ state }: StepDrivenComponentProps<WelcomeControlsState>) {
	const { highlightedKey, hasRotated } = state
	const prevHighlightedRef = useRef(highlightedKey)

	// Restart brightness is tied to key press, not persistent
	const restartActive = highlightedKey === "restart"

	// Play sounds on key press/release
	useEffect(() => {
		const prev = prevHighlightedRef.current
		prevHighlightedRef.current = highlightedKey

		if (prev === highlightedKey) return

		if (highlightedKey !== "none" && prev === "none") {
			appSounds.playKeyPress()
		} else if (highlightedKey === "none" && prev !== "none") {
			appSounds.playKeyRelease()
		}
	}, [highlightedKey])

	return (
		<div className="flex flex-col items-center justify-center min-h-[300px] font-mono select-none">
			<div className="flex items-start gap-20">
				{/* Restart Group */}
				<div className="flex flex-col items-center gap-5">
					<motion.div
						animate={{
							rotate: hasRotated ? -360 : 0,
							color: restartActive ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.5)",
						}}
						transition={{
							rotate: { type: "spring", visualDuration: 0.5, bounce: 0.4 },
							color: { duration: 0.15 },
						}}
						className="mb-4"
					>
						<ArrowCounterClockwiseIcon size={28} weight="bold" />
					</motion.div>
					<Key pressed={restartActive}>R</Key>
					<motion.div
						animate={{
							opacity: restartActive ? 1 : 0.4,
							y: restartActive ? -2 : 0,
						}}
						className="text-sm text-white tracking-wide"
					>
						restart
					</motion.div>
				</div>

				{/* Seek Group */}
				<div className="flex flex-col items-center gap-5">
					<div className="flex items-center gap-2 mb-4">
						{/* Rewind icon centered over left key */}
						<div className="w-[52px] flex justify-center">
							<motion.div
								animate={{
									color: highlightedKey === "seek_left" ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.5)",
									scale: highlightedKey === "seek_left" ? 1.1 : 1,
								}}
								transition={{
									duration: 0.15,
									scale: { type: "spring", visualDuration: 0.3, bounce: 0.3 },
								}}
							>
								<RewindIcon size={28} weight="fill" />
							</motion.div>
						</div>
						{/* Fast forward icon centered over right key */}
						<div className="w-[52px] flex justify-center">
							<motion.div
								animate={{
									color: highlightedKey === "seek_right" ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.5)",
									scale: highlightedKey === "seek_right" ? 1.1 : 1,
								}}
								transition={{
									duration: 0.15,
									scale: { type: "spring", visualDuration: 0.3, bounce: 0.3 },
								}}
							>
								<FastForwardIcon size={28} weight="fill" />
							</motion.div>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Key pressed={highlightedKey === "seek_left"} size="lg">
							←
						</Key>
						<Key pressed={highlightedKey === "seek_right"} size="lg">
							→
						</Key>
					</div>
					<motion.div
						animate={{
							opacity: highlightedKey === "seek_left" || highlightedKey === "seek_right" ? 1 : 0.4,
							y: highlightedKey === "seek_left" || highlightedKey === "seek_right" ? -2 : 0,
						}}
						className="text-sm text-white tracking-wide"
					>
						seek
					</motion.div>
				</div>
			</div>
		</div>
	)
}
