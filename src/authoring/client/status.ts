/**
 * What the authoring tools are doing right now, shared by the recording bar and the context menu.
 *
 * @module
 */
import { Atom } from "effect/reactivity"
import { authoringApi, type Outcome } from "./api"

export type ActivityState =
	| { readonly type: "idle" }
	| { readonly type: "busy"; readonly label: string }
	| { readonly type: "done"; readonly message: string; readonly notice?: string | undefined }
	| { readonly type: "failed"; readonly message: string }

export const activityAtom = Atom.make<ActivityState>({ type: "idle" }).pipe(Atom.keepAlive)

/** Bumped after each successful run so the takes list reloads. */
export const takesVersionAtom = Atom.make(0).pipe(Atom.keepAlive)

const sourceText = { aligned: "aligned", generated: "generated", estimated: "timings estimated" } as const

/** Turn a finished run into the message the bar shows. */
export const describeOutcome = (outcome: Outcome): ActivityState =>
	outcome.ok
		? {
				type: "done",
				message: `Saved, ${sourceText[outcome.result.timingsSource]}`,
				notice: outcome.result.notice,
			}
		: { type: "failed", message: outcome.error }

export { authoringApi }
