import { useMemo } from "react"
import type { SvgEffectNodeSpec } from "@/lib/hierarchy/types"
import type { StepDrivenComponentProps } from "./componentRegistry"
import { PixiEffectRow } from "./PixiEffectRow"
import { PixiEffectStage } from "./PixiEffectStage"

export interface StructuredConcurrencyDemoState {
	visible: boolean
	tree: "idle" | "running" | "completed" | "failed" | "interrupted"
	star: "idle" | "running" | "completed" | "failed" | "interrupted"
	beetle: "idle" | "running" | "completed" | "failed" | "interrupted"
}

/**
 * Step-driven component demonstrating Effect's structured concurrency.
 * Shows three effects running in parallel, with one failing and
 * the others being automatically interrupted.
 */
export function StructuredConcurrencyDemo({ state }: StepDrivenComponentProps<StructuredConcurrencyDemoState>) {
	const nodes = useMemo((): SvgEffectNodeSpec[] => {
		const starNode: SvgEffectNodeSpec = {
			id: "star",
			name: "star",
			visualState: state.star,
			hidden: !state.visible,
		}
		if (state.star === "failed") {
			starNode.error = "DoneGoneSupernova"
		}

		return [
			{
				id: "tree",
				name: "tree",
				visualState: state.tree,
				hidden: !state.visible,
			},
			starNode,
			{
				id: "beetle",
				name: "beetle",
				visualState: state.beetle,
				hidden: !state.visible,
			},
		]
	}, [state.visible, state.tree, state.star, state.beetle])

	return (
		<PixiEffectStage height={170} visible={state.visible}>
			{({ app, width }) => (
				<PixiEffectRow
					sharedApp={app}
					widthOverride={width}
					nodes={nodes}
					gap={32}
					paddingTop={40}
					stageTransform={{
						opacity: state.visible ? 1 : 0,
						scale: state.visible ? 1 : 0.9,
					}}
				/>
			)}
		</PixiEffectStage>
	)
}
