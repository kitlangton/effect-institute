import { useAtomValue } from "@effect/atom-react"
import { useMemo } from "react"
import type { SectionData } from "@/atoms/narration"
import { createStepAtom } from "@/atoms/narration"
import { useAnimationSound } from "@/hooks/useAnimationSound"
import { NeoCodeBlock } from "@/lib/neo-code-block/view/NeoCodeBlock"

interface AnimatedCodeBlockProps {
	section: SectionData
	sectionIndex: number
}

/**
 * Renders a section's animated code using pre-compiled SlideshowData.
 * Step times are precomputed at build time when timings are available.
 */
export function AnimatedCodeBlock({ section, sectionIndex }: AnimatedCodeBlockProps) {
	const slideshowData = section.slideshowData

	// Use precomputed step times from build, or empty array (step 0 always)
	const stepTimes = section.stepTimes ?? []

	// Create step atom from precomputed times (uses per-section playback state)
	const stepAtom = useMemo(
		() => createStepAtom(section.id, sectionIndex, stepTimes),
		[section.id, sectionIndex, stepTimes],
	)
	const step = useAtomValue(stepAtom)

	// Sound hook
	const currentSound = slideshowData?.frames[step]?.sound
	useAnimationSound(step, currentSound)

	if (!slideshowData) {
		return null
	}

	return <NeoCodeBlock data={slideshowData} snapshot={step} className="w-full text-[10px] sm:text-sm" />
}
