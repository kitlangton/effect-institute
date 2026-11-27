/**
 * Authoring settings (.env / environment). Read lazily: nothing here runs until an
 * alignment or generation call needs a value, so the site, tests and build need no keys.
 *
 * @module
 */
import { Config, ConfigProvider, Effect, FileSystem, Layer, Option, Schema } from "effect"

export class MissingSettingError extends Schema.TaggedError<MissingSettingError>()("MissingSettingError", {
	setting: Schema.String,
	message: Schema.String,
}) {}

/** A setting from the environment or .env, or None when it is unset or blank. */
export const setting = (name: string): Effect.Effect<Option.Option<string>> =>
	Config.option(Config.String(name)).pipe(
		Effect.map(Option.map((value) => value.trim())),
		Effect.map(Option.filter((value) => value.length > 0)),
		Effect.orElseSucceed(() => Option.none<string>()),
	)

/** A setting that must be present, failing with a message that says where to set it. */
export const requireSetting = (name: string, neededFor: string): Effect.Effect<string, MissingSettingError> =>
	setting(name).pipe(
		Effect.flatMap(
			Option.match({
				onSome: Effect.succeed,
				onNone: () =>
					Effect.fail(
						new MissingSettingError({
							setting: name,
							message: `${name} is not set; it is needed for ${neededFor}. Copy .env.example to .env and fill it in (or export ${name} in your shell).`,
						}),
					),
			}),
		),
	)

/**
 * Config provider for authoring commands: real environment variables first, then the project's .env file.
 * A missing .env is fine.
 */
export const layer = (dotEnvPath: string) =>
	Layer.unwrap(
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem
			const contents = yield* fs.readFileString(dotEnvPath).pipe(Effect.orElseSucceed(() => ""))
			const provider = ConfigProvider.orElse(
				ConfigProvider.fromEnv(),
				ConfigProvider.fromDotEnvContents(contents, { preserveEmptyStrings: false }),
			)
			return ConfigProvider.layer(provider)
		}),
	)
