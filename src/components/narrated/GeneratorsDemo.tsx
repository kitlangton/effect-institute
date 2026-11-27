import { MotionConfig, motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import type { StepDrivenComponentProps } from "./componentRegistry"
import { StaticEffectNode } from "./StaticEffectNode"

export interface GeneratorsDemoState {
	visible?: boolean
	sensor: "idle" | "running" | "completed"
	bio: "idle" | "running" | "completed"
	analyze: "idle" | "running" | "completed"
}

/**
 * Demonstrates sequential effect execution in Effect.gen.
 * Shows three effects side by side: sensorData, biometrics, analyze.
 * All three are always visible; rightmost ones start inert (idle).
 */
export function GeneratorsDemo({ state }: StepDrivenComponentProps<GeneratorsDemoState>) {
	const [result1, setResult1] = useState<string>("")
	const [result2, setResult2] = useState<string>("")
	const [result3, setResult3] = useState<string>("")

	const prevStateRef = useRef<GeneratorsDemoState>({
		sensor: "idle",
		bio: "idle",
		analyze: "idle",
	})

	useEffect(() => {
		const prev = prevStateRef.current

		// Sensor completes
		if (state.sensor === "completed" && prev.sensor !== "completed") {
			setResult1("{ mSv: 0.3 }")
		}

		// Bio completes
		if (state.bio === "completed" && prev.bio !== "completed") {
			setResult2("{ pulse: 72 }")
		}

		// Analyze completes
		if (state.analyze === "completed" && prev.analyze !== "completed") {
			setResult3("✓")
		}

		// Reset on idle
		if (state.sensor === "idle" && prev.sensor !== "idle") setResult1("")
		if (state.bio === "idle" && prev.bio !== "idle") setResult2("")
		if (state.analyze === "idle" && prev.analyze !== "idle") setResult3("")

		prevStateRef.current = { ...state }
	}, [state])

	// Show the whole component when explicitly visible OR when any effect is not idle
	const isVisible =
		state.visible === true || state.sensor !== "idle" || state.bio !== "idle" || state.analyze !== "idle"

	return (
		<MotionConfig transition={{ type: "spring", visualDuration: 0.3, bounce: 0 }}>
			<motion.div
				initial={false}
				animate={{
					height: isVisible ? "auto" : 0,
					opacity: isVisible ? 1 : 0,
				}}
				className="overflow-visible"
			>
				<div className="flex items-start justify-center gap-6 py-6 pt-12 overflow-visible">
					<StaticEffectNode name="sensorData" visualState={state.sensor} result={result1} />
					<StaticEffectNode name="biometrics" visualState={state.bio} result={result2} />
					<StaticEffectNode name="analyze" visualState={state.analyze} result={result3} />
				</div>
			</motion.div>
		</MotionConfig>
	)
}
