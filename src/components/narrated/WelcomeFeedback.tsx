import { useAtomSet } from "@effect/atom-react"
import { ChatCenteredDotsIcon, CursorIcon, GaugeIcon, SlidersIcon } from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useRef } from "react"
import { type PlaybackRate, playbackRateOverrideAtom } from "@/atoms/audioPlayer"
import { appSounds } from "@/sounds/AppSounds"
import { StageWrapper } from "./animations"
import type { StepDrivenComponentProps } from "./componentRegistry"
import { RotatingBadge } from "./RotatingBadge"

const SMOOTH_SPRING = {
	type: "spring" as const,
	visualDuration: 0.5,
	bounce: 0.1,
}

const CURSOR_SPRING = {
	type: "spring" as const,
	visualDuration: 0.8,
	bounce: 0,
}

const CLICK_SPRING = {
	type: "spring" as const,
	visualDuration: 0.15,
	bounce: 0.2,
}

const BOUNCY_SPRING = {
	type: "spring" as const,
	visualDuration: 0.35,
	bounce: 0.3,
}

// =============================================================================

interface WelcomeFeedbackState {
	stage: "settings" | "playback" | "feedback" | "badge"
	cursorState: "hidden" | "approaching" | "hovering" | "clicking"
	selectedSpeed: "none" | "0.5×" | "0.75×" | "1×" | "1.25×" | "1.5×" | "2×"
	sendButtonPressed: boolean
	feedbackSent: boolean
	actualSpeed: number | null
}

const SPEEDS = ["0.5×", "0.75×", "1×", "1.25×", "1.5×", "2×"] as const

export function WelcomeFeedback({ state }: StepDrivenComponentProps<WelcomeFeedbackState>) {
	const { stage, cursorState, selectedSpeed, sendButtonPressed, feedbackSent, actualSpeed } = state
	const prevCursorStateRef = useRef(cursorState)
	const prevSelectedSpeedRef = useRef(selectedSpeed)
	const prevButtonPressedRef = useRef(sendButtonPressed)
	const prevFeedbackSentRef = useRef(feedbackSent)
	const setOverride = useAtomSet(playbackRateOverrideAtom)

	// Play click sound when cursor clicks
	useEffect(() => {
		const prev = prevCursorStateRef.current
		prevCursorStateRef.current = cursorState

		if (prev === cursorState) return

		if (cursorState === "clicking") {
			appSounds.playKeyPress()
		}
	}, [cursorState])

	// Play sound when speed selection changes
	useEffect(() => {
		const prev = prevSelectedSpeedRef.current
		prevSelectedSpeedRef.current = selectedSpeed

		if (prev === selectedSpeed) return
		if (prev === "none" || selectedSpeed === "none") return

		appSounds.playNavigationTick()
	}, [selectedSpeed])

	// Play click sound when send button is pressed
	useEffect(() => {
		const prev = prevButtonPressedRef.current
		prevButtonPressedRef.current = sendButtonPressed

		if (prev === sendButtonPressed) return

		if (sendButtonPressed) {
			appSounds.playKeyPress()
		}
	}, [sendButtonPressed])

	// Play success sound when feedback is sent
	useEffect(() => {
		const prev = prevFeedbackSentRef.current
		prevFeedbackSentRef.current = feedbackSent

		if (prev === feedbackSent) return

		if (feedbackSent) {
			appSounds.playSentSound()
		}
	}, [feedbackSent])

	// Set playback rate override when actualSpeed changes
	// Skip on Safari - playbackRate changes cause audio glitches (WebKit bugs 240405, 221334)
	useEffect(() => {
		if (actualSpeed != null) {
			const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
			if (!isSafari) {
				setOverride(actualSpeed as PlaybackRate)
			}
		}
	}, [actualSpeed, setOverride])

	// Clear override when leaving playback stage or unmounting
	useEffect(() => {
		if (stage !== "playback") {
			setOverride(null)
		}
		return () => setOverride(null)
	}, [stage, setOverride])

	return (
		<div className="flex flex-col items-center justify-center min-h-[300px] font-mono select-none">
			<AnimatePresence initial={false}>
				{stage === "settings" && <SettingsStage cursorState={cursorState} key="settings" />}
				{stage === "playback" && <PlaybackStage selectedSpeed={selectedSpeed} key="playback" />}
				{stage === "feedback" && <FeedbackStage buttonPressed={sendButtonPressed} sent={feedbackSent} key="feedback" />}
				{stage === "badge" && <BadgeStage key="badge" />}
			</AnimatePresence>
		</div>
	)
}

