import { motion } from "motion/react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { HierarchicalEffectNode } from "@/lib/hierarchy/types"
import type { StepDrivenComponentProps } from "./componentRegistry"
import { HierarchicalEffectRow } from "./HierarchicalEffectRow"

export interface WhyComposeDemoState {
	show: boolean
	state1: "idle" | "running" | "completed"
	state2: "idle" | "running" | "completed"
	showLog2: boolean
	showContainer: boolean
	combined: boolean
	showProgramNode: boolean
	hideBackground: boolean
	programState: "idle" | "running" | "completed"
	showProgramLog: boolean
}

function generateSensorReading(): { mSv: number; isSafe: boolean } {
	// Generate a safe reading (< 1 mSv) most of the time
	const mSv = Math.random() < 0.8 ? Math.random() * 0.9 : Math.random() * 500 + 100
	return { mSv, isSafe: mSv < 1 }
}

/**
 * Step-driven component demonstrating the anti-pattern of running effects separately.
 * Shows two effects being run one after another (the "hacky" way).
 * Uses HierarchicalEffectRow for container morphing animation.
 */
export function WhyComposeDemo({ state }: StepDrivenComponentProps<WhyComposeDemoState>) {
	const [sensorResult, setSensorResult] = useState<string>("")
	const [isSafe, setIsSafe] = useState<boolean>(true)
	const [result2, setResult2] = useState<string>("")

	const prevStateRef = useRef<WhyComposeDemoState>({
		show: false,
		state1: "idle",
		state2: "idle",
		showLog2: false,
		showContainer: false,
		combined: false,
		showProgramNode: false,
		hideBackground: false,
		programState: "idle",
		showProgramLog: false,
	})

	useEffect(() => {
		const prev = prevStateRef.current

		// Effect 1 (sensorData) completes - show the mSv reading
		if (state.state1 === "completed" && prev.state1 !== "completed") {
			const reading = generateSensorReading()
			setSensorResult(`{ mSv: ${reading.mSv.toFixed(1)} }`)
			setIsSafe(reading.isSafe)
		}
		if (state.state1 !== "completed" && prev.state1 === "completed") {
			setSensorResult("")
		}

		// Effect 2 (shout) completes - show checkmark (returns void)
		if (state.state2 === "completed" && prev.state2 !== "completed") {
			setResult2("✓")
		}
		if (state.state2 !== "completed" && prev.state2 === "completed") {
			setResult2("")
		}

		// Reset on hide (but keep isSafe for the program log later)
		if (!state.show && prev.show) {
			setSensorResult("")
			setResult2("")
		}

		prevStateRef.current = { ...state }
	}, [state])

	const isCollapsed = state.combined || state.showProgramNode

	// Build hierarchical tree: program is root, sensorData and shout are children
	const root = useMemo((): HierarchicalEffectNode => {
		return {
			id: "program",
			name: "program",
			...(isCollapsed && { visualState: state.programState }), // Derive from children when expanded
			result: "✓",
			showLog: state.showProgramLog,
			logMessage: isSafe ? "ALL CLEAR!" : "EVACUATE!",
			children: [
				{
					id: "sensorData",
					name: "sensorData",
					visualState: state.state1,
					...(sensorResult ? { result: sensorResult } : {}),
				},
				{
					id: "shout",
					name: "shout",
					visualState: state.state2,
					...(result2 ? { result: result2 } : {}),
					showLog: state.showLog2,
					logMessage: isSafe ? "ALL CLEAR!" : "EVACUATE!",
				},
			],
		}
	}, [
		state.state1,
		state.state2,
		state.programState,
		state.showLog2,
		state.showProgramLog,
		sensorResult,
		result2,
		isSafe,
		isCollapsed,
	])

	return (
		<motion.div
			className="w-full overflow-hidden"
			initial={{ height: 0 }}
			animate={{ height: state.show ? "auto" : 0 }}
			transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
		>
			<HierarchicalEffectRow root={root} collapsed={isCollapsed} showBorder={state.showContainer} gap={32} />
		</motion.div>
	)
}
