import { concat, line, on, section, slot, stack, text } from "@/lib/content"

// ============================================================================
// getCart lines - indentation changes when wrapped in try/catch
// ============================================================================

const fetchDataLine = line(
	"fetchData",
	concat(slot("dataIndent", { base: text("  "), wrapped: text("    ") }), text("const data = await fetchCart(id)")),
)

const parseDataLine = line(
	"parseData",
	concat(slot("parseIndent", { base: text("  "), wrapped: text("    ") }), text("return parseCart(data)")),
)

// ============================================================================
// Section
// ============================================================================

export const catchBlocksGoStale = section("catch-blocks-go-stale", {
	transcript: `
		If a future commit returns an empty cart instead of throwing an \`InvalidCartError\`, that branch becomes dead code.

		If a new error case is added and your catch block isn't updated, congratulations, you will now be paged at 2 a.m.

		The \`Promise\` is broken, because it entirely disregards a fundamental aspect of all earthly programs: the manifold ways in which they might go south.
	`,

	code: {
		animation: stack(
			// checkout function
			line("fn", "async function checkout(cartId: string): Promise<Order> {"),
			line("try", "  try {"),
			line("cart", "    const cart = await getCart(cartId)"),
			line("catch", "  } catch (e) {"),

			// InvalidCartError handler
			line("handler", "    if (e instanceof InvalidCartError) { return [] }"),

			line("else", "    else { throw e }"),
			line("catchClose", "  }"),
			line("fnClose", "}"),

			// getCart function - can be hidden entirely
			slot.optional(
				"getCartFn",
				stack(
					// Spacer
					line("spacer", ""),

					// getCart implementation - lines maintain identity, indentation changes
					line("getCartSig", "async function getCart(id: string): Promise<Cart> {"),

					// New error case (appears in scenario 2)
					slot.optional("newThrow", line("badId", "  if (id.length < 5) throw new BadIdError()")),

					// Try block (appears when wrapping)
					slot.optional("getCartTry", line("tryOpen", "  try {")),

					// Data lines (always present, indentation changes)
					fetchDataLine,
					parseDataLine,

					// Catch block (appears when wrapping)
					slot.optional(
						"getCartCatch",
						stack(
							line("catchOpen", "  } catch (e) {"),
							line(
								"recover",
								concat(
									text("    if (e instanceof InvalidCartError) return "),
									slot("recoverValue", {
										placeholder: text("???"),
										revealed: text("Cart.empty"),
									}),
								),
							),
							line("rethrow", "    throw e"),
							line("catchClose2", "  }"),
						),
					),

					line("getCartClose", "}"),
				),
			),
		),

		base: {
			dataIndent: "base",
			parseIndent: "base",
			getCartFn: "shown",
			getCartTry: "hidden",
			getCartCatch: "hidden",
			recoverValue: "placeholder",
			newThrow: "hidden",
		},

		flow: [
			// P1: "future commit" → focus getCart
			on("commit").focus.range("getCartSig", "getCartClose"),

			// P1: "returns" → wrap in try/catch with placeholder
			on("returns")
				.slots({
					dataIndent: "wrapped",
					parseIndent: "wrapped",
					getCartTry: "shown",
					getCartCatch: "shown",
				})
				.focus.range("getCartSig", "getCartClose")
				.cursor("???"),

			// P1: "empty cart" → reveal Cart.empty
			on("empty").slots({ recoverValue: "revealed" }).focus.range("getCartSig", "getCartClose").cursor("Cart.empty"),

			// P1: "throwing an InvalidCartError" → cursor on 2nd nth (in getCart)
			on("throwing").focus.range("getCartSig", "getCartClose").cursor("InvalidCartError", { nth: 2 }),

			// P1: "that branch" → focus checkout's handler
			on("branch").focus("handler").cursor("InvalidCartError", { nth: 1 }),

			// P1: "dead code" → skull burst from checkout's InvalidCartError
			on("dead")
				.focus("handler")
				.cursor("InvalidCartError", { nth: 1 })
				.burst("InvalidCartError", "💀")
				.sound("spooky"),

			// P2: "new error case" → reset getCart, add new throw
			on("new")
				.slots({
					dataIndent: "base",
					parseIndent: "base",
					getCartTry: "hidden",
					getCartCatch: "hidden",
					newThrow: "shown",
				})
				.focus("badId")
				.cursor("BadIdError"),

			on("catch").focus("catch", "handler", "else", "catchClose", "badId").cursor("BadIdError"),

			// P2: "paged at 2 a.m." → shake the throw line
			on("2")
				.as("paged")
				.focus("else")
				.cursor("e", { after: "throw" })
				.burst("e", "⏰", { after: "throw" })
				.sound("alarm"),

			on("Promise").slots({ getCartFn: "hidden" }),

			// P3: "the manifold ways in which they might go south" - each word gets a burst
			on("manifold").burst("throw", "💣"),

			on("ways").burst("catch", "💥"),

			on("which").burst("InvalidCartError", "🔥"),

			on("they").burst("e", "💀", { after: "throw" }),

			on("might").burst("instanceof", "🧨"),

			on("go").burst("Promise", "🔥"),

			on("south").burst("function", "☠️"),
		],
	},
})
