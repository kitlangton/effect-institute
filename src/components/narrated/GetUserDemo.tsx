import { useEffect, useMemo, useRef, useState } from "react"
import type { SvgEffectNodeSpec } from "@/lib/hierarchy/types"
import type { StepDrivenComponentProps } from "./componentRegistry"
import { PixiEffectRow } from "./PixiEffectRow"
import { PixiEffectStage } from "./PixiEffectStage"

export interface GetUserDemoState {
	visible?: boolean
	askName: "idle" | "running" | "completed"
	askAge: "idle" | "running" | "completed"
	getUser: "idle" | "running" | "completed"
}

/**
 * Demonstrates Effect.gen composition with askName, askAge -> getUser.
 * All three nodes horizontally: askName, askAge, arrow, getUser.
 * getUser runs the whole time while askName and askAge complete sequentially.
 */
export function GetUserDemo({ state }: StepDrivenComponentProps<GetUserDemoState>) {
	const [result1, setResult1] = useState<string>("")
	const [result2, setResult2] = useState<string>("")
	const [result3, setResult3] = useState<string>("")

	const prevStateRef = useRef<GetUserDemoState>({
		askName: "idle",
		askAge: "idle",
		getUser: "idle",
	})

	useEffect(() => {
		const prev = prevStateRef.current

		// askName completes
		if (state.askName === "completed" && prev.askName !== "completed") {
			setResult1('"Olive"')
		}

		// askAge completes
		if (state.askAge === "completed" && prev.askAge !== "completed") {
			setResult2("37")
		}

		// getUser completes
		if (state.getUser === "completed" && prev.getUser !== "completed") {
			setResult3('{ name: "Olive", age: 37 }')
		}

		// Reset on idle
		if (state.askName === "idle" && prev.askName !== "idle") setResult1("")
		if (state.askAge === "idle" && prev.askAge !== "idle") setResult2("")
		if (state.getUser === "idle" && prev.getUser !== "idle") setResult3("")

		prevStateRef.current = { ...state }
	}, [state])

	const isVisible = state.visible === true

	const nodes = useMemo((): SvgEffectNodeSpec[] => {
		if (!isVisible) return []
		return [
			{
				id: "askName",
				name: "askName",
				visualState: state.askName,
				result: result1,
			},
			{
				id: "askAge",
				name: "askAge",
				visualState: state.askAge,
				result: result2,
			},
			{
				id: "getUser",
				name: "getUser",
				visualState: state.getUser,
				result: result3,
			},
		]
	}, [isVisible, state.askName, state.askAge, state.getUser, result1, result2, result3])

	return (
		<PixiEffectStage height={170} visible={isVisible}>
			{({ app, width }) => (
				<PixiEffectRow
					sharedApp={app}
					widthOverride={width}
					nodes={nodes}
					gap={24}
					paddingTop={40}
					arrows={[{ afterIndex: 1 }]}
					stageTransform={{
						opacity: isVisible ? 1 : 0,
						scale: isVisible ? 1 : 0.9,
					}}
				/>
			)}
		</PixiEffectStage>
	)
}
