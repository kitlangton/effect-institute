/**
 * StaticEffectNode - A state-driven effect visualization component.
 *
 * This component renders an Effect node that is controlled entirely by props
 * rather than executing an actual Effect. It reuses the visual-effect animation
 * infrastructure (EffectContainer, EffectContent, EffectOverlay) to display
 * idle, running, completed, and failed states.
 *
 * ## Usage
 *
 * ```tsx
 * <StaticEffectNode
 *   name="myEffect"
 *   visualState="running"
 *   result="42"
 *   showLog={true}
 *   logMessage="Processing..."
 * />
 * ```
 *
 * ## Props
 *
 * - `name`: Label shown below the effect node
 * - `visualState`: "idle" | "running" | "completed" | "failed" | "death"
 * - `result`: Optional result string shown when completed
 * - `error`: Optional error string shown when failed
 * - `showLog`: Whether to show the log bubble above the node
 * - `logMessage`: Message displayed in the log bubble
 *
 * ## Synchronizing with Narration
 *
 * Use with step-driven component flow to sync state changes with transcript words:
 *
 * ```typescript
 * component: {
 *   name: "MyDemo",
 *   base: { state: "idle", showLog: false },
 *   flow: [
 *     on("running").state({ state: "running" }),
 *     on("message").state({ showLog: true }),
 *     on("done").state({ state: "completed", showLog: false }),
 *   ],
 * }
 * ```
 *
 * ## Sound Effects
 *
 * Sound effects are built-in and play automatically on state transitions:
 * - idle → running: playRunning()
 * - running → completed: playSuccess()
 * - running → failed: playFailure()
 * - running → death: playDeath()
 * - showLog appears: playNotificationChime()
 */

import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { EffectContainer } from "@/lib/visual-effect/effect/EffectContainer"
import { EffectContent } from "@/lib/visual-effect/effect/EffectContent"
import { EffectOverlay } from "@/lib/visual-effect/effect/EffectOverlay"
import {
	useEffectAnimations,
	useEffectMotion,
	useRunningAnimation,
	useStateAnimations,
} from "@/lib/visual-effect/effect/useEffectMotion"
import { FailureBubble } from "@/lib/visual-effect/feedback/FailureBubble"
import { taskSounds } from "@/lib/visual-effect/sounds/TaskSounds"
import { theme } from "@/lib/visual-effect/theme"
import type { EffectState } from "@/lib/visual-effect/VisualEffect"

// =============================================================================
// Log Bubble (simple notification bubble above the effect node)
// =============================================================================

interface LogBubbleProps {
	message: string
}

/**
 * A notification-style bubble that appears above the effect node.
 * Useful for showing console.log output or other messages.
 */
export function LogBubble({ message }: LogBubbleProps) {
	return (
		<motion.div
			style={{
				position: "absolute",
				bottom: "100%",
				left: "50%",
				x: "-50%",
				zIndex: 1000,
				pointerEvents: "none",
				marginBottom: 8,
			}}
			initial={{ opacity: 0, scale: 0.6, y: 15, filter: "blur(8px)" }}
			animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
			exit={{ opacity: 0, scale: 0.6, y: 15, filter: "blur(8px)" }}
			transition={{
				type: "spring",
				visualDuration: 0.4,
				bounce: 0.5,
				filter: { bounce: 0 },
			}}
		>
			{/* Arrow pointing down */}
			<div
				style={{
					position: "absolute",
					bottom: -7,
					left: "50%",
					transform: "translateX(-50%)",
					width: 0,
					height: 0,
					borderLeft: "8px solid transparent",
					borderRight: "8px solid transparent",
					borderTop: "8px solid #3b82f6",
				}}
			/>

			{/* Bubble content */}
			<div
				className="px-3 py-2 text-white font-mono text-sm whitespace-nowrap"
				style={{
					background: "#3b82f6",
					borderRadius: 0,
					boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(59, 130, 246, 0.3)",
				}}
			>
				{message}
			</div>
		</motion.div>
	)
}

// =============================================================================
// Static Effect Node
// =============================================================================

