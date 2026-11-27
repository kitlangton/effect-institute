/**
 * `narrate record` - record narration in the browser, or process an audio file you already have.
 *
 * @module
 */
import { Console, Effect, Option } from "effect"
import { Command } from "effect/cli"
import { Narration } from "@/authoring/server/Narration"
import { jsonOpt, printResult, reportFailure } from "./narration-shared"
import { Args, chapterOpt, Options } from "./shared"

const sectionArg = Args.text({ name: "section" }).pipe(Args.withDescription("Section ID"))

const fileOpt = Options.text("file").pipe(
	Options.withAlias("f"),
	Options.withDescription("Process this audio file (any format ffmpeg reads) as the section's narration"),
	Options.optional,
)

const portOpt = Options.text("port").pipe(
	Options.withDescription("Dev server port shown in the instructions"),
	Options.withDefault("3210"),
)

export const recordCmd = Command.make(
	"record",
	{ section: sectionArg, chapter: chapterOpt, file: fileOpt, port: portOpt, json: jsonOpt },
	(args) =>
		Effect.gen(function* () {
			if (Option.isSome(args.file)) {
				const narration = yield* Narration
				const result = yield* narration
					.record(args.chapter, args.section, args.file.value)
					.pipe(reportFailure(args.json))
				return yield* printResult(result, args.json)
			}

			const url = `http://localhost:${args.port}/chapters/${args.chapter}?section=${args.section}`
			yield* Console.log(
				[
					"",
					"Record in the browser (needs ffmpeg; an ElevenLabs key is optional):",
					"",
					"  1. bun dev",
					`  2. open ${url}`,
					"  3. Ctrl+R   start recording (press again to restart)",
					"     Enter    stop, process and save",
					"     Esc      discard the take",
					"     Ctrl+D   debug mode: pick and reuse an earlier take",
					"",
					`Raw takes are kept in recordings/${args.chapter}/${args.section}/ (gitignored).`,
					`The processed audio is written to assets/audio/${args.chapter}/${args.section}.webm.`,
					"Without ELEVENLABS_API_KEY the word timings are estimated; run bun narrate align later.",
					"",
					`Already have audio? bun narrate record -c ${args.chapter} ${args.section} --file path/to/take.wav`,
				].join("\n"),
			)
		}),
).pipe(Command.withDescription("Record narration in the browser, or process an existing audio file with --file"))
