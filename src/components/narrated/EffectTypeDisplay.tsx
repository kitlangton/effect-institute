import { AnimatePresence, motion } from "motion/react"
import { useMemo } from "react"
import { springConfigs } from "../../utils/animationConfigs"
import type { TypeSegment } from "../AnimatedType"
import { TypeBox } from "../TypeBox"
import type { StepDrivenComponentProps } from "./componentRegistry"

export interface EffectTypeState {
	showSuccess: boolean
	showError: boolean
	showRequirements: boolean
}

const COLORS = {
	bracket: "#e4e4e7", // neutral-200
	success: "#4ade80", // green-400
	error: "#f87171", // red-400
	requirements: "#60a5fa", // blue-400
	comma: "#a1a1aa", // neutral-400
	label: "#71717a", // neutral-500
}

const springConfig = springConfigs.smooth

export function EffectTypeDisplay({ state }: StepDrivenComponentProps<EffectTypeState>) {
	const { showSuccess, showError, showRequirements } = state

	const segments = useMemo(() => {
		const result: TypeSegment[] = [
			{ id: "effect", content: "Effect", color: COLORS.bracket },
			{ id: "open", content: "<", color: COLORS.bracket },
		]

		if (showSuccess) {
			result.push({ id: "success", content: "User", color: COLORS.success })
		} else {
			result.push({ id: "success-placeholder", content: "?", color: COLORS.label, isEllipsis: false })
		}

		if (showError) {
			result.push({ id: "comma1", content: ", ", color: COLORS.comma })
			result.push({ id: "error", content: "NotFound", color: COLORS.error })
		}

		if (showRequirements) {
			result.push({ id: "comma2", content: ", ", color: COLORS.comma })
			result.push({ id: "requirements", content: "Database", color: COLORS.requirements })
		}

		result.push({ id: "close", content: ">", color: COLORS.bracket })

		return result
	}, [showSuccess, showError, showRequirements])

	const triggerKey = `${showSuccess}-${showError}-${showRequirements}`

	return (
		<div className="flex flex-col items-center gap-6 py-8">
			<TypeBox segments={segments} triggerKey={triggerKey} borderColor="rgba(255,255,255,0.15)" />

			{/* Labels container - fixed height */}
			<div className="h-12 flex items-center justify-center">
				<div className="flex items-center justify-center text-sm font-mono">
					<AnimatePresence mode="sync" initial={false}>
						{showSuccess && (
							<motion.div
								key="success-label"
								initial={{ filter: "blur(4px)", width: 0 }}
								animate={{ filter: "blur(0px)", width: "auto", transition: springConfig }}
								exit={{ filter: "blur(4px)", width: 0, transition: { ...springConfig, visualDuration: 0.2 } }}
								className="flex flex-col items-center gap-1 overflow-x-clip"
							>
								<div className="flex flex-col items-center gap-1 px-4">
									<div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.success }} />
									<span style={{ color: COLORS.success }}>success</span>
								</div>
							</motion.div>
						)}
						{showError && (
							<motion.div
								key="error-label"
								initial={{ filter: "blur(4px)", width: 0 }}
								animate={{ filter: "blur(0px)", width: "auto", transition: springConfig }}
								exit={{ filter: "blur(4px)", width: 0, transition: { ...springConfig, visualDuration: 0.2 } }}
								className="flex flex-col items-center gap-1 overflow-x-clip"
							>
								<div className="flex flex-col items-center gap-1 px-4">
									<div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.error }} />
									<span style={{ color: COLORS.error }}>error</span>
								</div>
							</motion.div>
						)}
						{showRequirements && (
							<motion.div
								key="requirements-label"
								initial={{ filter: "blur(4px)", width: 0 }}
								animate={{ filter: "blur(0px)", width: "auto", transition: springConfig }}
								exit={{ filter: "blur(4px)", width: 0, transition: { ...springConfig, visualDuration: 0.2 } }}
								className="flex flex-col items-center gap-1 overflow-x-clip"
							>
								<div className="flex flex-col items-center gap-1 px-4">
									<div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.requirements }} />
									<span style={{ color: COLORS.requirements }}>requirements</span>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
		</div>
	)
}
