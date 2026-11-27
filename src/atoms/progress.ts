/**
 * Progress tracking atoms.
 * Service is defined in services/ProgressService.ts to avoid circular dependency.
 */
import { Effect } from "effect"
import { frontendRuntime, runFrontendPromise } from "./runtime"
import { ProgressService } from "./services"

export { ProgressService } from "./services"

/** Load chapter progress (returns section IDs). Returns a promise. */
export function loadChapterProgress(chapter: string): Promise<string[]> {
	return runFrontendPromise(
		Effect.gen(function* () {
			const service = yield* ProgressService
			return yield* service.loadProgress(chapter)
		}),
	)
}

/** Load progress for all chapters. Returns an object of chapter → section IDs. */
export function loadAllProgress(): Promise<Record<string, string[]>> {
	return runFrontendPromise(
		Effect.gen(function* () {
			const service = yield* ProgressService
			return yield* service.loadAllProgress()
		}),
	)
}

/** Mark a section as completed. */
export const markCompletedAtom = frontendRuntime.fn(
	Effect.fnUntraced(function* (args: { chapter: string; sectionId: string }) {
		const service = yield* ProgressService
		yield* service.markCompleted(args.chapter, args.sectionId)
	}),
)

/** Reset all progress. */
export const resetAllProgressAtom = frontendRuntime.fn(
	Effect.fnUntraced(function* () {
		const service = yield* ProgressService
		yield* service.resetAll()
	}),
)
