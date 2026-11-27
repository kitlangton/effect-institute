import { concat, line, on, section, slot, stack, text } from "@/lib/content"

export const promisesOnlyHappyPath = section("promises-only-happy-path", {
	transcript: `
	  **Behold!** A \`checkout\` function returning a \`Promise<Order>\`. Internally, it calls three more async functions.
		What will happen when we call it?

		A \`Promise\` has but one type parameter: its success value. Here, that's the \`Order\` we hope to get.

		But can \`checkout\` fail? And if it does, *how* will it fail? Unfortunately, \`Promise\` is not very forthcoming in this regard.
	`,

	code: {
		animation: stack(
			line("sig", "async function checkout(cartId: string): Promise<Order> {"),
			line("cart", "  const cart = await getCart(cartId)"),
			line("payment", "  const payment = await charge(cart)"),
			line("shipment", "  const shipment = await ship(payment)"),
			line("return", "  return shipment"),
			line("close", "}"),
			slot.optional(
				"callLine",
				stack(
					"",
					line(
						"call",
						concat(
							text('checkout("cart-123")'),
							slot("callComment", {
								question: text(" // ???"),
								error: text(" // throws SomeError"),
							}),
						),
					),
				),
			),
		),

		base: { callLine: "hidden", callComment: "hidden" },

		flow: [
			// "A checkout function" - spotlight checkout
			on("checkout").focus({ text: "checkout" }).cursor("checkout"),

			// "returning a Promise<Order>" - spotlight Promise<Order>
			on("promiseorder").focus({ text: "Promise<Order>" }).cursor("Promise<Order>"),

			// "Internally" - clear spotlight
			on("Internally").cursor("Promise<Order>"),

			// "three more async functions" - focus on getCart line
			on("three").focus("cart").cursor("getCart"),

			// "more async functions" - focus on charge line
			on("more").focus("payment").cursor("charge"),

			// "async functions" - focus on ship line
			on("async").focus("shipment").cursor("ship", { persist: true }),

			// "What will happen" - clear focus (no cursor, no focus)
			on("What"),

			// "when we call it" - show the call line
			on("call").after("we").slots({ callLine: "shown" }).cursor("cart-123"),

			// "success value" - spotlight Promise<Order> with glow
			on("type").focus({ text: "Promise<Order>" }).cursor("Promise<Order>").glow("Promise<Order>", { color: "blue" }),

			// "the Order we hope to get" - spotlight Order with glow
			on("Order").focus({ text: "Order" }).cursor("Order").glow("Order", { color: "blue" }),

			// "can checkout fail?" - show question comment
			on("fail").after("can").slots({ callComment: "question" }).cursor("???"),

			// "how will it fail?" - show error comment
			on("how").slots({ callComment: "error" }).cursor("SomeError"),

			// "Unfortunately, Promise is not very forthcoming" - sad emoji + sound
			on("forthcoming").slots({ callLine: "hidden", callComment: "hidden" }).burst("Promise", "😢").sound("sad"),
		],
	},
})
