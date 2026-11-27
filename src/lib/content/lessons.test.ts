import { createHash } from "node:crypto"
import basics from "@content/basics/index.ts"
import intro from "@content/intro/index.ts"
import { describe, expect, it } from "vitest"
import { compileSlideshow } from "@/lib/animated-code/animation"
import { expandFrame, type Frame } from "@/lib/animated-code/slideshow"
import { compileSectionsWithGroups } from "./compile"

/**
 * Every lesson's code animation, frame by frame, exactly as the player receives it.
 * Update a hash only for an intended visual change, and say which lesson and step changed.
 */
const expected: Record<string, string> = {
	"basics/branch-type-merging": "4f62d88dfa5f0cce",
	"basics/effect-fail": "9a60c43301c523cf",
	"basics/effect-gen-syntax": "e79f9aedb51f8d8f",
	"basics/effect-is-a-description": "f7d76482c639a8bc",
	"basics/effect-promise": "c8db2ae157a9d507",
	"basics/effect-promise-fix": "21f57c6f17138fa4",
	"basics/effect-succeed": "528dd00ad706cd86",
	"basics/effect-sync": "3527222abcf63b27",
	"basics/errors-short-circuit": "2ad3db77c2ec8b75",
	"basics/gen-type-inference": "cc12750cc945e356",
	"basics/generators-vs-promises": "3bc6a51577102fb8",
	"basics/promises-are-eager": "17c58adb736d5d9b",
	"basics/running-effects": "1e1f7661a501da62",
	"basics/sync-vs-succeed": "0421cd52efdda1d0",
	"basics/types-capture-runtime": "44136fa355b3678a",
	"basics/why-compose": "3393d6a35272ce6a",
	"intro/abort-signal-infusion": "1079d958e0ca42d4",
	"intro/catch-blocks-go-stale": "c0221574f46eec8a",
	"intro/catch-tag": "e9c8ef16fcb531c8",
	"intro/catching-errors": "5b7696acdc530a94",
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
			const slideshowData = section.animation && (await compileSlideshow(section.animation))
			const steps = section.animation?.steps
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
