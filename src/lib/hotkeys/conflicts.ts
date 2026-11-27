import { serializeKeySequence } from "./format"
import { hotkeyActionList } from "./registry"
import type { HotkeyActionId, HotkeyContextId, HotkeyMap, KeySequence } from "./types"

export type HotkeyConflict = {
	context: HotkeyContextId
	sequence: KeySequence
	actions: HotkeyActionId[]
}

export const getHotkeyConflicts = (map: HotkeyMap): HotkeyConflict[] => {
	const conflicts: HotkeyConflict[] = []
	const contexts = new Set(hotkeyActionList.flatMap((action) => action.contexts))

	contexts.forEach((context) => {
		const sequenceMap = new Map<string, { sequence: KeySequence; actions: HotkeyActionId[] }>()

		for (const action of hotkeyActionList) {
			if (!action.contexts.includes(context)) continue
			const sequences = map[action.id] ?? []
			for (const sequence of sequences) {
				const key = serializeKeySequence(sequence)
				const entry = sequenceMap.get(key)
				if (entry) {
					if (!entry.actions.includes(action.id)) entry.actions.push(action.id)
				} else {
					sequenceMap.set(key, { sequence, actions: [action.id] })
				}
			}
		}

		for (const entry of sequenceMap.values()) {
			if (entry.actions.length > 1) {
				conflicts.push({ context, sequence: entry.sequence, actions: entry.actions })
			}
		}
	})

	return conflicts
}
