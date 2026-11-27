/**
 * Build error types using Schema.TaggedError.
 *
 * @module
 */

import { Schema } from "effect"

export class WordNotFoundError extends Schema.TaggedError<WordNotFoundError>()("WordNotFoundError", {
	sectionId: Schema.String,
	stepName: Schema.String,
	word: Schema.String,
	suggestions: Schema.optional(Schema.Array(Schema.String)),
}) {}

export class PatternNotFoundError extends Schema.TaggedError<PatternNotFoundError>()("PatternNotFoundError", {
	sectionId: Schema.String,
	stepName: Schema.String,
	pattern: Schema.String,
	annotation: Schema.String,
}) {}

export class SlotNotFoundError extends Schema.TaggedError<SlotNotFoundError>()("SlotNotFoundError", {
	sectionId: Schema.String,
	stepName: Schema.String,
	slotName: Schema.String,
	availableSlots: Schema.Array(Schema.String),
}) {}

export class LineIdNotFoundError extends Schema.TaggedError<LineIdNotFoundError>()("LineIdNotFoundError", {
	sectionId: Schema.String,
	stepName: Schema.String,
	lineId: Schema.String,
}) {}

export class SectionBuildError extends Schema.TaggedError<SectionBuildError>()("SectionBuildError", {
	sectionId: Schema.String,
	message: Schema.String,
}) {}

export class ChapterLoadError extends Schema.TaggedError<ChapterLoadError>()("ChapterLoadError", {
	chapterId: Schema.String,
	message: Schema.String,
}) {}

export type BuildError =
	| WordNotFoundError
	| PatternNotFoundError
	| SlotNotFoundError
	| LineIdNotFoundError
	| SectionBuildError
	| ChapterLoadError
