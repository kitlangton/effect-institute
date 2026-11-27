import { useAtomValue } from "@effect/atom-react"
import { motion } from "motion/react"
import { useMemo } from "react"
import type { SectionData } from "@/atoms/narration"
import { createStepAtom } from "@/atoms/narration"
import { AnimatedCodeBlock } from "@/components/narrated/AnimatedCodeBlock"
import { StepDrivenComponent } from "@/components/narrated/StepDrivenComponent"
import { useAnimationSound } from "@/lib/animated-code/animation/useAnimationSound"
import type { ComponentFlowData } from "@/lib/tooling/types"

interface CodePanelContentProps {
	section: SectionData
	sectionIndex: number
}

export function CodePanelContent({ section, sectionIndex }: CodePanelContentProps) {
	// Check for code content OR slideshow animation data (code might start empty but animate in)
	const hasCode = (section.code && section.code.trim().length > 0) || !!section.slideshowData
	const hasStepDrivenComponent = !!section.componentFlow

	// Step-driven component with code: show both (component above code)
	if (hasStepDrivenComponent && hasCode) {
		return (
			<div className="flex flex-col gap-6 w-full">
				<StepDrivenComponentWrapper
					section={section}
					sectionIndex={sectionIndex}
					componentFlow={section.componentFlow as ComponentFlowData}
				/>
				<motion.div
					key={`${section.id}-code`}
					initial={{ opacity: 0, filter: "blur(4px)" }}
					animate={{ opacity: 1, filter: "blur(0px)" }}
					exit={{ opacity: 0, filter: "blur(4px)" }}
					transition={{ duration: 0.3 }}
					className="w-full max-w-full px-2 sm:px-8"
				>
					<AnimatedCodeBlock section={section} sectionIndex={sectionIndex} />
				</motion.div>
			</div>
		)
	}

	// Step-driven component only (no code)
	if (hasStepDrivenComponent) {
		return (
			<StepDrivenComponentWrapper
				section={section}
				sectionIndex={sectionIndex}
				componentFlow={section.componentFlow as ComponentFlowData}
			/>
		)
	}

	// Default: animated code block only
	return (
		<motion.div
			key={section.id}
			initial={{ opacity: 0, filter: "blur(4px)" }}
			animate={{ opacity: 1, filter: "blur(0px)" }}
			exit={{ opacity: 0, filter: "blur(4px)" }}
			transition={{ duration: 0.3 }}
			className="w-full max-w-full px-2 sm:px-8"
		>
			<AnimatedCodeBlock section={section} sectionIndex={sectionIndex} />
		</motion.div>
	)
}

/** Wrapper for step-driven components. Uses precomputed step times. */
function StepDrivenComponentWrapper({
	section,
	sectionIndex,
	componentFlow,
}: {
	section: SectionData
	sectionIndex: number
	componentFlow: ComponentFlowData
}) {
	// Use component-specific step times, falling back to code step times for backwards compat
	const stepTimes = section.componentStepTimes ?? section.stepTimes ?? []

	// Create step atom (uses per-section playback state)
	const stepAtom = useMemo(
		() => createStepAtom(section.id, sectionIndex, stepTimes),
		[section.id, sectionIndex, stepTimes],
	)
	const step = useAtomValue(stepAtom)

	// Get sound from current snapshot and play on step change
	const currentSnapshot = componentFlow.snapshots[step] as Record<string, unknown> | undefined
	const currentSound = currentSnapshot?._sound as string | undefined
	useAnimationSound(step, currentSound)

	return (
		<div className="w-full px-2 sm:px-8">
			<StepDrivenComponent componentFlow={componentFlow} step={step} />
		</div>
	)
}
