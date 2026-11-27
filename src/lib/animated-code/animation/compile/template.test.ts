import { describe, expect, it } from "vitest"
import { type CodeSlideshow, expandFrame, type Token } from "../../slideshow"
import { type AnimationDef, line, slot, stack } from "../animation"
import { compile, compileSlideshow } from "./compile"
import { type Highlight, typescriptHighlighter } from "./highlight"

const RED = "#red"
const WHITE = "#white"
const GRAY = "#gray"

/** Colors depend on context: everything after `//` is a comment; `const` is a keyword otherwise. */
const contextual: Highlight = (code) => {
	const comment = code.indexOf("//")
	let offset = 0
	return (code.match(/\w+|\s+|[^\w\s]+/g) ?? []).map((text): Token => {
		const start = offset
		offset += text.length
		const color = comment !== -1 && start >= comment ? GRAY : text === "const" ? RED : WHITE
		return { text, type: "default", color }
	})
}

const partAt = (slideshow: CodeSlideshow, frame: number, lineId: string, index: number) => {
	const expanded = expandFrame(slideshow.frames[frame], slideshow.template)
	const part = expanded.lines.find((l) => l.lineId === lineId)?.parts[index]
	if (!part) throw new Error(`no part ${index} on ${lineId} in frame ${frame}`)
	return part
}

const partIdAt = (slideshow: CodeSlideshow, lineId: string, index: number) =>
	slideshow.template.lines[lineId].partOrder[index]

/** Per character: [char, color], for comparing highlighting regardless of token splits */
const chars = (tokens: readonly Token[]) =>
	tokens.flatMap((t) => [...t.text].map((char) => [char, t.color ?? null] as const))

describe("compile: template and frame states", () => {
	it("stores an unchanging part once, with no versions", () => {
		const slideshow = compile(
			{
				animation: stack(line("a", "const x = 1")),
				snapshots: [
					{ slots: {}, annotations: [] },
					{ slots: {}, annotations: [] },
					{ slots: {}, annotations: [] },
				],
			},
			contextual,
		)
		const partId = partIdAt(slideshow, "a", 0)
		expect(slideshow.template.lines.a.parts[partId].versions).toBeUndefined()
		expect(slideshow.frames.map((f) => f.state.a.parts[partId])).toEqual([true, true, true])
	})

	it("keeps each frame's colors when an earlier slot changes how a static part highlights", () => {
		const slideshow = compile(
			{
				animation: stack(line("a", [slot("lead", { code: "", comment: "// " }), "const x"])),
				snapshots: [
					{ slots: { lead: "code" }, annotations: [] },
					{ slots: { lead: "comment" }, annotations: [] },
					{ slots: { lead: "code" }, annotations: [] },
				],
			},
			contextual,
		)
		const keyword = [
			{ text: "const", type: "default", color: RED },
			{ text: " ", type: "default", color: WHITE },
			{ text: "x", type: "default", color: WHITE },
		]
		const commented = keyword.map((t) => ({ ...t, color: GRAY }))
		expect(partAt(slideshow, 0, "a", 1).tokens).toEqual(keyword)
		expect(partAt(slideshow, 1, "a", 1).tokens).toEqual(commented)
		expect(partAt(slideshow, 2, "a", 1).tokens).toEqual(keyword)

		// Same text, two renderings: distinct version keys, but no crossfade
		const states = slideshow.frames.map((f) => f.state.a.parts[partIdAt(slideshow, "a", 1)])
		expect(states).toEqual(["const x", "const x\u00001", "const x"])
		expect(partAt(slideshow, 1, "a", 1).motionKey).toBe(partIdAt(slideshow, "a", 1))
	})

	it("uses the first highlighted rendering for frames where the part is hidden", () => {
		const slideshow = compile(
			{
				animation: stack(line("a", ["x", slot.optional("kw", " const")])),
				snapshots: [
					{ slots: {}, annotations: [] },
					{ slots: { kw: "shown" }, annotations: [] },
				],
			},
			contextual,
		)
		const hidden = partAt(slideshow, 0, "a", 1)
		expect(hidden.isVisible).toBe(false)
		expect(hidden.tokens).toEqual(partAt(slideshow, 1, "a", 1).tokens)
		expect(hidden.tokens.some((t) => t.color === RED)).toBe(true)
	})

	it("keeps a visible empty version distinct from hidden", () => {
		const slideshow = compile(
			{
				animation: stack(line("a", ["x", slot("note", { todo: " // ???", none: "", done: " // ok" })])),
				snapshots: [
					{ slots: { note: "todo" }, annotations: [] },
					{ slots: { note: "none" }, annotations: [] },
					{ slots: { note: "done" }, annotations: [] },
				],
			},
			contextual,
		)
		expect(slideshow.frames[1].state.a.parts[partIdAt(slideshow, "a", 1)]).toBe("")
		expect(partAt(slideshow, 1, "a", 1).isVisible).toBe(true)
		expect(partAt(slideshow, 1, "a", 1).tokens).toEqual([])
		expect(
			partAt(slideshow, 2, "a", 1)
				.tokens.map((t) => t.text)
				.join(""),
		).toBe(" // ok")
	})

	it("lists every version with the active key, falling back to the first while hidden", () => {
		const slideshow = compile({
			animation: stack(line("a", ["v = ", slot.optional("value", slot("n", { one: "1", two: "2" }))])),
			snapshots: [
				{ slots: {}, annotations: [] },
				{ slots: { value: "shown", n: "one" }, annotations: [] },
				{ slots: { value: "shown", n: "two" }, annotations: [] },
			],
		})
		const shown = partAt(slideshow, 2, "a", 1)
		expect(shown.versions?.map((v) => v.key)).toEqual(["1", "2"])
		expect(shown.activeVersionKey).toBe("2")
		expect(shown.motionKey).toBe(`${shown.partId}-2`)
		expect(partAt(slideshow, 0, "a", 1).activeVersionKey).toBe("1")
	})

	it("survives JSON, the way it ships", () => {
		const def: AnimationDef = {
			animation: stack(line("a", ["const x", slot("t", { none: "", num: ": number" })])),
			snapshots: [
				{ slots: { t: "none" }, annotations: [] },
				{ slots: { t: "num" }, annotations: [] },
			],
		}
		const slideshow = compile(def, contextual)
		expect(JSON.parse(JSON.stringify(slideshow))).toEqual(slideshow)
	})
})

