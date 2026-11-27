/**
 * Simple changelog DSL.
 *
 * Usage in content/changelog.ts:
 * ```ts
 * import { changelog, release, change } from "@/lib/changelog"
 *
 * export default changelog([
 *   release("2025-01-08", [
 *     change("improvement", "Skip amounts scale with playback speed", { ref: "@bill876" }),
 *   ]),
 * ])
 * ```
 */

export interface Change {
	type: string // "fix" | "improvement" | "feature" | "curriculum" | etc
	text: string
	ref?: string // "@bill876", "PR#123", URL
}

export interface Release {
	date: string // "2025-01-08"
	changes: Change[]
}

export interface Changelog {
	releases: Release[]
}

export const change = (type: string, text: string, opts?: { ref?: string }): Change => {
	const result: Change = { type, text }
	if (opts?.ref) result.ref = opts.ref
	return result
}

export const release = (date: string, changes: Change[]): Release => ({
	date,
	changes,
})

export const changelog = (releases: Release[]): Changelog => ({ releases })
