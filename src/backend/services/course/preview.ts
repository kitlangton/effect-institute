/**
 * Debug views of a section's code animation: rendered steps and slot stability warnings.
 */

import { Effect } from "effect"
import { type Animation, analyzeStability } from "@/lib/animated-code/animation"
import { previewSteps as previewAnimationSteps, type StepPreview } from "@/lib/animated-code/animation/preview"
import { isAnimatedCodeFlow } from "@/lib/content/dsl"
import type { Loader } from "./loader"

export const makePreview = (loader: Loader) => {
	/** What code renders at each animation step. Static code is a single "static" step. */
	const previewSteps = Effect.fn("CourseService.previewSteps")(function* (chapterId: string, sectionId: string) {
		const section = yield* loader.getSection(chapterId, sectionId)

		if (!section.code || typeof section.code === "string" || !isAnimatedCodeFlow(section.code)) {
			const code = typeof section.code === "string" ? section.code : ""
			return [
				{
					index: 0,
					name: "static",
					triggerWord: "start",
					lines: code.split("\n").map((text, i) => ({ id: `line-${i + 1}`, text, runs: [{ text }] })),
					slots: {},
					annotations: [],
				},
			] satisfies StepPreview[]
		}

		const { animation, base, flow } = section.code
		return previewAnimationSteps(animation as Animation, base, [...flow])
	})

	/** Warnings for slots whose common text should be extracted. Static code has none. */
	const checkStability = Effect.fn("CourseService.checkStability")(function* (chapterId: string, sectionId: string) {
		const section = yield* loader.getSection(chapterId, sectionId)
		if (!section.code || typeof section.code === "string" || !("animation" in section.code)) {
			return []
		}
		return analyzeStability(section.code.animation as Animation)
	})

	return { previewSteps, checkStability }
}
