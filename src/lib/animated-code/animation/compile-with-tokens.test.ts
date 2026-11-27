import { describe, expect, it } from "@effect/vitest"
import type { AnimationDef } from "./animation"
import { line, slot, stack } from "./animation"
import { compileAndTokenize } from "./compile-with-tokens"

describe("compileAndTokenize", () => {
	it("tokenizes visible parts with correct syntax highlighting", async () => {
		const animation = stack(line("fn", "async function test() {"), line("body", "  return 42"), line("end", "}"))

		const def: AnimationDef = {
			animation,
			snapshots: [{}],
		}

		const result = await compileAndTokenize(def, "typescript")
		const fnLine = result.frames[0].lines.find((l) => l.lineId === "fn")

		// Should have syntax highlighting colors
		const colors = fnLine?.parts.flatMap((p) => p.tokens.map((t) => t.color))
		expect(colors?.some((c) => c && c !== "#E1E4E8")).toBe(true) // Has non-default colors
	})

	it("handles slot transitions without breaking tokenization", async () => {
		// This is the pattern that was broken: comment placeholder followed by real code
		const animation = stack(
			line("firstLine", [
				"  ",
				slot("lineStart", {
					placeholder: "// ...",
					code: "const x",
				}),
				slot.optional("lineEnd", " = 1"),
			]),
		)

		const def: AnimationDef = {
			animation,
			snapshots: [
				{ lineStart: "placeholder" }, // Frame 0: "  // ..."
				{ lineStart: "code", lineEnd: "shown" }, // Frame 1: "  const x = 1"
			],
		}

		const result = await compileAndTokenize(def, "typescript")

		// Frame 0: Should tokenize "// ..." as a comment (gray)
		const f0 = result.frames[0].lines.find((l) => l.lineId === "firstLine")
		const f0Text = f0?.parts
			.filter((p) => p.isVisible)
			.flatMap((p) => p.tokens.map((t) => t.text))
			.join("")
		expect(f0Text).toBe("  // ...")

		// Frame 1: Should tokenize "const x = 1" with proper highlighting
		const f1 = result.frames[1].lines.find((l) => l.lineId === "firstLine")
		const f1Text = f1?.parts
			.filter((p) => p.isVisible)
			.flatMap((p) => p.tokens.map((t) => t.text))
			.join("")
		expect(f1Text).toBe("  const x = 1")

		// The "const" keyword should have syntax highlighting (not comment gray)
		const constPart = f1?.parts.find((p) => p.tokens.some((t) => t.text === "const"))
		const constToken = constPart?.tokens.find((t) => t.text === "const")
		expect(constToken?.color).toBe("#F97583") // keyword color in github-dark
	})

	it("does not let hidden parts pollute tokenization", async () => {
		// The bug: hidden "lineEnd" text was included in tokenization,
		// causing "// ...] = await Promise.all([" to be tokenized as one big comment
		const animation = stack(
			line("firstLine", [
				"  ",
				slot("lineStart", {
					placeholder: "// ...",
					code: "const [",
				}),
				slot.optional("lineEnd", "] = await Promise.all(["),
			]),
		)

		const def: AnimationDef = {
			animation,
			snapshots: [
				{ lineStart: "placeholder" }, // lineEnd hidden
				{ lineStart: "code", lineEnd: "shown" },
			],
		}

		const result = await compileAndTokenize(def, "typescript")

		// In frame 1, "await" should be highlighted as a keyword, not gray
		const f1 = result.frames[1].lines.find((l) => l.lineId === "firstLine")
		const lineEndPart = f1?.parts.find((p) => p.tokens.some((t) => t.text.includes("await")))

		// Find the await token
		const awaitToken = lineEndPart?.tokens.find((t) => t.text === "await")
		expect(awaitToken).toBeDefined()
		expect(awaitToken?.color).toBe("#F97583") // keyword color, NOT #6A737D (comment gray)
	})
})
