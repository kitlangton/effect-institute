import { useMemo } from "react"
import type { SvgEffectNodeSpec } from "@/lib/hierarchy/types"
import type { StepDrivenComponentProps } from "./componentRegistry"
import { PixiEffectRow } from "./PixiEffectRow"
import { PixiEffectStage } from "./PixiEffectStage"

export interface EffectFailDemoState {
	show: boolean
	mode: "sync" | "async"
	syncState: "idle" | "running" | "failed"
	asyncState: "idle" | "running" | "failed"
}

/**
 * Step-driven component demonstrating Effect.fail.
 * Uses PixiEffectRow for GPU-accelerated visualization.
 * Sound effects are handled by PixiEffectRow.
 */
export function EffectFailDemo({ state }: StepDrivenComponentProps<EffectFailDemoState>) {
	const nodes = useMemo((): SvgEffectNodeSpec[] => {
		if (!state.show) return []
		const name = state.mode === "sync" ? "boom" : "slowBoom"
		const visualState = state.mode === "sync" ? state.syncState : state.asyncState
		return [
			{
				id: "effect",
				name,
				visualState,
				error: "too chonky",
			},
		]
	}, [state.show, state.mode, state.syncState, state.asyncState])

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
