/**
 * Output helpers shared by the narration commands (record, align, generate).
 *
 * With --json, the last stdout line is the result as JSON; the dev server's recording bar reads it.
 *
 * @module
 */
import { Console, Effect, FileSystem, Option } from "effect"
import type { Narration, NarrationError, NarrationResult } from "@/authoring/server/Narration"
import type { CourseService } from "@/backend/services"
import { Args, Options } from "./shared"

export const jsonOpt = Options.boolean("json").pipe(
	Options.withDescription("Print the result as one JSON line (used by the dev server)"),
	Options.withDefault(false),
)

export const optionalSectionArg = Args.text({ name: "section" }).pipe(
	Args.withDescription("Section ID (omit when using --all)"),
	Args.optional,
)

const sourceLabel = { aligned: "aligned", generated: "from ElevenLabs", estimated: "estimated (not aligned)" } as const

export const printResult = (result: NarrationResult, json: boolean) =>
	Effect.gen(function* () {
		if (json) return yield* Console.log(JSON.stringify({ ok: true, result }))
		const length = result.durationSeconds === undefined ? "" : ` (${result.durationSeconds.toFixed(1)}s)`
		yield* Console.log(`\n✓ ${result.chapter}/${result.section}`)
		yield* Console.log(`  audio    ${result.audioPath}${length}`)
		yield* Console.log(
			`  timings  ${result.timingsPath}, ${result.wordCount} words, ${sourceLabel[result.timingsSource]}`,
		)
		if (result.coverage !== undefined) {
			yield* Console.log(`  matched  ${Math.round(result.coverage * 100)}% of words directly`)
		}
		if (result.takePath) yield* Console.log(`  take     ${result.takePath}`)
		if (result.notice) yield* Console.log(`\n! ${result.notice}`)
	})

/** In --json mode, report a failure as a JSON line before failing the command. */
export const reportFailure =
	(json: boolean) =>
	<A, R>(effect: Effect.Effect<A, NarrationError, R>) =>
		json ? effect.pipe(Effect.tapError((e) => Console.log(JSON.stringify({ ok: false, error: e.message })))) : effect

/**
 * Resolve which sections a command runs on: the one named, or with --all every section in the chapter
 * that passes the filter (given whether the section has audio).
 */
export const selectSections = (
	course: CourseService["Service"],
	narration: Narration["Service"],
	chapter: string,
	section: Option.Option<string>,
	all: boolean,
	include: (hasAudio: boolean) => boolean,
) =>
	Effect.gen(function* () {
		if (Option.isSome(section)) return [section.value]
		if (!all) return yield* Effect.fail(new Error("Pass a section ID, or --all for the whole chapter"))
		const fs = yield* FileSystem.FileSystem
		const ids = yield* course.listSections(chapter)
		const selected: string[] = []
		for (const id of ids) {
			if (include(yield* fs.exists(narration.paths(chapter, id).audio))) selected.push(id)
		}
		return selected
	})
