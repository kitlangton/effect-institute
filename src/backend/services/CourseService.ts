/**
 * Central service for accessing and building course content:
 * - Chapter and built section manifest reads (`course/manifest.ts`)
 * - DSL loading and section lookup (`course/loader.ts`)
 * - Build and artifact pruning (`course/builder.ts`, `course/pruner.ts`)
 * - Animation step & slot-stability preview (`course/preview.ts`)
 */

import { NodeServices } from "@effect/platform-node"
import { Context, Effect, FileSystem, Layer, Path } from "effect"
import type { StabilityWarning } from "@/lib/animated-code/animation"
import type { StepPreview } from "@/lib/animated-code/animation/preview"
import type { ChapterDef, SectionDef } from "@/lib/content/dsl"
import type { ChapterMetadata, SectionData } from "@/lib/tooling/types"
import { AppConfig } from "./AppConfig"
import { makeBuilder } from "./course/builder"
import { makeLoader } from "./course/loader"
import { makeManifests } from "./course/manifest"
import { makePreview } from "./course/preview"
import { makePruner } from "./course/pruner"
import type { BuildOptions, CourseError } from "./course/shared"

export { type BuildOptions, CourseError } from "./course/shared"
export type { StepPreview }

export class CourseService extends Context.Service<
	CourseService,
	{
		/** List all chapters from course manifest */
		readonly listChapters: () => Effect.Effect<ChapterMetadata[], CourseError>

		/** Load a chapter DSL definition by ID */
		readonly loadChapter: (chapterId: string) => Effect.Effect<ChapterDef, CourseError>

		/** Get a section DSL definition by chapter and section ID */
		readonly getSection: (chapterId: string, sectionId: string) => Effect.Effect<SectionDef, CourseError>

		/** List all section IDs in a chapter (from DSL) */
		readonly listSections: (chapterId: string) => Effect.Effect<string[], CourseError>

		/** Read and parse a built section JSON file */
		readonly readSection: (chapterId: string, sectionId: string) => Effect.Effect<SectionData, CourseError>

		/** Build course JSON and hashed audio files */
		readonly build: (chapterFilter?: string, options?: BuildOptions) => Effect.Effect<void, CourseError>

		/** Discover all chapters by looking for index.ts files */
		readonly discoverChapters: () => Effect.Effect<string[], CourseError>

		/** Preview all animation steps for a section */
		readonly previewSteps: (chapterId: string, sectionId: string) => Effect.Effect<StepPreview[], CourseError>

		/** Warnings for slots with common text that should be extracted */
		readonly checkStability: (chapterId: string, sectionId: string) => Effect.Effect<StabilityWarning[], CourseError>
	}
>()("@effect-institute/CourseService") {
	static readonly layer = Layer.effect(
		CourseService,
		Effect.gen(function* () {
			const ctx = {
				fs: yield* FileSystem.FileSystem,
				path: yield* Path.Path,
				config: yield* AppConfig,
			}
			const loader = makeLoader(ctx)
			const { loadChapterForBuild: _internal, ...dsl } = loader

			return CourseService.of({
				...makeManifests(ctx),
				...dsl,
				...makeBuilder(ctx, loader, makePruner(ctx)),
				...makePreview(loader),
			})
		}),
	)

	/** Ready-to-use layer with all dependencies provided */
	static readonly defaultLayer = CourseService.layer.pipe(
		Layer.provide(AppConfig.layer),
		Layer.provide(NodeServices.layer),
	)
}
