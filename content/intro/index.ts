import { chapter, group } from "@/lib/content"
import { catchBlocksGoStale } from "./catch-blocks-go-stale"
import { catchTag } from "./catch-tag"
import { catchingErrors } from "./catching-errors"
import { effectShowsErrors } from "./effect-shows-errors"
import { errorsAreInvisible } from "./errors-are-invisible"
import { errorsCompose } from "./errors-compose"
import { promiseHidesErrors } from "./promise-hides-errors"
import { promisesOnlyHappyPath } from "./promises-only-happy-path"
import {
	abortSignalInfusion,
	effectStructuredConcurrency,
	promiseAbortCeremony,
	runawayPromises,
	theScenario,
} from "./structured-concurrency"
import { tryCatchGivesUnknown } from "./try-catch-gives-unknown"
import { welcome, welcomeControls, welcomeFeedback } from "./welcome"

export default chapter(
	"intro",
	"Introduction to Effect",
	[
		group("welcome", "Welcome", [welcome, welcomeControls, welcomeFeedback]),
		group("promise-problems", "Typed Errors: Broken Promises", [
			promisesOnlyHappyPath,
			errorsAreInvisible,
			tryCatchGivesUnknown,
			catchBlocksGoStale,
		]),
		group("effect-solution", "Typed Errors: Failing Up", [
			promiseHidesErrors,
			effectShowsErrors,
			errorsCompose,
			catchingErrors,
			catchTag,
		]),
		group("structured-concurrency", "Structured Concurrency", [
			theScenario,
			runawayPromises,
			promiseAbortCeremony,
			abortSignalInfusion,
			effectStructuredConcurrency,
		]),
	],
	{
		description: "Why Effect exists and the problems it solves",
		order: 1,
	},
)
