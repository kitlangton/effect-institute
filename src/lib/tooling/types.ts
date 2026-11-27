/**
 * Canonical types for narration data, shared between tooling and app.
 */
import { Schema } from "effect"
import { AnimationSoundName } from "@/lib/animated-code/annotations"
import { CodeSlideshow } from "@/lib/animated-code/slideshow"

// --- Branded IDs ---

export const SectionId = Schema.String.pipe(Schema.brand("SectionId"))
export type SectionId = Schema.Schema.Type<typeof SectionId>

export const ChapterId = Schema.String.pipe(Schema.brand("ChapterId"))
export type ChapterId = Schema.Schema.Type<typeof ChapterId>

export const GroupId = Schema.String.pipe(Schema.brand("GroupId"))
export type GroupId = Schema.Schema.Type<typeof GroupId>

// --- Word-level types ---

export class WordStyle extends Schema.Class<WordStyle>("WordStyle")({
	bold: Schema.optional(Schema.Boolean),
	italic: Schema.optional(Schema.Boolean),
	code: Schema.optional(Schema.Boolean),
}) {}

export class WordTiming extends Schema.Class<WordTiming>("WordTiming")({
	word: Schema.String,
	start: Schema.Number,
	end: Schema.Number,
	style: Schema.optional(WordStyle),
	paragraphBreak: Schema.optional(Schema.Boolean),
	listItem: Schema.optional(Schema.Boolean),
	definition: Schema.optional(Schema.String),
	/** URL to link this word to (opens in new tab) */
	link: Schema.optional(Schema.String),
	/** Text after this word (default " " if undefined). Empty string for hyphenated words. */
	suffix: Schema.optional(Schema.String),
}) {}

// --- Animation types ---

export class StepRef extends Schema.Class<StepRef>("StepRef")({
	name: Schema.optional(Schema.String),
	at: Schema.String,
	nth: Schema.optional(Schema.Number),
	after: Schema.optional(Schema.String),
	offset: Schema.optional(Schema.Number),
}) {}

/** One component step: the component's state, and the sound the step plays */
export const ComponentSnapshot = Schema.Struct({
	state: Schema.Record(Schema.String, Schema.Unknown),
	sound: Schema.optionalKey(AnimationSoundName),
})
export type ComponentSnapshot = typeof ComponentSnapshot.Type

/** Compiled component flow - step-driven component state */
export class ComponentFlowData extends Schema.Class<ComponentFlowData>("ComponentFlowData")({
	/** Component name (for registry lookup) */
	name: Schema.String,
	/** Step references for timing resolution */
	steps: Schema.Array(StepRef),
	/** One per step */
	snapshots: Schema.Array(ComponentSnapshot),
}) {}

export class DebugInfo extends Schema.Class<DebugInfo>("DebugInfo")({
	timingsStatus: Schema.Literals(["none", "matched", "mismatched"]),
	dslWordCount: Schema.Number,
	message: Schema.optional(Schema.String),
}) {}

// --- Section data ---

export class SectionData extends Schema.Class<SectionData>("SectionData")({
	id: SectionId,
	text: Schema.String,
	code: Schema.String,
	/** Hash of authored transcript and initial code used for change detection. */
	contentHash: Schema.String,
	wordTimings: Schema.Array(WordTiming),
	/** Step-driven component flow (receives state per step) */
	componentFlow: Schema.optional(ComponentFlowData),
	/** Compiled code animation (static code is a one-step slideshow) */
	slideshowData: Schema.optional(CodeSlideshow),
	/** Step references for timing resolution */
	steps: Schema.optional(Schema.Array(StepRef)),
	/** Precomputed step timestamps (seconds) for code animation. Only present when timings matched. */
	stepTimes: Schema.optional(Schema.Array(Schema.Number)),
	/** Precomputed step timestamps (seconds) for component flow. Only present when timings matched. */
	componentStepTimes: Schema.optional(Schema.Array(Schema.Number)),
	_debug: Schema.optional(DebugInfo),
	/** Group ID if section belongs to a group */
	groupId: Schema.optional(Schema.String),
	/** Group title if section belongs to a group */
	groupTitle: Schema.optional(Schema.String),
	/** Whether this is the first section in its group */
	isFirstInGroup: Schema.optional(Schema.Boolean),
	/** Whether the group this section belongs to is a draft */
	groupDraft: Schema.optional(Schema.Boolean),
	/** Hashed audio filename (e.g., "welcome.a1b2c3d4.webm") for cache busting */
	audioFile: Schema.optional(Schema.String),
}) {}

// --- Chapter types ---

export class ChapterMetadata extends Schema.Class<ChapterMetadata>("ChapterMetadata")({
	id: ChapterId,
	title: Schema.String,
	description: Schema.optional(Schema.String),
	order: Schema.Number,
	draft: Schema.optional(Schema.Boolean),
	/** Coming soon chapters are always visible but non-clickable */
	comingSoon: Schema.optional(Schema.Boolean),
	/** Total number of sections in the chapter (precomputed for quick chapter index rendering). */
	sectionsCount: Schema.optional(Schema.Number),
}) {}

export class ManifestSectionEntry extends Schema.Class<ManifestSectionEntry>("ManifestSectionEntry")({
	id: SectionId,
	file: Schema.String,
}) {}

export class ManifestGroupEntry extends Schema.Class<ManifestGroupEntry>("ManifestGroupEntry")({
	id: GroupId,
	title: Schema.String,
	sectionIds: Schema.Array(SectionId),
}) {}

export class ChapterManifest extends Schema.Class<ChapterManifest>("ChapterManifest")({
	id: ChapterId,
	title: Schema.String,
	description: Schema.optional(Schema.String),
	sections: Schema.Array(ManifestSectionEntry),
	groups: Schema.optional(Schema.Array(ManifestGroupEntry)),
	draft: Schema.optional(Schema.Boolean),
	draftGroups: Schema.optional(Schema.Array(GroupId)),
}) {}

export class CourseManifest extends Schema.Class<CourseManifest>("CourseManifest")({
	chapters: Schema.Array(ChapterMetadata),
}) {}
