import { concat, line, on, section, slot, stack, text } from "@/lib/content"

export const errorsAreInvisible = section("errors-are-invisible", {
	transcript: `
		This problem is fractal, of course. Our call to \`getCart\`, which presumably returns a \`Promise<Cart>\`,
		is just as opaque.

		To know how it might fail, we have to read its implementation. And then, we must recursively read any definitions it references, and so on.

		Perhaps we'd rather trust the docstring, if there is one, and pray it's up to date.
	`,

	code: {
		animation: stack(
			// The checkout function (same as previous section ends with)
			line("sig", "async function checkout(cartId: string): Promise<Order> {"),
			line(
				"cart",
				concat(text("  const cart"), slot.optional("cartType", text(": Cart")), text(" = await getCart(cartId)")),
			),
			line("payment", "  const payment = await charge(cart)"),
			line("shipment", "  const shipment = await ship(payment)"),
			line("return", "  return shipment"),
			line("close", "}"),

			// getCart implementation (appears on "implementation")
			slot.optional(
				"getCartImpl",
				stack(
					"",
					slot.optional("docstring", line("docstring", "/** This never fails, I promise */")),
					line("getCartSig", "async function getCart(id: string): Promise<Cart> {"),
					slot.optional(
						"getCartBody",
						stack(
							line("fetchCart", "  const data = await fetchCart(id)"),
							line("parseCart", "  return parseCart(data)"),
						),
					),
					line("getCartClose", "}"),

					// fetchCart implementation (appears on "definitions")
					slot.optional(
						"fetchCartImpl",
						stack(
							"",
							line("fetchCartSig", "async function fetchCart(id: string): Promise<RawCart> {"),
							line("fetchCartBody", '  throw new Error("Not implemented")'),
							line("fetchCartClose", "}"),
						),
					),
				),
			),
		),

		base: {
			cartType: "hidden",
			getCartImpl: "hidden",
			getCartBody: "shown",
			fetchCartImpl: "hidden",
			docstring: "hidden",
		},

		flow: [
			// "our call to getCart" - focus on getCart line
			on("getCart").focus("cart").cursor("getCart"),

			// "Promise<Cart>" - show type annotation
			on("promisecart").focus("cart").slots({ cartType: "shown" }).cursor("Cart"),

			// "is just as opaque" - clear focus
			on("opaque"),

			on("its").focus("cart"),

			// "read its implementation" - expand getCart
			on("implementation")
				.slots({ getCartImpl: "shown" })
				.focus("getCartSig", "fetchCart", "parseCart", "getCartClose"),

			on("any").focus("fetchCart"),

			// "definitions it references" - expand fetchCart
			on("definitions").slots({ fetchCartImpl: "shown" }).focus("fetchCartSig", "fetchCartBody", "fetchCartClose"),

			// "trust the docstring" - show docstring, hide fetchCart impl
			on("docstring").slots({ fetchCartImpl: "hidden", docstring: "shown" }),
		],
	},
})
