import { concat, line, on, section, slot, stack, text } from "@/lib/content"

// ============================================================================
// The getCart line - gets indented when wrapped in try
// ============================================================================

const getCartLine = line(
	"cart",
	concat(
		slot("cartIndent", {
			base: text("  "),
			wrapped: text("    "),
		}),
		text("const cart = await getCart(cartId)"),
	),
)

// ============================================================================
// Section
// ============================================================================

export const tryCatchGivesUnknown = section("try-catch-gives-unknown", {
	transcript: `
		So how do you deal with exploding Promises? You wrap your code in a try/catch block.

		Tragically, the error you catch is always of type \`unknown\`, which is of little help. To handle it, you must pattern match, guided by what you've learned through your prior code spelunking.

		Alas, the type checker will not warn you if your assumptions were wrong, or if they change in the future.
	`,

	code: {
		animation: stack(
			// Function signature
			line("fn", "async function checkout(cartId: string): Promise<Order> {"),

			// Try opening (appears when wrapping getCart)
			slot.optional("tryOpen", line("try", "  try {")),

			// The getCart line (gets more indented when wrapped)
			getCartLine,

			// Catch block with progressive error matches
			slot.optional(
				"catchBlock",
				stack(
					line("catch", concat(text("  } catch (e"), slot.optional("annotation", text(": unknown")), text(") {"))),
					slot.optional("placeholder", line("dots", "    // ...")),
					slot.optional("match1", line("err1", "    if (e instanceof CartNotFoundError) { /* 404 */ }")),
					slot.optional("match2", line("err2", "    else if (e instanceof NetworkTimeoutError) { /* retry */ }")),
					slot.optional(
						"match3",
						stack(
							line("err3", "    else if (e instanceof RateLimitError) { /* wait */ }"),
							line("else", "    else { throw e }"),
						),
					),
					line("catchClose", "  }"),
				),
			),

			// Rest of function (always visible)
			line("payment", "  const payment = await charge(cart)"),
			line("shipment", "  const shipment = await ship(payment)"),
			line("return", "  return shipment"),
			line("fnClose", "}"),
		),

		// Initial slot state (time 0)
		base: {
			cartIndent: "base",
			tryOpen: "hidden",
			catchBlock: "hidden",
			annotation: "hidden",
			placeholder: "hidden",
			match1: "hidden",
			match2: "hidden",
			match3: "hidden",
		},

		// Step definitions - each step is self-contained
		flow: [
			// Focus on getCart when "exploding" is spoken
			on("exploding").as("focus-cart").focus("cart"),

			// Wrap in try/catch when "try/catch" is spoken
			on("try/catch")
				.slots({
					cartIndent: "wrapped",
					tryOpen: "shown",
					catchBlock: "shown",
					placeholder: "shown",
				})
				.focus.range("try", "catchClose"),

			// Show `: unknown` annotation
			on("unknown").slots({ annotation: "shown" }).focus({ text: "(e: unknown)" }).cursor("unknown"),

			// First error match
			on("pattern").as("match1").slots({ placeholder: "hidden", match1: "shown" }).cursor("CartNotFoundError"),

			// Second error match
			on("guided").as("match2").slots({ match2: "shown" }).cursor("NetworkTimeoutError"),

			// Third error match + else
			on("spelunking").as("match3").slots({ match3: "shown" }).cursor("RateLimitError"),
		],
	},
})
