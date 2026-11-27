/**
 * Flag/argument helpers shared by the narration CLI commands.
 *
 * @module
 */
import { Argument, Flag } from "effect/cli"

export const Args = {
	text: ({ name }: { name: string }) => Argument.String(name),
	withDescription: Argument.withDescription,
	withDefault: Argument.withDefault,
	optional: Argument.optional,
}

export const Options = {
	text: Flag.String,
	boolean: Flag.Boolean,
	withAlias: Flag.withAlias,
	withDescription: Flag.withDescription,
	withDefault: Flag.withDefault,
	optional: Flag.optional,
}

/** Global chapter option used by most commands */
export const chapterOpt = Options.text("chapter").pipe(
	Options.withAlias("c"),
	Options.withDescription("Chapter ID (default: intro)"),
	Options.withDefault("intro"),
)
