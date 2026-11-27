import { describe, expect, it } from "vitest"
import { type AnimationDef, line, slot, stack } from "@/lib/animated-code/animation"
import { compileAndTokenize } from "@/lib/animated-code/animation/compile-with-tokens"
import { compress, expand, expandFrame } from "./compress"
import type { Token } from "./highlighter"
import type { Frame, FrameLine, FramePart, SlideshowData } from "./types"

// ============================================================================
// Fixture builders
// ============================================================================

const RED = "#F97583"
const BLUE = "#79B8FF"
const WHITE = "#E1E4E8"
const ORANGE = "#FFAB70"

const tok = (text: string, color?: string): Token => ({ text, type: "default", ...(color && { color }) })

const part = (
	partId: string,
	tokens: Token[],
	opts: Partial<Omit<FramePart, "partId" | "tokens">> = {},
): FramePart => ({
	partId,
	tokens,
	motionKey: partId,
	crossfade: false,
	animateEntry: false,
	isVisible: true,
	...opts,
})

const hidden = (partId: string, tokens: Token[], opts: Partial<Omit<FramePart, "partId" | "tokens">> = {}) =>
	part(partId, tokens, { ...opts, isVisible: false })

const ln = (
	lineId: string,
	parts: FramePart[],
	opts: Partial<Omit<FrameLine, "lineId" | "parts">> = {},
): FrameLine => ({
	lineId,
	parts,
	text: parts
		.filter((p) => p.isVisible)
		.flatMap((p) => p.tokens.map((t) => t.text))
		.join(""),
	entering: false,
	dimmed: false,
	...opts,
})

const frame = (id: number, lines: FrameLine[], extra: Partial<Omit<Frame, "id" | "lines">> = {}): Frame => ({
	id,
	lines,
	marks: [],
	glows: [],
	squiggles: [],
	brightRanges: [],
	bursts: [],
	...extra,
})

const slideshow = (...frames: Frame[]): SlideshowData => ({ frames })

/** Round-trip and assert every frame reads back exactly as authored. */
function expectLossless(data: SlideshowData) {
	const original = structuredClone(data)
	const compressed = compress(data)
	// Must survive JSON serialization (that is how it ships)
	const shipped = JSON.parse(JSON.stringify(compressed)) as typeof compressed

	expect(shipped.frames).toHaveLength(original.frames.length)
	original.frames.forEach((source, i) => {
		const expanded = expandFrame(shipped.frames[i], shipped.template)
		expect(expanded.id).toBe(source.id)
		expect(expanded.lines.map((l) => l.lineId)).toEqual(source.lines.map((l) => l.lineId))

		for (const sourceLine of source.lines) {
			const expandedLine = expanded.lines.find((l) => l.lineId === sourceLine.lineId)!
			expect(expandedLine.entering, `frame ${i} ${sourceLine.lineId} entering`).toBe(sourceLine.entering)
			expect(expandedLine.dimmed, `frame ${i} ${sourceLine.lineId} dimmed`).toBe(sourceLine.dimmed)
			expect(expandedLine.background).toBe(sourceLine.background)
			expect(expandedLine.text, `frame ${i} ${sourceLine.lineId} text`).toBe(sourceLine.text)

			for (const sourcePart of sourceLine.parts) {
				const expandedPart = expandedLine.parts.find((p) => p.partId === sourcePart.partId)!
				const where = `frame ${i} ${sourceLine.lineId}/${sourcePart.partId}`
				expect(expandedPart, where).toBeDefined()
				expect(expandedPart.isVisible, `${where} visibility`).toBe(sourcePart.isVisible)
				if (sourcePart.isVisible) expect(expandedPart.tokens, `${where} tokens`).toEqual(sourcePart.tokens)
			}
			// Parts the template knows but this frame lacks read back as hidden
			for (const expandedPart of expandedLine.parts) {
				if (!sourceLine.parts.some((p) => p.partId === expandedPart.partId)) {
					expect(expandedPart.isVisible).toBe(false)
				}
			}
		}

		expect(expanded.marks).toEqual(source.marks)
		expect(expanded.glows).toEqual(source.glows)
		expect(expanded.squiggles).toEqual(source.squiggles)
		expect(expanded.brightRanges).toEqual(source.brightRanges)
		expect(expanded.bursts).toEqual(source.bursts)
		expect(expanded.cursor).toEqual(source.cursor)
		expect(expanded.spotlight).toEqual(source.spotlight)
		expect(expanded.status).toEqual(source.status)
		expect(expanded.sound).toEqual(source.sound)
		expect(expanded.say).toEqual(source.say)
	})
	return shipped
}

