import { describe, expect, it } from "vitest"
import { concat, empty, line, section, slot, stack, text } from "./animation"
import { getLineIds, render, toPlainText } from "./render"

describe("Animation Algebra", () => {
	describe("text", () => {
		it("renders literal text", () => {
			const anim = text("hello")
			const output = render(anim, {})
			expect(toPlainText(output)).toBe("hello")
		})
	})

	describe("empty", () => {
		it("renders nothing", () => {
			const output = render(empty, {})
			expect(output.lines).toHaveLength(0)
		})
	})

	describe("concat", () => {
		it("joins parts horizontally on same line", () => {
			const anim = concat(text("const "), text("x"), text(" = 42;"))
			const output = render(anim, {})
			expect(toPlainText(output)).toBe("const x = 42;")
			expect(output.lines).toHaveLength(1)
		})
	})

	describe("stack", () => {
		it("joins parts vertically on different lines", () => {
			const anim = stack(text("line1"), text("line2"), text("line3"))
			const output = render(anim, {})
			expect(toPlainText(output)).toBe("line1\nline2\nline3")
			expect(output.lines).toHaveLength(3)
		})

		it("is associative", () => {
			const a = text("a")
			const b = text("b")
			const c = text("c")

			const left = stack(stack(a, b), c)
			const right = stack(a, stack(b, c))

			expect(toPlainText(render(left, {}))).toBe(toPlainText(render(right, {})))
		})

		it("has empty as identity", () => {
			const a = text("a")

			const withEmpty = stack(a, empty)
			const withoutEmpty = a

			expect(toPlainText(render(withEmpty, {}))).toBe(toPlainText(render(withoutEmpty, {})))
		})
	})

	describe("line", () => {
		it("assigns ID to content", () => {
			const anim = line("my-line", text("content"))
			const output = render(anim, {})
			expect(output.lines[0].id).toBe("my-line")
		})

		it("works with string content shorthand", () => {
			const anim = line("sig", "function foo() {")
			const output = render(anim, {})
			expect(output.lines[0].id).toBe("sig")
			expect(toPlainText(output)).toBe("function foo() {")
		})
	})

	describe("section", () => {
		it("namespaces line IDs", () => {
			const anim = section("checkout", stack(line("open", "function checkout() {"), line("close", "}")))
			const output = render(anim, {})
			expect(getLineIds(output)).toEqual(["checkout/open", "checkout/close"])
		})

		it("supports nested sections", () => {
			const anim = section("outer", section("inner", line("line", "content")))
			const output = render(anim, {})
			expect(output.lines[0].id).toBe("outer/inner/line")
		})
	})

	describe("slot", () => {
		it("selects value from environment", () => {
			const anim = slot("value", {
				a: text("42"),
				b: text("84"),
			})

			expect(toPlainText(render(anim, { value: "a" }))).toBe("42")
			expect(toPlainText(render(anim, { value: "b" }))).toBe("84")
		})

		it("uses first value as default", () => {
			const anim = slot("value", {
				first: text("default"),
				second: text("other"),
			})

			expect(toPlainText(render(anim, {}))).toBe("default")
		})

		it("hides optional slots by default", () => {
			const anim = line("sig", ["Effect<number", slot.optional("error", ", Error"), ">"])

			expect(toPlainText(render(anim, {}))).toBe("Effect<number>")
			expect(toPlainText(render(anim, { error: "shown" }))).toBe("Effect<number, Error>")
		})

		it("works with string values (auto-wrapped)", () => {
			const anim = slot("kw", { const: "const", let: "let" })

			expect(toPlainText(render(anim, { kw: "const" }))).toBe("const")
			expect(toPlainText(render(anim, { kw: "let" }))).toBe("let")
		})

		it("slot values can be complex animations", () => {
			const anim = slot("body", {
				full: stack(line("b1", "  line1;"), line("b2", "  line2;")),
				collapsed: line("bc", "  // ..."),
			})

			const full = render(anim, { body: "full" })
			expect(toPlainText(full)).toBe("  line1;\n  line2;")
			expect(getLineIds(full)).toEqual(["b1", "b2"])

			const collapsed = render(anim, { body: "collapsed" })
			expect(toPlainText(collapsed)).toBe("  // ...")
			expect(getLineIds(collapsed)).toEqual(["bc"])
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

			expect(toPlainText(render(anim, { kw: "const", val: "num" }))).toBe("const x = 42;")
			expect(toPlainText(render(anim, { kw: "let", val: "str" }))).toBe('let x = "hello";')
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

			const snap1 = render(full, { active: "checkout" })
			expect(toPlainText(snap1)).toBe("  // checkout body\n  // ...")

			const snap2 = render(full, { active: "getCart" })
			expect(toPlainText(snap2)).toBe("  // ...\n  // getCart body")
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
			const snap0 = render(fullAnimation, { body: "full", below: "none" })
			expect(getLineIds(snap0)).toEqual([
				"checkout/open",
				"checkout/b1",
				"checkout/b2",
				"checkout/b3",
				"checkout/close",
			])

			// Snapshot 1: collapsed checkout, getCart below
			const snap1 = render(fullAnimation, {
				body: "collapsed",
				below: "showGetCart",
			})
			expect(getLineIds(snap1)).toEqual([
				"checkout/open",
				"checkout/bc",
				"checkout/close",
				"blank",
				"getCart/open",
				"getCart/body",
				"getCart/close",
			])

			// Line IDs are stable: checkout/open is same in both
			expect(snap0.lines[0].id).toBe(snap1.lines[0].id)
			expect(snap0.lines[0].id).toBe("checkout/open")
		})
	})

	describe("edge cases", () => {
		it("handles empty slot value", () => {
			const anim = slot("extra", {
				none: empty,
				some: text("extra content"),
			})

			expect(render(anim, { extra: "none" }).lines).toHaveLength(0)
			expect(toPlainText(render(anim, { extra: "some" }))).toBe("extra content")
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

			expect(toPlainText(render(outer, { outer: "useA", inner: "a" }))).toBe("A")
			expect(toPlainText(render(outer, { outer: "useA", inner: "b" }))).toBe("B")
			expect(toPlainText(render(outer, { outer: "useB", inner: "a" }))).toBe("X")
		})
	})
})
