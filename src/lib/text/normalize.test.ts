import { describe, expect, it } from "vitest"
import { normalizeWord, wordMatchesRef } from "./normalize"

describe("normalizeWord", () => {
	it("lowercases and strips common punctuation", () => {
		expect(normalizeWord("TypeScript.")).toBe("typescript")
	})

	it("strips angle brackets for generic-looking words", () => {
		expect(normalizeWord("Promise<Order>")).toBe("promiseorder")
	})

	it("handles code-like words", () => {
		expect(normalizeWord("Effect.sync")).toBe("effectsync")
		expect(normalizeWord("new Date()")).toBe("new date")
	})
})

describe("wordMatchesRef", () => {
	it("matches exact after normalization", () => {
		expect(wordMatchesRef("Promise<Order>", "promiseorder")).toBe(true)
	})

	it("matches ref as prefix (3+ chars)", () => {
		expect(wordMatchesRef("Promise<Order>", "Promise")).toBe(true)
	})

	it("does not match in reverse (directional)", () => {
		expect(wordMatchesRef("Promise", "Promise<Order>")).toBe(false)
	})

	it("does not allow prefix matching for very short refs", () => {
		expect(wordMatchesRef("Promise<Order>", "Pr")).toBe(false)
	})
})
