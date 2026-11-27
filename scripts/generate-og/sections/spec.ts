/**
 * Chapter spec collection for OG image generation.
 * Collects metadata from all chapters via CourseService.
 */
import { Effect } from "effect"
import { CourseService } from "@/backend/services"

export interface ChapterSpec {
	readonly id: string
	readonly title: string
	readonly description: string
}

/** Collect all chapter specs */
export const collectChapterSpecs = Effect.gen(function* () {
	const courseService = yield* CourseService

	const chapters = yield* courseService.listChapters()
	const specs: ChapterSpec[] = []

	for (const chapter of chapters) {
		// Skip draft and coming-soon chapters
		if (chapter.draft || chapter.comingSoon) continue

		specs.push({
			id: chapter.id,
			title: chapter.title,
			description: chapter.description ?? "",
		})
	}

	return specs
})
