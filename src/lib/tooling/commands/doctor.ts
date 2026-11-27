/**
 * `narrate doctor` - check authoring tools, settings, and every section's audio and timings.
 *
 * Fails (exit 1) only for problems that break `bun run build` or the published site.
 *
 * @module
 */
import { Console, Effect, FileSystem, Option } from "effect"
import { Command } from "effect/cli"
import { Narration } from "@/authoring/server/Narration"
import { CourseService } from "@/backend/services"
import { parseTranscript } from "@/lib/content/compile"
import { flattenPublishedSections, flattenSections } from "@/lib/content/dsl"
import { mergeTimings } from "@/lib/content/timing-merge"

export type SectionState = "ok" | "no-audio" | "no-timings" | "stale" | "estimated"

export interface SectionCheck {
	readonly section: string
	readonly published: boolean
	readonly state: SectionState
}

/** Classify one section from its transcript, whether audio exists, and its timings file (or null). */
export const checkSection = (transcript: string, hasAudio: boolean, timingsContent: string | null): SectionState => {
	if (!hasAudio) return "no-audio"
	if (timingsContent === null) return "no-timings"
	const words = parseTranscript(transcript).words.map((w) => ({ ...w, start: 0, end: 0 }))
	if (mergeTimings(timingsContent, words).status !== "matched") return "stale"
	try {
		return (JSON.parse(timingsContent) as { source?: string }).source === "estimated" ? "estimated" : "ok"
	} catch {
		return "stale"
	}
}

const advice = (chapter: string, check: SectionCheck): string => {
	const ref = `-c ${chapter} ${check.section}`
	switch (check.state) {
		case "no-audio":
			return check.published
				? `no audio, so bun run build will fail. Record it, run bun narrate generate ${ref}, or mark its group draft`
				: "no audio yet"
		case "no-timings":
			return `audio but no timings. Run bun narrate align ${ref}`
		case "stale":
			return `transcript changed since the timings were made. Re-record, or run bun narrate align ${ref}`
		case "estimated":
			return `timings are estimated, not aligned. Run bun narrate align ${ref}`
		case "ok":
			return "ok"
	}
}

export const doctorCmd = Command.make("doctor", {}, () =>
	Effect.gen(function* () {
		const narration = yield* Narration
		const course = yield* CourseService
		const fs = yield* FileSystem.FileSystem

		const status = yield* narration.status()
		const line = (ok: boolean, text: string) => Console.log(`  ${ok ? "✓" : "-"} ${text}`)
		yield* Console.log("\nTools and settings")
		yield* line(
			Option.isSome(status.ffmpeg),
			Option.getOrElse(status.ffmpeg, () => "ffmpeg not found: install it to record or generate audio"),
		)
		yield* line(
			status.dotEnv,
			status.dotEnv ? ".env found" : "no .env (only needed for align and generate; see .env.example)",
		)
		yield* line(
			status.elevenLabsKey,
			status.elevenLabsKey
				? "ELEVENLABS_API_KEY set"
				: "ELEVENLABS_API_KEY not set (recording still works, with estimated timings)",
		)
		yield* line(
			status.voiceId,
			status.voiceId ? "ELEVENLABS_VOICE_ID set" : "ELEVENLABS_VOICE_ID not set (needed for generate, or pass --voice)",
		)
		yield* line(true, `text-to-speech model: ${status.modelId}`)
		yield* line(
			true,
			status.audioChain
				? "AUTHORING_AUDIO_CHAIN_CMD set (runs on each recorded take)"
				: "audio processing: plain ffmpeg",
		)

		let errors = 0
		let warnings = 0
		yield* Console.log("\nSections")
		for (const chapterId of yield* course.discoverChapters()) {
			const chapter = yield* course.loadChapter(chapterId)
			const published = new Set(chapter.draft ? [] : flattenPublishedSections(chapter).map((s) => s.id))
			const checks: SectionCheck[] = []
			for (const section of flattenSections(chapter)) {
				const paths = narration.paths(chapterId, section.id)
				const hasAudio = yield* fs.exists(paths.audio)
				const timings = (yield* fs.exists(paths.timings)) ? yield* fs.readFileString(paths.timings) : null
				checks.push({
					section: section.id,
					published: published.has(section.id),
					state: checkSection(section.transcript, hasAudio, timings),
				})
			}

			const problems = checks.filter((c) => c.state !== "ok")
			const label = `${chapterId}${chapter.draft ? " [draft]" : ""} (${checks.length} sections)`
			if (problems.length === 0) {
				yield* Console.log(`  ✓ ${label}: all narrated and aligned`)
				continue
			}
			yield* Console.log(`  ${label}`)
			for (const check of problems) {
				const isError = check.published && (check.state === "no-audio" || check.state === "stale")
				if (isError) errors++
				else warnings++
				yield* Console.log(`    ${isError ? "✗" : "!"} ${check.section}: ${advice(chapterId, check)}`)
			}
		}

		yield* Console.log(`\n${errors} error(s), ${warnings} warning(s)`)
		if (errors > 0) {
			return yield* Effect.fail(new Error("Published sections need attention (see ✗ above)"))
		}
	}),
).pipe(Command.withDescription("Check ffmpeg, ElevenLabs settings, and every section's audio and timings"))
