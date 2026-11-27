/**
 * Dev-only context menu actions for a section: generate narration and re-align timings.
 *
 * @module
 */
import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { ContextMenuItem } from "@/components/ui/context-menu"
import { authoringApi, type Outcome } from "./api"
import { activityAtom, describeOutcome, takesVersionAtom } from "./status"

export interface AuthoringMenuItemsProps {
	readonly chapter: string
	readonly sectionId: string
}

export function AuthoringMenuItems({ chapter, sectionId }: AuthoringMenuItemsProps) {
	const activity = useAtomValue(activityAtom)
	const setActivity = useAtomSet(activityAtom)
	const bumpTakes = useAtomSet(takesVersionAtom)
	const busy = activity.type === "busy"

	const run = async (label: string, action: () => Promise<Outcome>) => {
		setActivity({ type: "busy", label })
		setActivity(describeOutcome(await action()))
		bumpTakes((v) => v + 1)
	}

	return (
		<>
			<ContextMenuItem
				disabled={busy}
				onSelect={() => run("Generating audio", () => authoringApi.generate(chapter, sectionId))}
			>
				Generate audio (ElevenLabs)
			</ContextMenuItem>
			<ContextMenuItem disabled={busy} onSelect={() => run("Aligning", () => authoringApi.align(chapter, sectionId))}>
				Re-align timings
			</ContextMenuItem>
		</>
	)
}
