/**
 * Pure helpers for the recording bar, kept separate so they can be unit tested.
 *
 * @module
 */

export type RecordingKeyAction = "start" | "stop" | "discard" | null

export interface KeyLike {
	readonly key: string
	readonly ctrlKey: boolean
	readonly metaKey: boolean
	readonly altKey: boolean
	readonly shiftKey: boolean
}

/**
 * Recording shortcuts: Ctrl+R starts (or restarts) a take, Enter stops and saves it, Esc discards it.
 * Enter and Esc only act while recording, so they keep their usual meaning otherwise.
 */
export function recordingKeyAction(event: KeyLike, isRecording: boolean, inEditableField: boolean): RecordingKeyAction {
	const plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
	if (event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "r") return "start"
	if (!isRecording || inEditableField || !plain) return null
	if (event.key === "Enter") return "stop"
	if (event.key === "Escape") return "discard"
	return null
}

export function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60)
	const secs = Math.floor(seconds % 60)
	return `${mins}:${secs.toString().padStart(2, "0")}`
}

/** "Today 3:04 PM", "Yesterday 9:12 AM", "3 days ago 1:00 PM", else a short date. */
export function formatTakeLabel(createdAt: string, now: Date = new Date()): string {
	const date = new Date(createdAt)
	if (Number.isNaN(date.getTime())) return createdAt
	const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
	const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
	const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date)
	const day =
		days === 0
			? "Today"
			: days === 1
				? "Yesterday"
				: days > 1 && days <= 6
					? `${days} days ago`
					: new Intl.DateTimeFormat(undefined, {
							month: "short",
							day: "numeric",
							...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
						}).format(date)
	return `${day} ${time}`
}

/** Level meter color by short-term RMS in dBFS. */
export function levelColor(levelDb: number): string {
	if (levelDb > -6) return "bg-red-400"
	if (levelDb > -12) return "bg-amber-300"
	if (levelDb > -24) return "bg-emerald-300"
	return "bg-white/40"
}
