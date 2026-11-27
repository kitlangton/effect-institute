import { useMemo } from "react"
import type { SvgEffectNodeSpec } from "@/lib/hierarchy/types"
import type { StepDrivenComponentProps } from "./componentRegistry"
import { PixiEffectRow } from "./PixiEffectRow"
import { PixiEffectStage } from "./PixiEffectStage"

export interface EffectRunDemoState {
	mode: "sync" | "async"
	syncState: "idle" | "running" | "completed"
	asyncState: "idle" | "running" | "completed"
}

/**
 * Step-driven component demonstrating Effect.runSync and Effect.runPromise.
 * Uses PixiEffectRow for GPU-accelerated visualization.
 * Sound effects are handled by PixiEffectRow.
 */
export function EffectRunDemo({ state }: StepDrivenComponentProps<EffectRunDemoState>) {
	const nodes = useMemo((): SvgEffectNodeSpec[] => {
		const visualState = state.mode === "sync" ? state.syncState : state.asyncState
		const label = state.mode === "sync" ? "magicWord" : "asyncWord"

		return [
			{
				id: "effect",
				name: label,
				visualState,
				result: "pismire",
			},
		]
	}, [state.mode, state.syncState, state.asyncState])

	return (
		<PixiEffectStage height={170}>
			{({ app, width }) => <PixiEffectRow sharedApp={app} widthOverride={width} nodes={nodes} paddingTop={40} />}
		</PixiEffectStage>
	)
}
