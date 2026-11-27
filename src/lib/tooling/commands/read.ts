/**
 * `narrate read` - output chapter content for review (transcripts, IDs, code).
 *
 * @module
 */
import { Console, Effect } from "effect"
import { Command } from "effect/cli"
import { CourseService } from "@/backend/services"
import { isGroup } from "@/lib/content/dsl"
import { Args, Options } from "./shared"

// =============================================================================
// Read Command - Output chapter content for review
// =============================================================================

const readChapterArg = Args.text({ name: "chapter" }).pipe(
	Args.withDescription("Chapter ID (e.g., intro)"),
	Args.withDefault("intro"),
)

const readCodeOpt = Options.boolean("include-code").pipe(
	Options.withAlias("c"),
	Options.withDescription("Include initial code blocks"),
	Options.withDefault(false),
)

const readJsonOpt = Options.boolean("json").pipe(
	Options.withAlias("j"),
	Options.withDescription("Output as JSON"),
	Options.withDefault(false),
)

interface SectionOutput {
	id: string
	transcript: string
	code?: string | undefined
	component?: string | undefined
	stepCount?: number | undefined
}

interface GroupOutput {
	id: string
	title: string
	draft?: boolean | undefined
	sections: SectionOutput[]
}

interface ChapterOutput {
	id: string
	title: string
	description?: string | undefined
	groups: GroupOutput[]
}

export const readCmd = Command.make(
	"read",
	{ chapter: readChapterArg, includeCode: readCodeOpt, json: readJsonOpt },
	(args) =>
		Effect.gen(function* () {
			const courseService = yield* CourseService

			const chapter = yield* courseService.loadChapter(args.chapter)

			// Helper to render initial code from animation
			const renderInitialCode = async (section: {
				code?: import("@/lib/content/dsl").CodeDef
			}): Promise<string | undefined> => {
				if (!section.code) return undefined
				if (typeof section.code === "string") return section.code

				// Animated code - render with base snapshot
				const { render } = await import("@/lib/animated-code/animation/render")
				const { compileFlow } = await import("@/lib/animated-code/flow")

				const { snapshots } = compileFlow(section.code.base, [...section.code.flow], section.code.animation)

				const rendered = render(section.code.animation, snapshots[0].slots)
				return rendered.lines.map((line) => line.parts.map((p) => p.content).join("")).join("\n")
			}

			// Build output structure
			const output: ChapterOutput = {
				id: chapter.id,
				title: chapter.title,
				description: chapter.description,
				groups: [],
			}

			for (const item of chapter.items) {
				if (isGroup(item)) {
					const groupOutput: GroupOutput = {
						id: item.id,
						title: item.title,
						draft: item.draft,
						sections: [],
					}
					for (const section of item.sections) {
						const sectionOutput: SectionOutput = {
							id: section.id,
							transcript: section.transcript.trim().replace(/\t+/g, ""),
							component: section.component?.name,
						}
						if (args.includeCode) {
							sectionOutput.code = yield* Effect.promise(() => renderInitialCode(section))
						}
						if (section.code && typeof section.code !== "string" && section.code.flow) {
							sectionOutput.stepCount = section.code.flow.length
						}
						groupOutput.sections.push(sectionOutput)
					}
					output.groups.push(groupOutput)
				} else {
					// Ungrouped section - create implicit group
					const sectionOutput: SectionOutput = {
						id: item.id,
						transcript: item.transcript.trim().replace(/\t+/g, ""),
						component: item.component?.name,
					}
					if (args.includeCode) {
						sectionOutput.code = yield* Effect.promise(() => renderInitialCode(item))
					}
					if (item.code && typeof item.code !== "string" && item.code.flow) {
						sectionOutput.stepCount = item.code.flow.length
					}
					output.groups.push({
						id: "_ungrouped",
						title: "(Ungrouped)",
						sections: [sectionOutput],
					})
				}
			}

			// Output
			if (args.json) {
				yield* Console.log(JSON.stringify(output, null, 2))
			} else {
				// Human readable output
				yield* Console.log(`\n${"═".repeat(70)}`)
				yield* Console.log(`CHAPTER: ${output.title} (${output.id})`)
				if (output.description) {
					yield* Console.log(`  ${output.description}`)
				}
				yield* Console.log(`${"═".repeat(70)}\n`)

				for (const group of output.groups) {
					const draftBadge = group.draft ? " [DRAFT]" : ""
					yield* Console.log(`\n${"─".repeat(60)}`)
					yield* Console.log(`GROUP: ${group.title}${draftBadge}`)
					yield* Console.log(`${"─".repeat(60)}`)

					for (const section of group.sections) {
						yield* Console.log(`\n### ${section.id}`)
						if (section.component) {
							yield* Console.log(`Component: ${section.component}`)
						}
						if (section.stepCount) {
							yield* Console.log(`Animation steps: ${section.stepCount}`)
						}
						yield* Console.log("")
						yield* Console.log(section.transcript)

						if (args.includeCode && section.code) {
							yield* Console.log("\n```typescript")
							yield* Console.log(section.code)
							yield* Console.log("```")
						}
					}
				}
				yield* Console.log("")
			}
		}),
).pipe(Command.withDescription("Output chapter content for review (transcripts, IDs, code)"))