const partAt = (data: ReturnType<typeof compress>, frameIndex: number, lineId: string, partId: string) =>
	expandFrame(data.frames[frameIndex], data.template)
		.lines.find((l) => l.lineId === lineId)!
		.parts.find((p) => p.partId === partId)!

// ============================================================================
// Tests
// ============================================================================

describe("compress / expandFrame round trip", () => {
	describe("empty input", () => {
		it("handles a slideshow with no frames", () => {
			const compressed = compress(slideshow())
			expect(compressed).toEqual({ template: { lines: {} }, frames: [] })
			expect(expand(compressed)).toEqual({ frames: [] })
		})

		it("handles frames with no lines", () => {
			const compressed = expectLossless(slideshow(frame(0, []), frame(1, [])))
			expect(compressed.template.lines).toEqual({})
			expect(expandFrame(compressed.frames[1], compressed.template).lines).toEqual([])
		})

		it("handles an empty frame between populated frames", () => {
			const a = ln("a", [part("p0", [tok("const", RED), tok(" x", WHITE)])])
			expectLossless(slideshow(frame(0, [a]), frame(1, []), frame(2, [a])))
		})

		it("handles a line with no parts and a visible part with no tokens", () => {
			expectLossless(slideshow(frame(0, [ln("blank", []), ln("empty", [part("p0", [])])])))
		})
	})

	describe("static content", () => {
		it("stores an unchanging part once, with no versions", () => {
			const a = () => ln("a", [part("p0", [tok("const", RED), tok(" x = 1", WHITE)])])
			const compressed = expectLossless(slideshow(frame(0, [a()]), frame(1, [a()]), frame(2, [a()])))

			expect(compressed.template.lines.a.parts.p0.versions).toBeUndefined()
			expect(compressed.frames.map((f) => f.state.a.parts.p0)).toEqual([true, true, true])
		})

		it("preserves multiple lines, their order changes, and per-line flags", () => {
			const header = ln("header", [part("p0", [tok("function", RED), tok(" main() {", WHITE)])])
			const body = ln("body", [part("p0", [tok("  return", RED), tok(" 1", BLUE)])])
			const close = ln("close", [part("p0", [tok("}", WHITE)])])

			expectLossless(
				slideshow(
					frame(0, [header, close]),
					frame(1, [header, { ...body, entering: true }, close]),
					frame(2, [
						{ ...header, dimmed: true },
						{ ...body, background: "error" },
						{ ...close, dimmed: true },
					]),
					frame(3, [close, header]),
				),
			)
		})

		it("places a part first seen in a later frame where that frame renders it", () => {
			const compressed = expectLossless(
				slideshow(
					frame(0, [ln("a", [part("p0", [tok("x")]), part("p2", [tok(";")])])]),
					frame(1, [ln("a", [part("p0", [tok("x")]), part("p1", [tok(" = 1")]), part("p2", [tok(";")])])]),
				),
			)
			expect(compressed.template.lines.a.partOrder).toEqual(["p0", "p1", "p2"])
		})

		it("passes inline variants and entry animation flags through", () => {
			const compressed = expectLossless(
				slideshow(frame(0, [ln("out", [part("p0", [tok("42")], { inline: "output", animateEntry: true })])])),
			)
			const expanded = partAt(compressed, 0, "out", "p0")
			expect(expanded.inline).toBe("output")
			expect(expanded.animateEntry).toBe(true)
		})

		it("passes per-frame annotations through untouched", () => {
			const a = ln("a", [part("p0", [tok("yield", RED), tok("* fetch()", WHITE)])])
			expectLossless(
				slideshow(
					frame(0, [a]),
					frame(1, [a], {
						marks: [{ lineIndex: 0, start: 0, end: 5, color: "yellow" }],
						glows: [{ lineIndex: 0, start: 7, end: 12 }],
						squiggles: [{ lineIndex: 0, start: 7, end: 12, color: "red" }],
						brightRanges: [{ lineIndex: 0, start: 0, end: 5 }],
						cursor: { lineIndex: 0, charOffset: 7, textLength: 5, type: "hand" },
						bursts: [{ lineIndex: 0, charOffset: 0, textLength: 5, emoji: ["🎉"], count: 5 }],
						spotlight: {
							ranges: { 0: [{ start: 0, end: 5 }] },
							allRanges: { a: [{ start: 0, end: 5 }] },
							dim: 0.4,
							glow: false,
						},
						status: {
							ranges: { 0: [{ start: 7, end: 12, status: "running" }] },
							allRanges: { a: [{ start: 7, end: 12 }] },
						},
						sound: "pop",
						say: "nice",
					}),
				),
			)
		})
	})

	describe("visibility", () => {
		it("round-trips parts that are hidden, missing, or reappear", () => {
			const shown = part("p1", [tok(": number", BLUE)])
			expectLossless(
				slideshow(
					frame(0, [ln("sig", [part("p0", [tok("x")]), hidden("p1", [tok(": number")])])]),
					frame(1, [ln("sig", [part("p0", [tok("x")]), shown])]),
					frame(2, [ln("sig", [part("p0", [tok("x")])])]),
					frame(3, [ln("sig", [part("p0", [tok("x")]), shown])]),
				),
			)
		})

		it("uses the first visible (highlighted) tokens as the default, not raw hidden tokens", () => {
			const compressed = expectLossless(
				slideshow(
					frame(0, [ln("a", [hidden("p0", [tok("string")])])]),
					frame(1, [ln("a", [part("p0", [tok("string", BLUE)])])]),
				),
			)
			expect(compressed.template.lines.a.parts.p0.tokens).toEqual([tok("string", BLUE)])
			// Hidden frames still carry the highlighted tokens for exit animations
			expect(partAt(compressed, 0, "a", "p0").tokens).toEqual([tok("string", BLUE)])
		})

		it("keeps raw tokens for a part that is never visible", () => {
			const compressed = expectLossless(slideshow(frame(0, [ln("a", [hidden("p0", [tok("todo")])])])))
			expect(compressed.template.lines.a.parts.p0.tokens).toEqual([tok("todo")])
		})
	})

	describe("token color changes across frames", () => {
		it("keeps each frame's colors when a static part is re-highlighted with the same text", () => {
			// e.g. `: string` is a type annotation in one frame and parsed as a parameter in another
			const typeColors = [tok(":", RED), tok(" ", WHITE), tok("string", BLUE)]
			const paramColors = [tok(": string", ORANGE)]
			const compressed = expectLossless(
				slideshow(
					frame(0, [ln("sig", [part("p0", typeColors)])]),
					frame(1, [ln("sig", [part("p0", paramColors)])]),
					frame(2, [ln("sig", [part("p0", typeColors)])]),
				),
			)

			const versions = compressed.template.lines.sig.parts.p0.versions!
			expect(Object.values(versions)).toEqual([typeColors, paramColors])
			// Distinct keys even though the text is identical
			expect(new Set(compressed.frames.map((f) => f.state.sig.parts.p0)).size).toBe(2)
			expect(compressed.frames[0].state.sig.parts.p0).toBe(compressed.frames[2].state.sig.parts.p0)
		})

		it("does not crossfade a non-crossfade part whose colors change", () => {
			const compressed = expectLossless(
				slideshow(
					frame(0, [ln("a", [part("p0", [tok("x", RED)])])]),
					frame(1, [ln("a", [part("p0", [tok("x", BLUE)])])]),
				),
			)
			expect(partAt(compressed, 0, "a", "p0").motionKey).toBe("p0")
			expect(partAt(compressed, 1, "a", "p0").motionKey).toBe("p0")
			expect(partAt(compressed, 1, "a", "p0").activeVersionKey).not.toBe(
				partAt(compressed, 0, "a", "p0").activeVersionKey,
			)
		})

		it("treats a different token split of the same text as a distinct rendering", () => {
			expectLossless(
				slideshow(
					frame(0, [ln("a", [part("p0", [tok("const", RED), tok(" x", WHITE)])])]),
					frame(1, [ln("a", [part("p0", [tok("const x", WHITE)])])]),
					frame(2, [ln("a", [part("p0", [tok("co", RED), tok("nst", RED), tok(" x", WHITE)])])]),
				),
			)
		})

		it("treats tokens gaining or losing a color as distinct renderings", () => {
			expectLossless(
				slideshow(
					frame(0, [ln("a", [part("p0", [tok("x")])])]),
					frame(1, [ln("a", [part("p0", [tok("x", BLUE)])])]),
					frame(2, [ln("a", [part("p0", [tok("x")])])]),
				),
			)
		})

		it("handles color changes on several lines at once", () => {
			expectLossless(
				slideshow(
					frame(0, [
						ln("l1", [part("p0", [tok("a", RED)]), part("p1", [tok("b", BLUE)])]),
						ln("l2", [part("p0", [tok("c", RED)])]),
					]),
					frame(1, [
						ln("l1", [part("p0", [tok("a", BLUE)]), part("p1", [tok("b", BLUE)])]),
						ln("l2", [part("p0", [tok("c", WHITE)])]),
					]),
					frame(2, [
						ln("l1", [part("p0", [tok("a", RED)]), part("p1", [tok("b", ORANGE)])]),
						ln("l2", [part("p0", [tok("c", RED)])]),
					]),
				),
			)
		})
	})

	describe("crossfade parts", () => {
		const cf = (tokens: Token[]) => part("slot", tokens, { crossfade: true })

		it("stores each text version once and keys frames by text", () => {
			const compressed = expectLossless(
				slideshow(
					frame(0, [ln("call", [cf([tok("await", RED), tok(" fetch()", WHITE)])])]),
					frame(1, [ln("call", [cf([tok("Effect.runPromise", WHITE)])])]),
					frame(2, [ln("call", [cf([tok("await", RED), tok(" fetch()", WHITE)])])]),
				),
			)
			expect(Object.keys(compressed.template.lines.call.parts.slot.versions!)).toEqual([
				"await fetch()",
				"Effect.runPromise",
			])
			expect(compressed.frames.map((f) => f.state.call.parts.slot)).toEqual([
				"await fetch()",
				"Effect.runPromise",
				"await fetch()",
			])
			expect(partAt(compressed, 1, "call", "slot").motionKey).toBe("slot-Effect.runPromise")
		})

		it("separates same-text versions with different colors", () => {
			expectLossless(
				slideshow(
					frame(0, [ln("a", [cf([tok("value", BLUE)])])]),
					frame(1, [ln("a", [cf([tok("other", WHITE)])])]),
					frame(2, [ln("a", [cf([tok("value", ORANGE)])])]),
				),
			)
		})

		it("round-trips an empty-text version that is visible", () => {
			// slot.optional-style values: "" is a real, visible version
			const compressed = expectLossless(
				slideshow(
					frame(0, [ln("a", [cf([tok(" // ???", WHITE)])])]),
					frame(1, [ln("a", [cf([])])]),
					frame(2, [ln("a", [cf([tok(" // throws", WHITE)])])]),
				),
			)
			expect(compressed.frames[1].state.a.parts.slot).toBe("")
			expect(partAt(compressed, 1, "a", "slot").isVisible).toBe(true)
			expect(partAt(compressed, 1, "a", "slot").tokens).toEqual([])
		})

		it("keeps an empty first version when later frames fill the part in", () => {
			// Regression: empty first tokens used to be overwritten, so every frame showed the later text
			const compressed = expectLossless(
				slideshow(
					frame(0, [ln("a", [cf([])])]),
					frame(1, [ln("a", [cf([tok("y === 0", WHITE)])])]),
					frame(2, [ln("a", [cf([])])]),
				),
			)
			expect(partAt(compressed, 2, "a", "slot").tokens).toEqual([])
		})

		it("lists every version on expanded parts with the active key", () => {
			const compressed = expectLossless(
				slideshow(
					frame(0, [ln("a", [cf([tok("one")])])]),
					frame(1, [ln("a", [cf([tok("two")])])]),
					frame(2, [ln("a", [])]),
				),
			)
			const p1 = partAt(compressed, 1, "a", "slot")
			expect(p1.versions?.map((v) => v.key)).toEqual(["one", "two"])
			expect(p1.activeVersionKey).toBe("two")
			// Hidden frame falls back to the default (first) version
			expect(partAt(compressed, 2, "a", "slot").activeVersionKey).toBe("one")
		})
	})

	it("is stable under compress(expand(compress(data)))", () => {
		const data = slideshow(
			frame(0, [ln("a", [part("p0", [tok("x", RED)]), part("s", [tok("1")], { crossfade: true })])]),
			frame(1, [ln("a", [part("p0", [tok("x", BLUE)]), part("s", [tok("2")], { crossfade: true })])]),
			frame(2, [ln("a", [part("p0", [tok("x", RED)]), hidden("s", [tok("1")], { crossfade: true })])]),
		)
		const once = compress(structuredClone(data))
		expect(compress(expand(once))).toEqual(once)
	})

	it("is lossless on Shiki-highlighted animations whose slots change neighbouring colors", async () => {
		const def: AnimationDef = {
			animation: stack(
				line("sig", [
					"const classify = (code",
					slot("param", { bare: "", typed: ": number" }),
					")",
					slot("ret", { none: "", typed: ": Effect<string>" }),
					" => ",
					slot("body", { str: '"ok"', call: "Effect.succeed(code)" }),
				]),
				line("mock", ['vi.mock("./flags", () => ({ isEnable', slot("end", { good: "d", bad: "" }), ": vi.fn() }))"]),
			),
			snapshots: [
				{ param: "bare", ret: "none", body: "str", end: "good" },
				{ param: "typed", ret: "none", body: "str", end: "bad" },
				{ param: "typed", ret: "typed", body: "call", end: "bad" },
				{ param: "bare", ret: "typed", body: "call", end: "good" },
			],
		}
		expectLossless(await compileAndTokenize(def, "typescript"))
	})
})