export interface StaticEffectNodeProps {
	/** Label shown below the effect node */
	name: string
	/** Visual state: "idle" | "running" | "completed" | "failed" | "death" */
	visualState: "idle" | "running" | "completed" | "failed" | "death"
	/** Result string shown when completed */
	result?: string
	/** Error string shown when failed */
	error?: string
	/** Whether to show the log bubble */
	showLog?: boolean
	/** Message displayed in the log bubble */
	logMessage?: string
}

/**
 * A state-driven effect node that reuses the visual machinery
 * but is controlled entirely by props rather than an actual Effect.
 */
export function StaticEffectNode({ name, visualState, result, error, showLog, logMessage }: StaticEffectNodeProps) {
	// Use the standard motion value infrastructure
	const effectMotion = useEffectMotion()

	// Track previous state for edge detection
	const prevStateRef = useRef(visualState)
	const prevShowLogRef = useRef(showLog)

	// State for error bubble visibility and hover
	const [showErrorBubble, setShowErrorBubble] = useState(false)
	const [isHovering, setIsHovering] = useState(false)

	// Sound effects on state transitions
	useEffect(() => {
		const prev = prevStateRef.current

		if (visualState === "running" && prev !== "running") {
			taskSounds.playRunning()
		}
		if (visualState === "completed" && prev !== "completed") {
			taskSounds.playSuccess()
		}
		if (visualState === "failed" && prev !== "failed") {
			taskSounds.playFailure()
		}
		if (visualState === "death" && prev !== "death") {
			taskSounds.playDeath()
		}

		// Log bubble appearance
		if (showLog && !prevShowLogRef.current) {
			taskSounds.playNotificationChime()
		}

		prevStateRef.current = visualState
		prevShowLogRef.current = showLog
	}, [visualState, showLog])

	// Build the state object from props
	const state: EffectState<string, string> = useMemo(() => {
		switch (visualState) {
			case "idle":
				return { type: "idle" }
			case "running":
				return { type: "running" }
			case "completed":
				return { type: "completed", result: result ?? "" }
			case "failed":
				return { type: "failed", error: error ?? "" }
			case "death":
				return { type: "death", error: error ?? "" }
			default:
				return { type: "idle" }
		}
	}, [visualState, result, error])

	const isRunning = state.type === "running"
	const isFailed = state.type === "failed" || state.type === "death"

	// Apply the standard animations - these drive the motion values
	useRunningAnimation(isRunning, effectMotion)
	useStateAnimations(state, effectMotion)
	// This handles shake animation and error bubble auto-show/hide
	useEffectAnimations(state, effectMotion, isHovering, setShowErrorBubble)

	// Stable mouse handlers
	const handleMouseEnter = useCallback(() => {
		setIsHovering(true)
		if (isFailed) setShowErrorBubble(true)
	}, [isFailed])

	const handleMouseLeave = useCallback(() => {
		setIsHovering(false)
	}, [])

	return (
		<div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
			{/* Log bubble */}
			<AnimatePresence>{showLog && logMessage && <LogBubble key="log" message={logMessage} />}</AnimatePresence>

			<motion.div
				style={{
					width: effectMotion.nodeWidth,
					height: 64,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					position: "relative",
				}}
			>
				{/* Error bubble positioned outside container */}
				<AnimatePresence>
					{isFailed && showErrorBubble && state.type === "failed" && <FailureBubble error={state.error} />}
				</AnimatePresence>

				<EffectContainer
					state={state}
					motionValues={effectMotion}
					onMouseEnter={handleMouseEnter}
					onMouseLeave={handleMouseLeave}
				>
					<EffectOverlay isRunning={isRunning} motionValues={effectMotion} />
					<EffectContent state={state} motionValues={effectMotion} />
				</EffectContainer>
			</motion.div>
			{/* State-driven label */}
			<motion.div
				style={{
					marginTop: theme.spacing.sm,
					fontSize: "0.75rem",
					textAlign: "center",
					fontWeight: 500,
					fontFamily: "monospace",
					color: theme.colors.textMuted,
				}}
				animate={{
					color: state.type === "idle" ? theme.colors.textMuted : theme.colors.textSecondary,
				}}
				transition={{ duration: 0.3 }}
			>
				{name}
			</motion.div>
		</div>
	)
}
