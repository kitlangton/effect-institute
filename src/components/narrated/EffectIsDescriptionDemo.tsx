import { useMemo } from "react"
import type { SvgEffectNodeSpec } from "@/lib/hierarchy/types"
import type { StepDrivenComponentProps } from "./componentRegistry"
import { PixiEffectRow } from "./PixiEffectRow"
import { PixiEffectStage } from "./PixiEffectStage"

export interface EffectIsDescriptionDemoState {
	show: boolean
	visualState: "idle" | "running" | "completed"
	result: string
}

/**
 * Step-driven component demonstrating that Effects are lazy descriptions.
 * Shows a single effect node that runs on explicit execution.
 */
export function EffectIsDescriptionDemo({ state }: StepDrivenComponentProps<EffectIsDescriptionDemoState>) {
	const nodes = useMemo((): SvgEffectNodeSpec[] => {
		if (!state.show) return []
		return [
			{
				id: "getTime",
				name: "getTime",
				visualState: state.visualState,
				result: state.result,
			},
		]
	}, [state.show, state.visualState, state.result])

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
