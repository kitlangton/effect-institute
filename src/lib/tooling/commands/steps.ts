/**
 * `narrate steps` - preview animation steps (code + component) in trigger order.
 *
 * @module
 */
import { Console, Effect } from "effect"
import { Command } from "effect/cli"
import { CourseService, type StepPreview } from "@/backend/services"
import { findStepWordIndex } from "@/lib/content/resolve-steps"
import { Args, chapterOpt } from "./shared"
import { componentStateSummary, formatCodeStepBody, STEPS_LEGEND, transcriptContext } from "./steps-format"

const stepsSectionArg = Args.text({ name: "section" }).pipe(Args.withDescription("Section ID (e.g., catching-errors)"))

interface UnifiedStep {
	type: "code" | "component"
	/** Transcript word the step fires on (-1 = start or not found) */
	wordIndex: number
	triggerWord: string
	nth?: number
	after?: string
	codePreview?: StepPreview
	componentStep?: { index: number; name: string; snapshot: Record<string, unknown> }
}

export const stepsCmd = Command.make("steps", { section: stepsSectionArg, chapter: chapterOpt }, (args) =>
	Effect.gen(function* () {
		const courseService = yield* CourseService

		// Load section data for transcript context
		const section = yield* courseService.readSection(args.chapter, args.section)
		const words = section.wordTimings.map((w) => w.word)

		// Same word lookup playback uses to time steps
		const findWordIndex = (word: string, opts: { nth?: number | undefined; after?: string | undefined }): number =>
			word === "start" ? -1 : (findStepWordIndex({ word, ...opts }, section.wordTimings) ?? -1)

		// Check for stability issues first
		const warnings = yield* courseService
			.checkStability(args.chapter, args.section)
			.pipe(Effect.mapError((e) => new Error(e.message)))

		if (warnings.length > 0) {
			yield* Console.log("\n⚠️  STABILITY WARNINGS:")
			for (const warning of warnings) {
				yield* Console.log(`   Slot "${warning.slotName}" has common text across all values:`)
				yield* Console.log(`     "${warning.commonText}"`)
				yield* Console.log(`   → Extract this text outside the slot for better animation stability\n`)
			}
		}

		const previews = yield* courseService
			.previewSteps(args.chapter, args.section)
			.pipe(Effect.mapError((e) => new Error(e.message)))

		const ref = (step: { nth?: number | undefined; after?: string | undefined }) => ({
			...(step.nth !== undefined ? { nth: step.nth } : {}),
			...(step.after !== undefined ? { after: step.after } : {}),
		})

		const unifiedSteps: UnifiedStep[] = previews.map((preview) => ({
			type: "code",
			wordIndex: findWordIndex(preview.triggerWord, preview),
			triggerWord: preview.triggerWord,
			codePreview: preview,
			...ref(preview),
		}))

		const cf = section.componentFlow
		if (cf) {
			cf.steps.forEach((step, i) => {
				unifiedSteps.push({
					type: "component",
					wordIndex: findWordIndex(step.at, step),
					triggerWord: step.at,
					componentStep: { index: i, name: step.name ?? cf.name, snapshot: cf.snapshots[i]?.state ?? {} },
					...ref(step),
				})
			})
		}

		// Sort by word index (start steps at -1 come first); stable, so code precedes component on ties
		unifiedSteps.sort((a, b) => a.wordIndex - b.wordIndex)

		const componentName = cf?.name ?? ""

		yield* Console.log(`\nAnimation steps for ${args.chapter}/${args.section}:`)
		yield* Console.log(
			`  Code: ${previews.length} steps${cf ? ` | Component (${componentName}): ${cf.steps.length} steps` : ""}`,
		)
		yield* Console.log(`  (Showing interleaved by trigger order)`)
		yield* Console.log(`  Legend: ${STEPS_LEGEND}\n`)

		let prevSlots: Record<string, string> = {}
		let prevState: Record<string, unknown> = {}

		for (const step of unifiedSteps) {
			const contextStr = transcriptContext(words, step.wordIndex, step.triggerWord)
			const nthStr = step.nth ? ` nth=${step.nth}` : ""
			const afterStr = step.after ? ` after="${step.after}"` : ""

			if (step.type === "code" && step.codePreview) {
				const preview = step.codePreview
				yield* Console.log("─".repeat(60))
				yield* Console.log(
					`[CODE] Step ${preview.index}: "${preview.name}" (on: ${preview.triggerWord}${nthStr}${afterStr})`,
				)
				yield* Console.log(`Transcript: ${contextStr}`)
				for (const line of formatCodeStepBody(preview, prevSlots)) {
					yield* Console.log(line)
				}
				prevSlots = preview.slots
			} else if (step.type === "component" && step.componentStep) {
				const { index, name, snapshot } = step.componentStep
				yield* Console.log("─".repeat(60))
				yield* Console.log(
					`[${componentName.toUpperCase()}] Step ${index}: "${name}" (on: ${step.triggerWord}${nthStr}${afterStr})`,
				)
				yield* Console.log(`Transcript: ${contextStr}`)
				const state = componentStateSummary(index, snapshot, prevState)
				if (state) yield* Console.log(state)
				prevState = snapshot
			}

			yield* Console.log("")
		}
	}),
).pipe(Command.withDescription("Preview animation steps for debugging (interleaved code + component steps)"))
