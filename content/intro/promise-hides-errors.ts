import { concat, line, on, section, slot, stack, text } from "@/lib/content"

// ============================================================================
// Section: promise-hides-errors
// ============================================================================

export const promiseHidesErrors = section("promise-hides-errors", {
	transcript: `
		To see how Effect helps, we'll write the same function twice, beginning with
		the Promise version. \`slowDie\` rolls a die, waits for no reason, and then returns the result.

		We will then outlaw 4, and pronounce its rolling to be punishable by death.
		If that accursed numeral has appeared, we will throw a \`VeryBadRoll\` error.

		Nevertheless, it continues to type-check. TypeScript doesn't care.
		Our feeble human mind is solely responsible for tracking this.
	`,

	code: {
		animation: stack(
			// Function signature with return type
			line(
				"sig",
				concat(
					text("async function slowDie(): "),
					slot("returnType", {
						base: text("Promise<number>"),
					}),
					text(" {"),
				),
			),
			// Generate random number
			line("random", "  const n = Math.ceil(Math.random() * 6)"),
			// Sleep before returning
			line("sleep", "  await sleep(1000)"),
			// The throw line (appears in two parts)
			slot.optional(
				"throwLine",
				line(
					"throw",
					concat(
						text("  if (n === 4)"),
						slot("throwAction", {
							hidden: text(" ..."),
							shown: text(" throw new VeryBadRoll()"),
						}),
					),
				),
			),
			// Return statement
			line("return", "  return n"),
			line("close", "}"),
		),

		base: {
			returnType: "base",
			throwLine: "hidden",
			throwAction: "hidden",
		},

		flow: [
			// "Promise version of slowDie" - spotlight function name
			on("slowDie").focus({ text: "slowDie" }).cursor("slowDie"),

			// "rolls a die" - focus on random line
			on("rolls").focus("random").cursor("Math.random"),

			// "waits for no reason" - focus on sleep line
			on("waits").focus("sleep").cursor("sleep"),

			// "returns the result" - focus on return line
			on("returns").focus("return").cursor("return n"),

			// "outlaw 4" - clear focus, let it breathe
			on("outlaw"),

			// "If ..." - show the if check with ???
			on("If").slots({ throwLine: "shown" }).focus("throw").cursor("(n === 4)"),

			// "VeryBadRoll" - complete the line
			on("VeryBadRoll", { after: "throw" }).slots({ throwAction: "shown" }).focus("throw").cursor("VeryBadRoll"),

			on("continues"),

			// "It continues to type-check" - spotlight Promise<number> with checkmark
			on("type-check").sound("success").burst("Promise<number>", "✅"),
		],
	},
})