// =============================================================================
// Settings Stage - Icon with cursor interaction (SVG-based)
// =============================================================================

const CANVAS_SIZE = 160
const BUTTON_SIZE = 40
const BUTTON_CENTER = CANVAS_SIZE / 2

// Cursor positions relative to canvas - cursor tip is at (0,0) of the cursor shape
const CURSOR_POSITIONS = {
	hidden: { x: CANVAS_SIZE + 60, y: CANVAS_SIZE + 60 },
	approaching: { x: BUTTON_CENTER + 35, y: BUTTON_CENTER + 35 },
	hovering: { x: BUTTON_CENTER, y: BUTTON_CENTER },
	clicking: { x: BUTTON_CENTER, y: BUTTON_CENTER + 2 }, // Press down effect
}

function SettingsStage({ cursorState }: { cursorState: WelcomeFeedbackState["cursorState"] }) {
	const isHovering = cursorState === "hovering" || cursorState === "clicking"
	const isClicking = cursorState === "clicking"
	const cursorPos = CURSOR_POSITIONS[cursorState]

	return (
		<StageWrapper blur padding="py-4">
			{/* Container for SVG + cursor overlay */}
			<div className="relative" style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
				<svg
					width={CANVAS_SIZE}
					height={CANVAS_SIZE}
					viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
					className="overflow-visible"
				>
					{/* Click ripple - fast expand, slow fade at edge */}
					{isClicking && (
						<motion.circle
							cx={BUTTON_CENTER}
							cy={BUTTON_CENTER}
							fill="white"
							initial={{ r: 8, opacity: 0.15 }}
							animate={{ r: 55, opacity: 0 }}
							transition={{
								r: { duration: 0.9, ease: [0.2, 0.95, 0.3, 1] },
								opacity: { duration: 1.2, ease: [0.4, 0, 0.2, 1] },
							}}
						/>
					)}

					{/* Settings button background */}
					<motion.rect
						x={BUTTON_CENTER - BUTTON_SIZE / 2}
						y={BUTTON_CENTER - BUTTON_SIZE / 2}
						width={BUTTON_SIZE}
						height={BUTTON_SIZE}
						fill="rgba(255,255,255,0.05)"
						stroke="rgba(255,255,255,0.2)"
						strokeWidth={1}
						animate={{
							fill: isClicking
								? "rgba(255,255,255,0.3)"
								: isHovering
									? "rgba(255,255,255,0.1)"
									: "rgba(255,255,255,0.05)",
							stroke: isClicking
								? "rgba(255,255,255,0.8)"
								: isHovering
									? "rgba(255,255,255,0.5)"
									: "rgba(255,255,255,0.2)",
							scale: isClicking ? 0.92 : 1,
						}}
						style={{ transformOrigin: `${BUTTON_CENTER}px ${BUTTON_CENTER}px` }}
						transition={isClicking ? CLICK_SPRING : SMOOTH_SPRING}
					/>

					{/* Settings icon */}
					<motion.g
						animate={{
							opacity: isHovering ? 1 : 0.6,
							scale: isClicking ? 0.92 : 1,
						}}
						style={{ transformOrigin: `${BUTTON_CENTER}px ${BUTTON_CENTER}px` }}
						transition={isClicking ? CLICK_SPRING : SMOOTH_SPRING}
					>
						<foreignObject x={BUTTON_CENTER - 10} y={BUTTON_CENTER - 10} width={20} height={20}>
							<div className="w-full h-full flex items-center justify-center text-white">
								<SlidersIcon size={18} weight="fill" />
							</div>
						</foreignObject>
					</motion.g>
				</svg>

				{/* Cursor as HTML overlay - avoids Safari foreignObject transform bugs */}
				<motion.div
					className="absolute text-white pointer-events-none"
					style={{
						filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
						left: -2,
						top: -2,
					}}
					initial={{
						x: CURSOR_POSITIONS.hidden.x,
						y: CURSOR_POSITIONS.hidden.y,
						opacity: 0,
					}}
					animate={{
						x: cursorPos.x,
						y: cursorPos.y,
						opacity: cursorState === "hidden" ? 0 : 1,
						scale: isClicking ? 0.75 : 1,
					}}
					transition={CURSOR_SPRING}
				>
					<CursorIcon size={24} weight="fill" />
				</motion.div>
			</div>
		</StageWrapper>
	)
}

