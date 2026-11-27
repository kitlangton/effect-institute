import { useEffect, useMemo, useRef, useState } from "react"
import type { SvgEffectNodeSpec } from "@/lib/hierarchy/types"
import type { StepDrivenComponentProps } from "./componentRegistry"
import { PixiEffectRow } from "./PixiEffectRow"
import { PixiEffectStage } from "./PixiEffectStage"

export interface EffectSyncDemoState {
	show1: boolean
	state1: "idle" | "running" | "completed"
	showLog1: boolean
	show2: boolean
	state2: "idle" | "running" | "completed"
	showLog2: boolean
}

function formatDateTime(): string {
	return new Date().toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit",
		hour12: true,
	})
}

/**
 * Step-driven component demonstrating Effect.sync.
 * Purely state-driven - no Effect execution.
 */
export function EffectSyncDemo({ state }: StepDrivenComponentProps<EffectSyncDemoState>) {
	// Generate results when transitioning to completed
	const [result1, setResult1] = useState<string>("")
	const [result2, setResult2] = useState<string>("")

	// Track previous state for edge detection
	const prevStateRef = useRef<EffectSyncDemoState>({
		show1: false,
		state1: "idle",
		showLog1: false,
		show2: false,
		state2: "idle",
		showLog2: false,
	})

	useEffect(() => {
		const prev = prevStateRef.current

		// === Effect 1 ===

		// Rising edge: state1 becomes completed
		if (state.state1 === "completed" && prev.state1 !== "completed") {
			setResult1(formatDateTime())
		}

		// Falling edge: state1 was completed, now isn't (seek backwards)
		if (state.state1 !== "completed" && prev.state1 === "completed") {
			setResult1("")
		}

		// Falling edge: show1 true→false (node hidden)
		if (!state.show1 && prev.show1) {
			setResult1("")
		}

		// === Effect 2 ===

		// Rising edge: state2 becomes completed
		if (state.state2 === "completed" && prev.state2 !== "completed") {
			setResult2(formatDateTime())
		}

		// Falling edge: state2 was completed, now isn't
		if (state.state2 !== "completed" && prev.state2 === "completed") {
			setResult2("")
		}

		// Falling edge: show2 true→false
		if (!state.show2 && prev.show2) {
			setResult2("")
		}

		prevStateRef.current = { ...state }
	}, [state])

	// All nodes always present, use hidden for animate in/out
	const nodes = useMemo(
		(): SvgEffectNodeSpec[] => [
			{
				id: "now",
				name: "now",
				visualState: state.state1,
				result: result1,
				showLog: state.showLog1,
				logMessage: "I'M TRAPPED IN A THUNK!",
				hidden: !state.show1,
			},
			{
				id: "later",
				name: "later",
				visualState: state.state2,
				result: result2,
				showLog: state.showLog2,
				logMessage: "I'M TRAPPED IN A THUNK!",
				hidden: !state.show2,
			},
		],
		[state.show1, state.show2, state.state1, state.state2, state.showLog1, state.showLog2, result1, result2],
	)

	const isVisible = state.show1 || state.show2

	return (
		<PixiEffectStage height={170} visible={isVisible}>
			{({ app, width }) => (
				<PixiEffectRow
					sharedApp={app}
					widthOverride={width}
					nodes={nodes}
					gap={32}
					paddingTop={40}
					stageTransform={{
						opacity: isVisible ? 1 : 0,
						scale: isVisible ? 1 : 0.9,
					}}
				/>
			)}
		</PixiEffectStage>
	)
}
