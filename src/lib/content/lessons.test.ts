import { createHash } from "node:crypto"
import basics from "@content/basics/index.ts"
import intro from "@content/intro/index.ts"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { slideshowFor } from "@/backend/services/course/builder"
import { expandFrame } from "@/lib/neo-code-block/compress"
import type { Frame, TemplateSlideshowData } from "@/lib/neo-code-block/types"
import { compileSectionsWithGroups } from "./compile"

/**
 * Every lesson's code animation, frame by frame, exactly as the player receives it.
 * Update a hash only for an intended visual change, and say which lesson and step changed.
 */
const expected: Record<string, string> = {
	"basics/branch-type-merging": "f0102ee587116291",
	"basics/effect-fail": "691e2c63a6ee6331",
	"basics/effect-gen-syntax": "e79f9aedb51f8d8f",
	"basics/effect-is-a-description": "f7d76482c639a8bc",
	"basics/effect-promise": "c8db2ae157a9d507",
	"basics/effect-promise-fix": "27a9fb6d79ac33db",
	"basics/effect-succeed": "69fe74862f954647",
	"basics/effect-sync": "0cff20c2f7b8df8e",
	"basics/errors-short-circuit": "35dc1ad772bf39a8",
	"basics/gen-type-inference": "df2969ee65d42f59",
	"basics/generators-vs-promises": "3bc6a51577102fb8",
	"basics/promises-are-eager": "b19f4d7818ce55da",
	"basics/running-effects": "9b3aa81023fd30f3",
	"basics/sync-vs-succeed": "0023f409dd67e96a",
	"basics/types-capture-runtime": "44136fa355b3678a",
	"basics/why-compose": "3393d6a35272ce6a",
	"intro/abort-signal-infusion": "1079d958e0ca42d4",
	"intro/catch-blocks-go-stale": "c0221574f46eec8a",
	"intro/catch-tag": "3a09c4ddabab71b9",
	"intro/catching-errors": "80652dc1ee597b8c",
	"intro/effect-shows-errors": "7e15e02f88cf1fe3",
	"intro/effect-structured-concurrency": "2eee5a6ccb61a4ce",
	"intro/errors-are-invisible": "5451ca61e74be7e5",
	"intro/errors-compose": "c618eb26d2151acb",
	"intro/promise-abort-ceremony": "ff45ac2d8e73f0cf",
	"intro/promise-hides-errors": "8d0764ad29733c43",
	"intro/promises-only-happy-path": "80a7637e22ecf52c",
	"intro/runaway-promises": "f3d519942ff726f9",
	"intro/the-scenario": "9cc7074986f4ea04",
	"intro/try-catch-gives-unknown": "31ad711d5a2e9cac",
	"intro/welcome": "44136fa355b3678a",
	"intro/welcome-controls": "44136fa355b3678a",
	"intro/welcome-feedback": "44136fa355b3678a",
}

/** The render frame with overlays resolved to line IDs, so the comparison survives wire-format changes. */
function normalize(frame: Frame) {
	const lineId = (index: number) => frame.lines[index]?.lineId ?? `#${index}`
	const byLineId = (ranges: Record<number, unknown>) =>
		Object.fromEntries(
			Object.entries(ranges)
				.map(([index, value]) => [lineId(Number(index)), value] as const)
				.sort(([a], [b]) => a.localeCompare(b)),
		)
	const overlay = ({ lineIndex, ...rest }: { lineIndex: number }) => ({ lineId: lineId(lineIndex), ...rest })
	return {
		...frame,
		marks: frame.marks.map(overlay),
		glows: frame.glows.map(overlay),
		squiggles: frame.squiggles.map(overlay),
		brightRanges: frame.brightRanges.map(overlay),
		bursts: frame.bursts.map(overlay),
		cursor: frame.cursor && overlay(frame.cursor),
		spotlight: frame.spotlight && { ...frame.spotlight, ranges: byLineId(frame.spotlight.ranges) },
		status: frame.status && { ...frame.status, ranges: byLineId(frame.status.ranges) },
	}
}

/** JSON with sorted keys, so property order never changes a hash. */
const canonical = (value: unknown): string =>
	JSON.stringify(value, (_key, v: unknown) =>
		v && typeof v === "object" && !Array.isArray(v)
			? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
			: v,
	)

const render = async () => {
	const hashes: Record<string, string> = {}
	for (const chapter of [intro, basics]) {
		for (const section of compileSectionsWithGroups(chapter, { includeDrafts: true })) {
			const built: Effect.Effect<{ slideshowData: TemplateSlideshowData | undefined; steps: unknown }> =
				slideshowFor(section)
			const { slideshowData, steps } = await Effect.runPromise(built)
			const frames = slideshowData?.frames.map((state) => normalize(expandFrame(state, slideshowData.template)))
			const digest = createHash("sha256").update(canonical({ frames, steps })).digest("hex")
			hashes[`${chapter.id}/${section.id}`] = digest.slice(0, 16)
		}
	}
	return hashes
}

describe("lesson code animations", () => {
	it("render every frame exactly as before", async () => {
		expect(await render()).toEqual(expected)
	}, 60_000)
})
