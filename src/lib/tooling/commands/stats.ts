/**
 * `narrate stats` - show statistics for sections in a chapter.
 *
 * @module
 */
import { Console, Effect } from "effect"
import { Command } from "effect/cli"
import { CourseService } from "@/backend/services"
import { chapterOpt, Options } from "./shared"

const statsAllOpt = Options.boolean("all").pipe(
	Options.withAlias("a"),
	Options.withDescription("Show stats for all chapters"),
	Options.withDefault(false),
)

const statsSortOpt = Options.text("sort").pipe(
	Options.withAlias("s"),
	Options.withDescription("Sort by: words, duration, paragraphs, id (default: id)"),
	Options.withDefault("id"),
)

interface SectionStats {
	id: string
	chapter: string
	words: number
	paragraphs: number
	duration: number
	hasAnimation: boolean
	hasAudio: boolean
}

export const statsCmd = Command.make("stats", { chapter: chapterOpt, all: statsAllOpt, sort: statsSortOpt }, (args) =>
	Effect.gen(function* () {
		const courseService = yield* CourseService

		const chapters: string[] = args.all ? (yield* courseService.listChapters()).map((c) => c.id) : [args.chapter]

		const allStats: SectionStats[] = []

		for (const chapter of chapters) {
			const sectionIds = yield* courseService.listSections(chapter)

			for (const sectionId of sectionIds) {
				const section = yield* courseService
					.readSection(chapter, sectionId)
					.pipe(Effect.catch(() => Effect.succeed(null)))

				if (!section) continue

				const words = section.wordTimings.length
				const paragraphs = 1 + section.wordTimings.filter((w) => w.paragraphBreak).length
				const duration = section.wordTimings.at(-1)?.end ?? 0
				const hasAnimation = Boolean(section.slideshowData)
				const hasAudio = Boolean(section.audioFile)

				allStats.push({
					id: sectionId,
					chapter,
					words,
					paragraphs,
					duration,
					hasAnimation,
					hasAudio,
				})
			}
		}

		const sortKey = args.sort
		if (sortKey === "words") {
			allStats.sort((a, b) => a.words - b.words)
		} else if (sortKey === "duration") {
			allStats.sort((a, b) => a.duration - b.duration)
		} else if (sortKey === "paragraphs") {
			allStats.sort((a, b) => a.paragraphs - b.paragraphs)
		} else {
			allStats.sort((a, b) => a.id.localeCompare(b.id))
		}

		yield* Console.log("\nSection Statistics")
		yield* Console.log("─".repeat(80))

		for (const s of allStats) {
			const prefix = args.all ? `${s.chapter}/` : ""
			const flags = [s.hasAnimation ? "anim" : "", s.hasAudio ? "audio" : ""].filter(Boolean).join(", ")
			const flagStr = flags ? ` [${flags}]` : ""

			yield* Console.log(
				`${(prefix + s.id).padEnd(40)} ${String(s.words).padStart(3)} words  ${s.paragraphs} para  ${String(Math.round(s.duration)).padStart(3)}s${flagStr}`,
			)
		}

		yield* Console.log("─".repeat(80))

		const total = allStats.length
		const totalWords = allStats.reduce((a, s) => a + s.words, 0)
		const avgWords = total > 0 ? Math.round(totalWords / total) : 0
		const minWords = total > 0 ? Math.min(...allStats.map((s) => s.words)) : 0
		const maxWords = total > 0 ? Math.max(...allStats.map((s) => s.words)) : 0
		const avgPara = total > 0 ? (allStats.reduce((a, s) => a + s.paragraphs, 0) / total).toFixed(1) : "0"
		const avgDuration = total > 0 ? Math.round(allStats.reduce((a, s) => a + s.duration, 0) / total) : 0
		const totalDuration = allStats.reduce((a, s) => a + s.duration, 0)

		yield* Console.log(`Sections: ${total}`)
		yield* Console.log(`Words: min=${minWords}, max=${maxWords}, avg=${avgWords}`)
		yield* Console.log(`Paragraphs: avg=${avgPara}`)
		yield* Console.log(
			`Duration: avg=${avgDuration}s, total=${Math.round(totalDuration / 60)}m ${Math.round(totalDuration % 60)}s`,
		)
	}),
).pipe(Command.withDescription("Show statistics for sections in a chapter"))
