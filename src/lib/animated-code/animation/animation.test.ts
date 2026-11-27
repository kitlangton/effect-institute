import { describe, expect, it } from "vitest"
import { concat, empty, line, section, slot, stack, text } from "./animation"
import { type EvaluatedLine, evaluateLines } from "./compile/evaluate"

const textOf = (lines: readonly EvaluatedLine[]) => lines.map((l) => l.text).join("\n")
const idsOf = (lines: readonly EvaluatedLine[]) => lines.map((l) => l.id)

describe("Animation Algebra", () => {
	describe("text", () => {
		it("renders literal text", () => {
			const anim = line("l", text("hello"))
			const output = evaluateLines(anim, {})
			expect(textOf(output)).toBe("hello")
		})
	})

	describe("empty", () => {
		it("renders nothing", () => {
			const output = evaluateLines(empty, {})
			expect(output).toHaveLength(0)
		})
	})

	describe("concat", () => {
		it("joins parts horizontally on same line", () => {
			const anim = line("l", concat(text("const "), text("x"), text(" = 42;")))
			const output = evaluateLines(anim, {})
			expect(textOf(output)).toBe("const x = 42;")
			expect(output).toHaveLength(1)
		})
	})

	describe("stack", () => {
		it("joins parts vertically on different lines", () => {
			const anim = stack(line("a", "line1"), line("b", "line2"), line("c", "line3"))
			const output = evaluateLines(anim, {})
			expect(textOf(output)).toBe("line1\nline2\nline3")
			expect(output).toHaveLength(3)
		})

		it("is associative", () => {
			const a = text("a")
			const b = text("b")
			const c = text("c")

			const left = stack(stack(a, b), c)
			const right = stack(a, stack(b, c))

			expect(textOf(evaluateLines(left, {}))).toBe(textOf(evaluateLines(right, {})))
		})

		it("has empty as identity", () => {
			const a = text("a")

			const withEmpty = stack(a, empty)
			const withoutEmpty = a

			expect(textOf(evaluateLines(withEmpty, {}))).toBe(textOf(evaluateLines(withoutEmpty, {})))
		})
	})

	describe("line", () => {
		it("assigns ID to content", () => {
			const anim = line("my-line", text("content"))
			const output = evaluateLines(anim, {})
			expect(output[0].id).toBe("my-line")
		})

		it("works with string content shorthand", () => {
			const anim = line("sig", "function foo() {")
			const output = evaluateLines(anim, {})
			expect(output[0].id).toBe("sig")
			expect(textOf(output)).toBe("function foo() {")
		})
	})

	describe("section", () => {
		it("namespaces line IDs", () => {
			const anim = section("checkout", stack(line("open", "function checkout() {"), line("close", "}")))
			const output = evaluateLines(anim, {})
			expect(idsOf(output)).toEqual(["checkout/open", "checkout/close"])
		})

		it("supports nested sections", () => {
			const anim = section("outer", section("inner", line("line", "content")))
			const output = evaluateLines(anim, {})
			expect(output[0].id).toBe("outer/inner/line")
		})
	})

	describe("slot", () => {
		it("selects value from environment", () => {
			const anim = line("v", slot("value", { a: text("42"), b: text("84") }))

			expect(textOf(evaluateLines(anim, { value: "a" }))).toBe("42")
			expect(textOf(evaluateLines(anim, { value: "b" }))).toBe("84")
		})

		it("uses first value as default", () => {
			const anim = line("v", slot("value", { first: text("default"), second: text("other") }))

			expect(textOf(evaluateLines(anim, {}))).toBe("default")
		})

		it("hides optional slots by default", () => {
			const anim = line("sig", ["Effect<number", slot.optional("error", ", Error"), ">"])

			expect(textOf(evaluateLines(anim, {}))).toBe("Effect<number>")
			expect(textOf(evaluateLines(anim, { error: "shown" }))).toBe("Effect<number, Error>")
		})

		it("works with string values (auto-wrapped)", () => {
			const anim = slot("kw", { const: "const", let: "let" })

			expect(textOf(evaluateLines(anim, { kw: "const" }))).toBe("const")
			expect(textOf(evaluateLines(anim, { kw: "let" }))).toBe("let")
		})

		it("slot values can be complex animations", () => {
			const anim = slot("body", {
				full: stack(line("b1", "  line1;"), line("b2", "  line2;")),
				collapsed: line("bc", "  // ..."),
			})

			const full = evaluateLines(anim, { body: "full" })
			expect(textOf(full)).toBe("  line1;\n  line2;")
			expect(idsOf(full)).toEqual(["b1", "b2"])

			const collapsed = evaluateLines(anim, { body: "collapsed" })
			expect(textOf(collapsed)).toBe("  // ...")
			expect(idsOf(collapsed)).toEqual(["bc"])
		})
	})

	describe("composition", () => {
		it("concat with slots enables inline animation", () => {
			const anim = line(
				"decl",
				concat(
					slot("kw", { const: "const", let: "let" }),
					text(" x = "),
					slot("val", { num: "42", str: '"hello"' }),
					text(";"),
				),
			)

			expect(textOf(evaluateLines(anim, { kw: "const", val: "num" }))).toBe("const x = 42;")
			expect(textOf(evaluateLines(anim, { kw: "let", val: "str" }))).toBe('let x = "hello";')
		})

		it("same slot name coordinates across sections", () => {
			const checkout = section(
				"checkout",
				slot("active", {
					checkout: line("body", "  // checkout body"),
					getCart: line("body", "  // ..."),
				}),
			)

			const getCart = section(
				"getCart",
				slot("active", {
					checkout: line("body", "  // ..."),
					getCart: line("body", "  // getCart body"),
				}),
			)

			const full = stack(checkout, getCart)

			const snap1 = evaluateLines(full, { active: "checkout" })
			expect(textOf(snap1)).toBe("  // checkout body\n  // ...")

			const snap2 = evaluateLines(full, { active: "getCart" })
			expect(textOf(snap2)).toBe("  // ...\n  // getCart body")
		})

		it("full function example", () => {
			const checkoutBody = slot("body", {
				full: stack(
					line("b1", "  const cart = await getCart(cartId);"),
					line("b2", "  const payment = await charge(cart);"),
					line("b3", "  return shipment;"),
				),
				collapsed: line("bc", "  // ..."),
			})

			const checkout = section(
				"checkout",
				stack(
					line("open", "async function checkout(cartId: string): Promise<Order> {"),
					checkoutBody,
					line("close", "}"),
				),
			)

			const getCart = section(
				"getCart",
				stack(
					line("open", "async function getCart(cartId: string): Promise<Cart> {"),
					line("body", "  return fetch(...);"),
					line("close", "}"),
				),
			)

			const fullAnimation = stack(
				checkout,
				slot("below", {
					none: empty,
					showGetCart: stack(line("blank", ""), getCart),
				}),
			)

			// Snapshot 0: full checkout, nothing below
			const snap0 = evaluateLines(fullAnimation, { body: "full", below: "none" })
			expect(idsOf(snap0)).toEqual(["checkout/open", "checkout/b1", "checkout/b2", "checkout/b3", "checkout/close"])

			// Snapshot 1: collapsed checkout, getCart below
			const snap1 = evaluateLines(fullAnimation, {
				body: "collapsed",
				below: "showGetCart",
			})
			expect(idsOf(snap1)).toEqual([
				"checkout/open",
				"checkout/bc",
				"checkout/close",
				"blank",
				"getCart/open",
				"getCart/body",
				"getCart/close",
			])

			// Line IDs are stable: checkout/open is same in both
			expect(snap0[0].id).toBe(snap1[0].id)
			expect(snap0[0].id).toBe("checkout/open")
		})
	})

	describe("edge cases", () => {
		it("keeps a blank line a slot shows, like the compiled frame", () => {
			const anim = stack(line("a", "a"), slot.optional("gap", line("blank", "")), line("b", "b"))
			expect(idsOf(evaluateLines(anim, {}))).toEqual(["a", "b"])
			expect(textOf(evaluateLines(anim, { gap: "shown" }))).toBe("a\n\nb")
		})

		it("handles empty slot value", () => {
			const anim = slot("extra", {
				none: empty,
				some: line("extra", "extra content"),
			})

			expect(evaluateLines(anim, { extra: "none" })).toHaveLength(0)
			expect(textOf(evaluateLines(anim, { extra: "some" }))).toBe("extra content")
		})

		it("handles deeply nested slots", () => {
			const inner = slot("inner", {
				a: text("A"),
				b: text("B"),
			})

			const outer = slot("outer", {
				useA: inner,
				useB: slot("inner", { a: text("X"), b: text("Y") }),
			})

			const anim = line("v", outer)
			expect(textOf(evaluateLines(anim, { outer: "useA", inner: "a" }))).toBe("A")
			expect(textOf(evaluateLines(anim, { outer: "useA", inner: "b" }))).toBe("B")
			expect(textOf(evaluateLines(anim, { outer: "useB", inner: "a" }))).toBe("X")
		})
	})
})
