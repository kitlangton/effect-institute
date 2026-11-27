import { useEffect, useMemo, useRef, useState } from "react"
import type { SvgEffectNodeSpec } from "@/lib/hierarchy/types"
import type { StepDrivenComponentProps } from "./componentRegistry"
import { PixiEffectRow } from "./PixiEffectRow"
import { PixiEffectStage } from "./PixiEffectStage"

export interface SyncVsSucceedDemoState {
	mode: "succeed" | "sync"
	run1State: "idle" | "running" | "completed"
	run2State: "idle" | "running" | "completed"
	run3State: "idle" | "running" | "completed"
}

function formatTime(): string {
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
 * Demonstrates the difference between Effect.succeed and Effect.sync.
 * - succeed: memoized, always returns the same value
 * - sync: fresh execution each time, returns new values
 */
export function SyncVsSucceedDemo({ state }: StepDrivenComponentProps<SyncVsSucceedDemoState>) {
	const [result1, setResult1] = useState<string>("")
	const [result2, setResult2] = useState<string>("")
	const [result3, setResult3] = useState<string>("")

	// For succeed mode, capture timestamp once and reuse
	const memoizedTimeRef = useRef<string | null>(null)

	const prevStateRef = useRef<SyncVsSucceedDemoState>({
		mode: "succeed",
		run1State: "idle",
		run2State: "idle",
		run3State: "idle",
	})

	useEffect(() => {
		const prev = prevStateRef.current

		// Mode changed - reset everything
		if (state.mode !== prev.mode) {
			setResult1("")
			setResult2("")
			setResult3("")
			memoizedTimeRef.current = null
		}

		// Run 1 completes
		if (state.run1State === "completed" && prev.run1State !== "completed") {
			if (state.mode === "succeed") {
				// Memoize the time on first run
				if (!memoizedTimeRef.current) {
					memoizedTimeRef.current = formatTime()
				}
				setResult1(memoizedTimeRef.current)
			} else {
				setResult1(formatTime())
			}
		}

		// Run 2 completes
		if (state.run2State === "completed" && prev.run2State !== "completed") {
			if (state.mode === "succeed") {
				// Same memoized value
				setResult2(memoizedTimeRef.current ?? formatTime())
			} else {
				// Fresh value for sync
				setResult2(formatTime())
			}
		}

		// Run 3 completes
		if (state.run3State === "completed" && prev.run3State !== "completed") {
			if (state.mode === "succeed") {
				setResult3(memoizedTimeRef.current ?? formatTime())
			} else {
				setResult3(formatTime())
			}
		}

		// Reset results when states go back to idle
		if (state.run1State === "idle" && prev.run1State !== "idle") setResult1("")
		if (state.run2State === "idle" && prev.run2State !== "idle") setResult2("")
		if (state.run3State === "idle" && prev.run3State !== "idle") setResult3("")

		prevStateRef.current = { ...state }
	}, [state])

	const showRun1 = state.run1State !== "idle"
	const showRun2 = state.run2State !== "idle"
	const showRun3 = state.run3State !== "idle"
	const isVisible = showRun1 || showRun2 || showRun3

	const nodes = useMemo(
		(): SvgEffectNodeSpec[] => [
			{
				id: "now",
				name: "now",
				visualState: state.run1State,
				result: result1,
				hidden: !showRun1,
			},
			{
				id: "later",
				name: "later",
				visualState: state.run2State,
				result: result2,
				hidden: !showRun2,
			},
			{
				id: "tomorrow",
				name: "tomorrow",
				visualState: state.run3State,
				result: result3,
				hidden: !showRun3,
			},
		],
		[showRun1, showRun2, showRun3, state.run1State, state.run2State, state.run3State, result1, result2, result3],
	)

	return (
		<PixiEffectStage height={170} visible={isVisible}>
			{({ app, width }) => (
				<PixiEffectRow
					sharedApp={app}
					widthOverride={width}
					nodes={nodes}
					gap={24}
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
