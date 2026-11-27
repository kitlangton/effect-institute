/**
 * `narrate new` - scaffold a section (and its chapter, if new) with working starter DSL.
 *
 * @module
 */
import { Console, Effect, FileSystem, Option, Path } from "effect"
import { Command } from "effect/cli"
import { CourseService } from "@/backend/services"
import { AppConfig } from "@/backend/services/AppConfig"
import { CommandError } from "./narration-shared"
import { Args, Options } from "./shared"

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const pathArg = Args.text({ name: "chapter/section" }).pipe(
	Args.withDescription("Where to create the section, e.g. my-chapter/my-section (lowercase, dash-separated)"),
)

const titleOpt = Options.text("title").pipe(
	Options.withDescription("Chapter title when the chapter is new (default: from the chapter ID)"),
	Options.optional,
)

const groupOpt = Options.text("group").pipe(
	Options.withDescription("Group ID to put the section in when the chapter is new"),
	Options.withDefault("getting-started"),
)

const camelCase = (id: string) => id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const titleCase = (id: string) =>
	id
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ")

/** Starter section: one transcript, an animated code block, and two word-triggered steps. */
export const sectionTemplate = (sectionId: string) => `import { line, on, section, slot, stack } from "@/lib/content"

export const ${camelCase(sectionId)} = section("${sectionId}", {
	transcript: \`
		Every section starts with a transcript, written in Markdown.
		When the narration reaches the word **greet**, the code on the right changes.
		Steps fire on spoken words, so edit the transcript and the flow together.
	\`,

	code: {
		animation: stack(
			line("import", 'import { Effect } from "effect"'),
			line("blank", ""),
			line("program", [
				"const program = Effect.succeed(",
				slot("message", { short: '"hi"', long: '"hello, world"' }),
				")",
			]),
			slot.optional("run", line("run", "Effect.runSync(program)")),
		),
		flow: [
			on("greet").slots({ message: "long" }).focus("program"),
			on("flow").slots({ run: "shown" }).at("runSync", (t) => t.cursor()),
		],
	},
})
`

export const chapterTemplate = (chapterId: string, title: string, groupId: string, sectionId: string) =>
	`import { chapter, group } from "@/lib/content"
import { ${camelCase(sectionId)} } from "./${sectionId}"

// Draft chapters are built for "bun dev" but left out of the published site until you remove draft.
export default chapter("${chapterId}", ${JSON.stringify(title)}, [group("${groupId}", ${JSON.stringify(titleCase(groupId))}, [${camelCase(sectionId)}])], {
	description: "What this chapter teaches.",
	draft: true,
})
`

export const newCmd = Command.make("new", { path: pathArg, title: titleOpt, group: groupOpt }, (args) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem
		const path = yield* Path.Path
		const config = yield* AppConfig
		const course = yield* CourseService

		const [chapterId, sectionId, ...rest] = args.path.split("/")
		if (!chapterId || !sectionId || rest.length > 0 || !SAFE_ID.test(chapterId) || !SAFE_ID.test(sectionId)) {
			return yield* new CommandError({ message: "Expected <chapter>/<section> with lowercase, dash-separated IDs" })
		}
		if (!SAFE_ID.test(args.group))
			return yield* new CommandError({ message: "--group must be lowercase and dash-separated" })

		const chapterDir = path.join(config.coursesDir, chapterId)
		const sectionFile = path.join(chapterDir, `${sectionId}.ts`)
		const indexFile = path.join(chapterDir, "index.ts")
		const rel = (file: string) => path.relative(config.projectRoot, file)

		if (yield* fs.exists(sectionFile)) return yield* new CommandError({ message: `${rel(sectionFile)} already exists` })
		const chapterExists = yield* fs.exists(indexFile)
		if (chapterExists) {
			const ids = yield* course.listSections(chapterId).pipe(Effect.orElseSucceed(() => [] as string[]))
			if (ids.includes(sectionId)) {
				return yield* new CommandError({ message: `Section ${sectionId} already exists in chapter ${chapterId}` })
			}
		}

		yield* fs.makeDirectory(chapterDir, { recursive: true })
		yield* fs.writeFileString(sectionFile, sectionTemplate(sectionId))
		yield* Console.log(`Created ${rel(sectionFile)}`)

		if (chapterExists) {
			yield* Console.log(
				[
					"",
					`Add the section to ${rel(indexFile)}:`,
					`  import { ${camelCase(sectionId)} } from "./${sectionId}"`,
					`  ...and list ${camelCase(sectionId)} in chapter(...) or one of its group(...) calls.`,
					"",
					`Then check it: bun narrate steps -c ${chapterId} ${sectionId}`,
				].join("\n"),
			)
			return
		}

		const title = Option.getOrElse(args.title, () => titleCase(chapterId))
		yield* fs.writeFileString(indexFile, chapterTemplate(chapterId, title, args.group, sectionId))
		yield* Console.log(`Created ${rel(indexFile)} (draft chapter)`)
		yield* course.build(chapterId, { failOnError: true })
		yield* Console.log(
			[
				"",
				"Next:",
				`  bun narrate steps -c ${chapterId} ${sectionId}    check that every step fires on a word`,
				`  bun narrate words -c ${chapterId} ${sectionId}    list transcript words and their #nth counts`,
				`  bun dev, then open http://localhost:3210/chapters/${chapterId}`,
			].join("\n"),
		)
	}),
).pipe(Command.withDescription("Scaffold a new section (and chapter) with starter DSL"))
