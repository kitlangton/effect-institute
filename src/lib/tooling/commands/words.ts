/**
 * `narrate words` - list a section's words with indices and nth values.
 *
 * @module
 */
import { Console, Effect } from "effect"
import { Command } from "effect/cli"
import { CourseService } from "@/backend/services"
import { normalizeWord } from "@/lib/text"
import type { WordTiming } from "@/lib/tooling/types"
import { Args, chapterOpt } from "./shared"

const wordsSectionArg = Args.text({ name: "section" }).pipe(Args.withDescription("Section ID (e.g., section1)"))

/** One output row per word: index, word, nth occurrence, timing and flags. */
export function formatWordRows(wordTimings: readonly WordTiming[]): string[] {
	// Count occurrences of each normalized word to show nth values
	const wordCounts = new Map<string, number>()

	return wordTimings.map((w, i) => {
		const normalized = normalizeWord(w.word)
		const nth = (wordCounts.get(normalized) ?? 0) + 1
		wordCounts.set(normalized, nth)

		const styleStr = w.style ? ` (${Object.keys(w.style).join(", ")})` : ""
		const breakStr = w.paragraphBreak ? " ¶" : ""
		const listStr = w.listItem ? " •" : ""
		const nthStr = `#${nth}`

		return `${String(i).padStart(3)}: ${w.word.padEnd(20)} ${nthStr.padEnd(4)} ${w.start.toFixed(2)}s - ${w.end.toFixed(2)}s${styleStr}${breakStr}${listStr}`
	})
}

export const wordsCmd = Command.make("words", { section: wordsSectionArg, chapter: chapterOpt }, (args) =>
	Effect.gen(function* () {
		const courseService = yield* CourseService
		const section = yield* courseService.readSection(args.chapter, args.section)

		yield* Console.log(`\nWords in ${args.chapter}/${args.section} (${section.wordTimings.length} total):\n`)

		for (const row of formatWordRows(section.wordTimings)) {
			yield* Console.log(row)
		}
	}),
).pipe(Command.withDescription("List all words in a section with their indices and nth values"))
