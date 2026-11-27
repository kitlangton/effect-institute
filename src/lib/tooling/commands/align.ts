/**
 * `narrate align` - align a section's existing audio to its transcript (ElevenLabs forced alignment).
 *
 * @module
 */
import { Effect } from "effect"
import { Command } from "effect/cli"
import { Narration } from "@/authoring/server/Narration"
import { CourseService } from "@/backend/services"
import { jsonOpt, optionalSectionArg, printResult, reportFailure, selectSections } from "./narration-shared"
import { chapterOpt, Options } from "./shared"

const allOpt = Options.boolean("all").pipe(
	Options.withAlias("a"),
	Options.withDescription("Align every section in the chapter that has audio"),
	Options.withDefault(false),
)

export const alignCmd = Command.make(
	"align",
	{ section: optionalSectionArg, chapter: chapterOpt, all: allOpt, json: jsonOpt },
	(args) =>
		Effect.gen(function* () {
			const narration = yield* Narration
			const course = yield* CourseService
			const sections = yield* selectSections(
				course,
				narration,
				args.chapter,
				args.section,
				args.all,
				(hasAudio) => hasAudio,
			)
			for (const section of sections) {
				const result = yield* narration.align(args.chapter, section).pipe(reportFailure(args.json))
				yield* printResult(result, args.json)
			}
		}),
).pipe(Command.withDescription("Align existing audio to its transcript (needs ELEVENLABS_API_KEY)"))