describe("compileSlideshow: TypeScript highlighting", () => {
	const linesOf = (slideshow: CodeSlideshow, frame: number) =>
		expandFrame(slideshow.frames[frame], slideshow.template).lines.map((l) =>
			l.parts.filter((p) => p.isVisible).flatMap((p) => p.tokens),
		)

	it("highlights each frame's visible line text exactly as Shiki highlights the whole line", async () => {
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
				line("lead", [
					"  ",
					slot("start", { placeholder: "// ...", code: "const [" }),
					slot.optional("rest", "] = await Promise.all(["),
				]),
			),
			snapshots: [
				{ slots: { param: "bare", ret: "none", body: "str", end: "good", start: "placeholder" }, annotations: [] },
				{
					slots: { param: "typed", ret: "none", body: "str", end: "bad", start: "code", rest: "shown" },
					annotations: [],
				},
				{ slots: { param: "typed", ret: "typed", body: "call", end: "bad", start: "placeholder" }, annotations: [] },
				{
					slots: { param: "bare", ret: "typed", body: "call", end: "good", start: "code", rest: "shown" },
					annotations: [],
				},
			],
		}
		const highlight = await typescriptHighlighter()
		const slideshow = await compileSlideshow(def)
		for (const frame of slideshow.frames.keys()) {
			for (const tokens of linesOf(slideshow, frame)) {
				const text = tokens.map((t) => t.text).join("")
				expect(chars(tokens), `frame ${frame}: ${text}`).toEqual(chars(highlight(text)))
			}
		}
	})

	it("does not let hidden parts change the highlighting of visible ones", async () => {
		const slideshow = await compileSlideshow({
			animation: stack(
				line("first", [
					"  ",
					slot("start", { placeholder: "// ...", code: "const [" }),
					slot.optional("rest", "] = await Promise.all(["),
				]),
			),
			snapshots: [
				{ slots: { start: "placeholder" }, annotations: [] },
				{ slots: { start: "code", rest: "shown" }, annotations: [] },
			],
		})
		const [placeholder] = linesOf(slideshow, 0)
		expect(placeholder.map((t) => t.text).join("")).toBe("  // ...")
		const [code] = linesOf(slideshow, 1)
		expect(code.find((t) => t.text === "await")?.color).toBe("#F97583")
	})
})
