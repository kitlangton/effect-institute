/**
 * Types and small helpers shared by the CourseService submodules.
 */

import * as crypto from "node:crypto"
import { Effect, type FileSystem, type Path, Schema } from "effect"
import type { AppConfigShape } from "../AppConfig"

/** Error for course-related failures */
export class CourseError extends Schema.TaggedError<CourseError>()("CourseError", {
	message: Schema.String,
	cause: Schema.optional(Schema.Defect()),
}) {}

export const courseError = (message: string, cause?: unknown) =>
	new CourseError({
		message,
		...(cause === undefined ? {} : { cause }),
	})

export interface BuildOptions {
	/** Include draft chapters and groups for authoring workflows. Defaults to true. */
	readonly includeDrafts?: boolean
	/** Fail when a requested authoring rebuild cannot install valid artifacts. */
	readonly failOnError?: boolean
}

/** What every submodule needs: the platform and the project's resolved paths. */
export interface CourseContext {
	readonly fs: FileSystem.FileSystem
	readonly path: Path.Path
	readonly config: AppConfigShape
}

/** Bounds parallel filesystem work (reads, writes, removals) so large chapters don't exhaust file descriptors. */
export const FS_CONCURRENCY = 8

/** Hashed delivery artifacts: `<section-id>.<8 hex>.json` or `.webm`. */
export const HASHED_ARTIFACT = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-f0-9]{8}\.(?:json|webm)$/

/** Compute MD5 hash of content, returning first 8 hex characters */
export const computeContentHash = (content: crypto.BinaryLike) =>
	crypto.createHash("md5").update(content).digest("hex").slice(0, 8)

/** Escape a string for use as a literal inside a RegExp. */
export const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Read a JSON file and decode it with `schema`, failing with a CourseError that names the file. */
export const readJsonFile = <S extends Schema.Codec<unknown, unknown, never, never>>(
	fs: FileSystem.FileSystem,
	filePath: string,
	schema: S,
	label = filePath,
): Effect.Effect<S["Type"], CourseError> =>
	fs.readFileString(filePath).pipe(
		Effect.mapError((e) => courseError(`Failed to read ${label}: ${e}`, e)),
		Effect.flatMap((content) =>
			Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(content).pipe(
				Effect.mapError((e) => courseError(`Failed to parse ${label}: ${e}`, e)),
			),
		),
	)

/** Write via a temp file and rename, so readers never see a half-written manifest. */
export const writeJsonAtomically = Effect.fn("CourseService.writeJsonAtomically")(function* (
	fs: FileSystem.FileSystem,
	filePath: string,
	content: string,
) {
	const tempPath = `${filePath}.${Date.now()}-${Math.random().toString(36).slice(2, 10)}.tmp`
	yield* Effect.gen(function* () {
		yield* fs.writeFileString(tempPath, content)
		yield* fs.rename(tempPath, filePath)
	}).pipe(
		Effect.tapError(() => fs.remove(tempPath).pipe(Effect.catch(() => Effect.void))),
		Effect.mapError((e) => courseError(`Failed to write ${filePath}: ${e}`, e)),
	)
})

/** Remove files from a directory with bounded concurrency. */
export const removeFiles = (
	{ fs, path }: CourseContext,
	dir: string,
	files: ReadonlyArray<string>,
	describe: string,
): Effect.Effect<void, CourseError> =>
	Effect.forEach(
		files,
		(file) =>
			fs
				.remove(path.join(dir, file))
				.pipe(Effect.mapError((e) => courseError(`Failed to remove ${describe} ${file}: ${e}`, e))),
		{ concurrency: FS_CONCURRENCY, discard: true },
	)

/** List a directory, or nothing when it does not exist. */
export const readDirectoryIfExists = (fs: FileSystem.FileSystem, dir: string) =>
	fs.exists(dir).pipe(
		Effect.flatMap((exists) => (exists ? fs.readDirectory(dir) : Effect.succeed<ReadonlyArray<string>>([]))),
		Effect.mapError((e) => courseError(`Failed to read dir ${dir}: ${e}`, e)),
	)
