import { MotionConfig, motion } from "motion/react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { SvgEffectNodeSpec } from "@/lib/hierarchy/types"
import { appSounds } from "@/sounds/AppSounds"
import type { StepDrivenComponentProps } from "./componentRegistry"
import { Key } from "./Key"
import { PixiEffectRow } from "./PixiEffectRow"
import { PixiEffectStage } from "./PixiEffectStage"

export interface ErrorShortCircuitDemoState {
	visible?: boolean
	mode: "success" | "fail-name" | "fail-age"
	askName: "idle" | "running" | "completed" | "failed"
	askAge: "idle" | "running" | "completed" | "failed"
	getUser: "idle" | "running" | "completed" | "failed"
	// Text input stage
	inputVisible?: boolean
	typedText?: string
	enterPressed?: boolean
	inputShake?: boolean
	inputError?: boolean
}

const SMOOTH_SPRING = {
	type: "spring" as const,
	visualDuration: 0.4,
	bounce: 0.1,
}

/**
 * Demonstrates error short-circuiting in Effect.gen.
 * Shows askName and askAge feeding into getUser, with failure scenarios.
 * Also includes a text input visualization for the "banana" typing scenario.
 */
export function ErrorShortCircuitDemo({ state }: StepDrivenComponentProps<ErrorShortCircuitDemoState>) {
	const [result1, setResult1] = useState<string>("")
	const [result2, setResult2] = useState<string>("")
	const [result3, setResult3] = useState<string>("")
	const [error1, setError1] = useState<string>("")
	const [error2, setError2] = useState<string>("")
	const [error3, setError3] = useState<string>("")

	const prevStateRef = useRef<ErrorShortCircuitDemoState>({
		mode: "success",
		askName: "idle",
		askAge: "idle",
		getUser: "idle",
	})
	const prevTypedLengthRef = useRef(0)
	const prevEnterPressedRef = useRef(false)

	useEffect(() => {
		const prev = prevStateRef.current

		// Handle askName transitions
		if (state.askName === "completed" && prev.askName !== "completed") {
			setResult1('"Olive"')
			setError1("")
		}
		if (state.askName === "failed" && prev.askName !== "failed") {
			setError1("NoSams")
			setResult1("")
		}
		if (state.askName === "idle" && prev.askName !== "idle") {
			setResult1("")
			setError1("")
		}

		// Handle askAge transitions
		if (state.askAge === "completed" && prev.askAge !== "completed") {
			setResult2("37")
			setError2("")
		}
		if (state.askAge === "failed" && prev.askAge !== "failed") {
			setError2("BadNumber")
			setResult2("")
		}
		if (state.askAge === "idle" && prev.askAge !== "idle") {
			setResult2("")
			setError2("")
		}

		// Handle getUser transitions
		if (state.getUser === "completed" && prev.getUser !== "completed") {
			setResult3('{ name: "Olive", age: 37 }')
			setError3("")
		}
		if (state.getUser === "failed" && prev.getUser !== "failed") {
			// Show which error propagated
			setError3(state.mode === "fail-name" ? "NoSams" : "BadNumber")
			setResult3("")
		}
		if (state.getUser === "idle" && prev.getUser !== "idle") {
			setResult3("")
			setError3("")
		}

		prevStateRef.current = { ...state }
	}, [state])

	// Play key sound on each new character typed
	const typedText = state.typedText ?? ""
	useEffect(() => {
		const prevLength = prevTypedLengthRef.current
		prevTypedLengthRef.current = typedText.length

		if (typedText.length > prevLength) {
			appSounds.playKeyPress()
		}
	}, [typedText])

	// Play key sound when Enter is pressed
	const enterPressed = state.enterPressed ?? false
	useEffect(() => {
		const prev = prevEnterPressedRef.current
		prevEnterPressedRef.current = enterPressed

		if (enterPressed && !prev) {
			appSounds.playKeyPress()
		}
	}, [enterPressed])

	const isVisible = state.visible === true
	const inputVisible = state.inputVisible === true
	const inputShake = state.inputShake === true
	const inputError = state.inputError === true

	// Play fail sound when error appears
	const prevInputErrorRef = useRef(false)
	useEffect(() => {
		const prev = prevInputErrorRef.current
		prevInputErrorRef.current = inputError

		if (inputError && !prev) {
			appSounds.playFail()
		}
	}, [inputError])

	const nodes = useMemo((): SvgEffectNodeSpec[] => {
		if (!isVisible) return []
		return [
			{
				id: "askName",
				name: "askName",
				visualState: state.askName,
				result: result1,
				error: error1,
			},
			{
				id: "askAge",
				name: "askAge",
				visualState: state.askAge,
				result: result2,
				error: error2,
			},
			{
				id: "getUser",
				name: "getUser",
				visualState: state.getUser,
				result: result3,
				error: error3,
			},
		]
	}, [isVisible, state.askName, state.askAge, state.getUser, result1, result2, result3, error1, error2, error3])

	return (
		<MotionConfig transition={{ type: "spring", visualDuration: 0.3, bounce: 0 }}>
			{/* Text Input Visualization (banana typing) */}
			<motion.div
				initial={false}
				animate={{
					height: inputVisible ? "auto" : 0,
					opacity: inputVisible ? 1 : 0,
				}}
				transition={SMOOTH_SPRING}
				className="overflow-hidden"
			>
				<div className="flex items-center justify-center gap-6 py-4">
					{/* Input field with label */}
					<motion.div
						className="relative"
						animate={{
							x: inputShake ? [0, -4, 4, -4, 4, 0] : 0,
						}}
						transition={{ duration: 0.3 }}
					>
						{/* Error message - positioned above */}
						<motion.div
							initial={false}
							animate={{ opacity: inputError ? 1 : 0 }}
							transition={SMOOTH_SPRING}
							className="absolute -top-5 left-0 right-0 text-center text-xs text-red-400 font-medium"
						>
							What are you doing?
						</motion.div>
						<div className="flex items-center gap-2">
							<span className="text-sm text-white/60 font-mono">Age:</span>
							<motion.div
								className="border px-3 py-1.5 min-w-[120px] font-mono text-sm"
								animate={{
									borderColor: inputError ? "rgba(239, 68, 68, 0.7)" : "rgba(255, 255, 255, 0.2)",
									backgroundColor: inputError ? "rgba(239, 68, 68, 0.1)" : "rgba(255, 255, 255, 0.05)",
								}}
								transition={SMOOTH_SPRING}
							>
								<span className="text-white/90">{typedText}</span>
								<motion.span
									className="inline-block w-[2px] h-[14px] bg-white/60 ml-[1px] align-middle"
									animate={{ opacity: [1, 1, 0, 0] }}
									transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
								/>
							</motion.div>
						</div>
					</motion.div>

					{/* Enter key */}
					<Key pressed={enterPressed} width={70} size="sm">
						Enter
					</Key>
				</div>
			</motion.div>

			{/* Effect Nodes Visualization */}
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
		</MotionConfig>
	)
}
