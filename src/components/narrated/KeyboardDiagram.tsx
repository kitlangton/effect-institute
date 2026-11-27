import { AnimatePresence, motion } from "motion/react"
import { useEffect, useRef } from "react"
import { appSounds } from "@/sounds/AppSounds"
import { StageWrapper } from "./animations"
import type { StepDrivenComponentProps } from "./componentRegistry"
import { Key } from "./Key"
import { RotatingBadge } from "./RotatingBadge"

const COMPLETION_SQUARE = {
	size: 6,
	color: "var(--color-success-bright)",
	glowShadow: "0 0 6px 1px rgba(52, 211, 153, 0.45)",
	noShadow: "0 0 0px 0px rgba(52, 211, 153, 0)",
	glowTransition: {
		type: "spring" as const,
		visualDuration: 0.4,
		bounce: 0,
	},
}

// =============================================================================

interface KeyboardState {
	pressed: "none" | "space" | "up" | "down" | "left" | "right"
	activeWord: number // -1 = none, 0-3 = word index, 999 = all done
	showSpace: boolean
	showArrows: boolean
	showCompletion: boolean
}

function KeyboardDiagram({ state }: StepDrivenComponentProps<KeyboardState>) {
	const { pressed, activeWord, showSpace, showArrows, showCompletion } = state
	const prevPressedRef = useRef(pressed)
	const prevShowCompletionRef = useRef(showCompletion)

	// Play sounds on key press/release
	useEffect(() => {
		const prevPressed = prevPressedRef.current
		prevPressedRef.current = pressed

		if (prevPressed === pressed) return

		if (pressed !== "none" && prevPressed === "none") {
			// Key pressed down
			appSounds.playKeyPress()
		} else if (pressed === "none" && prevPressed !== "none") {
			// Key released
			appSounds.playKeyRelease()
		}
	}, [pressed])

	// Play completion sound when completion appears
	useEffect(() => {
		const prevShowCompletion = prevShowCompletionRef.current
		prevShowCompletionRef.current = showCompletion

		if (showCompletion && !prevShowCompletion) {
			appSounds.playCompletionSound()
		}
	}, [showCompletion])

	return (
		<div className="font-mono flex flex-col items-center select-none min-h-[340px] justify-center">
			{/* Badge → Spacebar transition */}
			<AnimatePresence mode="popLayout">
				{!showSpace ? (
					<motion.div
						key="title"
						initial={{ opacity: 0, scale: 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.5, filter: "blur(10px)" }}
						transition={{ duration: 0.5, ease: "backInOut" }}
					>
						<RotatingBadge activeWord={activeWord} />
					</motion.div>
				) : (
					<StageWrapper
						key="spacebar"
						overflow="visible"
						padding="pb-12 px-2"
						className="relative z-10 flex flex-col items-center"
					>
						{/* Completion square - appears above spacebar */}
						<AnimatePresence initial={false}>
							{showCompletion && (
								<StageWrapper key="completion" overflow="visible" padding="pb-10" className="flex justify-center">
									<div className="relative flex items-center justify-center" style={{ width: 60, height: 60 }}>
										{/* Expanding pulse ring */}
										<svg className="absolute inset-0" viewBox="0 0 60 60" style={{ overflow: "visible" }}>
											<motion.circle
												cx="30"
												cy="30"
												fill="none"
												stroke={COMPLETION_SQUARE.color}
												strokeWidth="1"
												initial={{ r: 4, opacity: 0.6 }}
												animate={{ r: 40, opacity: 0 }}
												transition={{
													r: { duration: 2, ease: [0.2, 0.9, 0.3, 1] },
													opacity: { duration: 2.5, ease: [0.4, 0, 0.2, 1] },
												}}
											/>
										</svg>
										{/* The square itself */}
										<motion.div
											style={{
												width: COMPLETION_SQUARE.size,
												height: COMPLETION_SQUARE.size,
												borderRadius: 0,
												backgroundColor: COMPLETION_SQUARE.color,
											}}
											initial={{ boxShadow: COMPLETION_SQUARE.noShadow }}
											animate={{ boxShadow: COMPLETION_SQUARE.glowShadow }}
											transition={COMPLETION_SQUARE.glowTransition}
										/>
									</div>
								</StageWrapper>
							)}
						</AnimatePresence>
						<Key pressed={pressed === "space"} width={240}>
							SPACE BAR
						</Key>
					</StageWrapper>
				)}
			</AnimatePresence>

			{/* Arrow keys */}
			<AnimatePresence initial={false} mode="popLayout">
				{showArrows && (
					<StageWrapper
						key="arrows"
						overflow="visible"
						padding="pt-0 pb-4 px-2"
						className="flex flex-col items-center relative z-10"
					>
						{/* Up - shifted down and clipped so bottom border is hidden */}
						<div className="relative" style={{ marginBottom: -7.5 }}>
							<Key pressed={pressed === "up"}>↑</Key>
						</div>

						{/* Bottom row - overlapping borders */}
						<div className="flex relative z-10">
							<Key pressed={pressed === "left"}>←</Key>
							<div style={{ marginLeft: -1.5, zIndex: 10 }}>
								<Key pressed={pressed === "down"}>↓</Key>
							</div>
							<div style={{ marginLeft: -1.5 }}>
								<Key pressed={pressed === "right"}>→</Key>
							</div>
						</div>
					</StageWrapper>
				)}
			</AnimatePresence>
		</div>
	)
}

export { KeyboardDiagram }