// =============================================================================
// Playback Stage - Speed selector
// =============================================================================

function PlaybackStage({ selectedSpeed }: { selectedSpeed: WelcomeFeedbackState["selectedSpeed"] }) {
	return (
		<StageWrapper blur padding="py-4" className="flex flex-col items-center gap-4">
			{/* Speed icon */}
			<motion.div
				initial={{ scale: 0.8, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ ...BOUNCY_SPRING, delay: 0.1 }}
				className="text-white/80"
			>
				<GaugeIcon size={24} weight="fill" />
			</motion.div>

			{/* Vertical speed list */}
			<motion.div
				className="border border-white/20 bg-white/5"
				initial={{ scale: 0.95, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ ...BOUNCY_SPRING, delay: 0.15 }}
			>
				{SPEEDS.map((speed) => {
					const isSelected = selectedSpeed === speed
					return (
						<div key={speed} className="px-8 py-2 text-sm tabular-nums relative">
							{/* Selection background */}
							{isSelected && (
								<motion.div
									layoutId="playback-speed-bg"
									className="absolute inset-0 bg-white"
									transition={SMOOTH_SPRING}
								/>
							)}
							<motion.span
								className="relative z-10"
								animate={{
									color: isSelected ? "rgba(0,0,0,1)" : "rgba(255,255,255,0.5)",
								}}
								transition={SMOOTH_SPRING}
							>
								{speed}
							</motion.span>
						</div>
					)
				})}
			</motion.div>
		</StageWrapper>
	)
}

// =============================================================================
// Feedback Stage - Text field with message
// =============================================================================

function FeedbackStage({ buttonPressed, sent }: { buttonPressed: boolean; sent: boolean }) {
	return (
		<StageWrapper blur padding="py-4" className="flex flex-col items-center gap-4">
			{/* Feedback icon */}
			<motion.div
				initial={{ scale: 0.8, opacity: 0 }}
				animate={{
					scale: sent ? 1.1 : 1,
					opacity: 1,
					color: sent ? "rgba(52,211,153,1)" : "rgba(255,255,255,0.8)",
				}}
				transition={{ ...BOUNCY_SPRING, delay: 0.1 }}
			>
				<ChatCenteredDotsIcon size={24} weight="fill" />
			</motion.div>

			{/* Text field */}
			<motion.div
				className="flex flex-col gap-3"
				initial={{ scale: 0.95, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ ...BOUNCY_SPRING, delay: 0.15 }}
			>
				<motion.div
					className="border border-white/20 bg-white/5 px-4 py-3 min-w-[220px]"
					animate={{
						borderColor: sent ? "rgba(52,211,153,0.5)" : "rgba(255,255,255,0.2)",
					}}
					transition={SMOOTH_SPRING}
				>
					<span className="text-sm text-white/90">This website sucks</span>
				</motion.div>

				{/* Send button / status */}
				<div className="h-[28px] flex items-center justify-center">
					<AnimatePresence mode="wait">
						{sent ? (
							<motion.div
								key="sent"
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
								transition={BOUNCY_SPRING}
								className="flex items-center justify-center gap-2 text-emerald-400 text-xs"
							>
								<span>✓</span>
								<span>sent</span>
							</motion.div>
						) : (
							<motion.div
								key="button"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0, y: -4 }}
								transition={SMOOTH_SPRING}
								className="flex justify-end w-full"
							>
								<motion.div
									className="px-3 py-1 text-xs border"
									animate={{
										backgroundColor: buttonPressed ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)",
										borderColor: buttonPressed ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)",
										color: buttonPressed ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.7)",
										scale: buttonPressed ? 0.95 : 1,
										y: buttonPressed ? 1 : 0,
									}}
									transition={CLICK_SPRING}
								>
									Send
								</motion.div>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</motion.div>
		</StageWrapper>
	)
}

// =============================================================================
// Badge Stage - Effect Institute rotating badge
// =============================================================================

function BadgeStage() {
	return (
		<StageWrapper blur padding="py-4">
			<motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={BOUNCY_SPRING}>
				<RotatingBadge activeWord={999} />
			</motion.div>
		</StageWrapper>
	)
}
