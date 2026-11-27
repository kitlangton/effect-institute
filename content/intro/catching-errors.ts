import { code, concat, line, on, section, slot, stack } from "@/lib/content"

// ============================================================================
// Section: catching-errors
// ============================================================================

export const catchingErrors = section("catching-errors", {
	transcript: `
	  Now, let's see how Effect deals with failure.
		First, we'll create \`safeDie\`, which wraps \`slowDie\` and recovers from its errors.

		To do this, we use \`catch\`, passing it a function that handles
		whatever error \`slowDie\` produces by returning another effect. We'll succeed with 0.

		And with that, the error type becomes \`never\`.
		Just as useful as knowing when and how something might fail is knowing that it cannot.
	`,

	code: {
		animation: stack(
			// Signature - name and error type change
			line(
				"sig",
				concat(
					"const ",
					slot("name", { slowDie: "slowDie", safeDie: "safeDie" }),
					": Effect.Effect<number",
					slot("comma", { shown: ", " }),
					slot("errorType", {
						both: "VeryBadRoll | TooHigh",
						never: "never",
					}),
					"> =",
				),
			),

			// Body - full definition or wrapped call
			slot("body", {
				full: code(2)`
					Effect.gen(function* () {
						const n = yield* Random.nextIntBetween(1, 6)
						yield* Effect.sleep("1 second")
						if (n === 4) yield* Effect.fail(new VeryBadRoll())
						if (n === 6) yield* Effect.fail(new TooHigh())
						return n
					})
				`,
				wrapped: stack(
					// slowDie line - always visible, .pipe( is conditional
					line("slowDieRef", concat("  slowDie", slot.hidden("pipeShow", ".pipe("))),
					// catchLine controlled separately via catchShow slot
					slot.hidden(
						"catchShow",
						line(
							"catchLine",
							concat(
								"    Effect.catch(",
								// Arrow function structure - once shown, parens are stable
								slot.hidden(
									"arrow",
									concat(
										"(",
										slot("param", {
											none: "",
											typed: "e: VeryBadRoll | TooHigh",
										}),
										") => ",
										slot("handler", {
											unknown: "???",
											succeed: "Effect.succeed(0)",
										}),
									),
								),
								")",
							),
						),
					),
					// closing paren - only when piped
					slot.hidden("pipeShow", line("pipeClose", "  )")),
				),
			}),
		),

		// base omitted - first slot values are defaults

		flow: [
			// "deals with failure" - glow on error type, no line focus
			on("failure")
				.focus({ text: "VeryBadRoll | TooHigh" })
				.glow("VeryBadRoll | TooHigh", { color: "blue" })
				.cursor("VeryBadRoll | TooHigh"),

			// "we'll create safeDie" - body becomes slowDie (bare), bright safeDie
			on("create")
				.slots({ name: "safeDie", body: "wrapped" })
				.bright("safeDie")
				.glow("safeDie", { color: "blue" })
				.cursor("safeDie"),

			// "wraps slowDie" - bright slowDie
			on("wraps").bright("slowDie").glow("slowDie", { color: "blue" }).cursor("slowDie", { persist: true }),

			// "we use catch" - pipe wrapping appears, then catch line
			on("use").slots({ pipeShow: "shown" }),
			on("catch").slots({ catchShow: "shown" }).focus("catchLine").cursor("catch"),

			// "passing it a function" - show () => ???
			on("function").slots({ arrow: "shown" }).focus("catchLine").cursor("() => ???"),

			// "whatever error slowDie produces" - show typed error param (after catch)
			on("error")
				.after("whatever")
				.slots({ param: "typed" })
				.focus("catchLine")
				.bright("VeryBadRoll | TooHigh", { nth: 2 })
				.cursor("e: VeryBadRoll | TooHigh"),

			// "We'll succeed with 0"
			on("succeed").slots({ param: "none", handler: "succeed" }).focus("catchLine").cursor("0"),

			// "error type becomes never"
			on("never").slots({ errorType: "never" }).focus("sig").cursor("never").sound("success").burst("never", "✅"),

			// "knowing that it cannot" - error type disappears entirely
			on("just").after("never").slots({ comma: "hidden", errorType: "hidden" }),
		],
	},
})
