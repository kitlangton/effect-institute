/**
 * `narrate build` - build course JSON from DSL definitions.
 *
 * @module
 */
import { Console, Effect, Option } from "effect"
import { Command } from "effect/cli"
import { CourseService } from "@/backend/services"
import { Args, Options } from "./shared"

const buildChapterArg = Args.text({ name: "chapter" }).pipe(
	Args.withDescription("Chapter ID to build (omit to build all)"),
	Args.optional,
)

const buildPublishedOpt = Options.boolean("published").pipe(
	Options.withDescription("Emit production artifacts without draft chapters or groups"),
	Options.withDefault(false),
)

export const buildCmd = Command.make("build", { chapter: buildChapterArg, published: buildPublishedOpt }, (args) =>
	Effect.gen(function* () {
		const courseService = yield* CourseService

		const chapterFilter = Option.getOrUndefined(args.chapter)

		if (chapterFilter) {
			yield* Console.log(`Building chapter: ${chapterFilter}`)
		} else {
			yield* Console.log("Building all chapters...")
		}

		yield* courseService.build(chapterFilter, { includeDrafts: !args.published })

		yield* Console.log("Build complete!")
	}),
).pipe(Command.withDescription("Build course JSON from DSL definitions"))
