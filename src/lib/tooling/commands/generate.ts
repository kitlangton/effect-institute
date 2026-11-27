/**
 * `narrate generate` - generate narration and word timings with ElevenLabs text-to-speech.
 *
 * @module
 */
import { Effect, Option } from "effect"
import { Command } from "effect/cli"
import { Narration } from "@/authoring/server/Narration"
import { CourseService } from "@/backend/services"
import { jsonOpt, optionalSectionArg, printResult, reportFailure, selectSections } from "./narration-shared"
import { chapterOpt, Options } from "./shared"

const allOpt = Options.boolean("all").pipe(
	Options.withAlias("a"),
	Options.withDescription("Generate every section in the chapter that has no audio yet"),
	Options.withDefault(false),
)

const voiceOpt = Options.text("voice").pipe(
	Options.withDescription("ElevenLabs voice ID (default: ELEVENLABS_VOICE_ID)"),
	Options.optional,
)

const modelOpt = Options.text("model").pipe(
	Options.withDescription("ElevenLabs model ID (default: ELEVENLABS_MODEL_ID, else eleven_v4)"),
	Options.optional,
)

export const generateCmd = Command.make(
	"generate",
	{ section: optionalSectionArg, chapter: chapterOpt, all: allOpt, voice: voiceOpt, model: modelOpt, json: jsonOpt },
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
				(hasAudio) => !hasAudio,
			)
			const options = { voiceId: Option.getOrUndefined(args.voice), modelId: Option.getOrUndefined(args.model) }
			for (const section of sections) {
				const result = yield* narration.generate(args.chapter, section, options).pipe(reportFailure(args.json))
				yield* printResult(result, args.json)
			}
		}),
).pipe(
	Command.withDescription(
		"Generate narration with ElevenLabs (needs ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID or --voice). Replaces existing audio.",
	),
)
