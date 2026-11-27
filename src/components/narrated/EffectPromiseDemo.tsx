import { useEffect, useMemo, useRef, useState } from "react"
import type { SvgEffectNodeSpec } from "@/lib/hierarchy/types"
import type { StepDrivenComponentProps } from "./componentRegistry"
import { PixiEffectRow } from "./PixiEffectRow"
import { PixiEffectStage } from "./PixiEffectStage"

export interface EffectPromiseDemoState {
	show: boolean
	state: "idle" | "running" | "completed"
}

function formatSensorReading(): string {
	// Deadly radiation level - this is why you check fresh readings!
	const reading = (Math.random() * 200 + 800).toFixed(0)
	return `{ mSv: ${reading} }`
}

/**
 * Step-driven component demonstrating Effect.promise.
 * Shows a single effect node that runs and completes with a fresh sensor reading.
 */
export function EffectPromiseDemo({ state }: StepDrivenComponentProps<EffectPromiseDemoState>) {
	const [result, setResult] = useState<string>("")
	const prevStateRef = useRef<EffectPromiseDemoState>({ show: false, state: "idle" })

	useEffect(() => {
		const prev = prevStateRef.current

		// Rising edge: state becomes completed
		if (state.state === "completed" && prev.state !== "completed") {
			setResult(formatSensorReading())
		}

		// Falling edge: state was completed, now isn't (seek backwards)
		if (state.state !== "completed" && prev.state === "completed") {
			setResult("")
		}

		// Falling edge: show true→false (node hidden)
		if (!state.show && prev.show) {
			setResult("")
		}

		prevStateRef.current = { ...state }
	}, [state])

	const nodes = useMemo((): SvgEffectNodeSpec[] => {
		if (!state.show) return []
		return [
			{
				id: "sensorData",
				name: "sensorData",
				visualState: state.state,
				result,
			},
		]
	}, [state.show, state.state, result])

	return (
		<PixiEffectStage height={170} visible={state.show}>
			{({ app, width }) => (
				<PixiEffectRow
					sharedApp={app}
					widthOverride={width}
					nodes={nodes}
					paddingTop={40}
					stageTransform={{
						opacity: state.show ? 1 : 0,
						scale: state.show ? 1 : 0.9,
					}}
				/>
			)}
		</PixiEffectStage>
	)
}
