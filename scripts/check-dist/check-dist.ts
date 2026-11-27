/**
 * Fails when authoring code leaked into a production build.
 *
 *   bun scripts/check-dist/main.ts [dist]
 *
 * Runs as the last step of "bun run build". Authoring endpoints, the ElevenLabs client and the
 * recording bar are dev-only; any of these markers in dist/ means a dev-only import lost its
 * import.meta.env.DEV guard.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

export const FORBIDDEN = [
	"__authoring", // dev server endpoints
	"api.elevenlabs.io", // ElevenLabs client
	"ELEVENLABS", // settings names
	"effect-institute:recorder-device-id", // recording bar
] as const

export interface Finding {
	readonly file: string
	readonly marker: string
}

const walk = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const full = path.join(dir, name)
		return statSync(full).isDirectory() ? walk(full) : [full]
	})

/** Every (file, marker) pair where a forbidden marker appears under dir. */
export function findAuthoringCode(dir: string): Finding[] {
	return walk(dir).flatMap((file) => {
		const content = readFileSync(file).toString("latin1")
		return FORBIDDEN.filter((marker) => content.includes(marker)).map((marker) => ({
			file: path.relative(dir, file),
			marker,
		}))
	})
}
