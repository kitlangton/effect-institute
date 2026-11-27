import { concat, empty, line, on, section, slot, stack, text } from "@/lib/content"

// ============================================================================
// Section: effect-shows-errors
// ============================================================================

export const effectShowsErrors = section("effect-shows-errors", {
	transcript: `
		Here is the **Effect** version of \`slowDie\`.
		It still gets a random number, takes a non-blocking, 1 second nap, and then returns the result.

		Let's make it lethal. If the roll is 4, we will fail with our trusty \`VeryBadRoll\`.

		And finally, we have a type error! The error type propagates from \`Effect.fail\` to the surrounding effect. We are forced to reckon with it.

		Welcome to TypeScript.
	`,

	code: {
		animation: stack(
			// Comment line - always visible, changes based on state
			line(
				"comment",
				concat(
					text(""),
					slot("commentText", {
						intro: text(""),
						error: text("// > VeryBadRoll is not assignable to never"),
						fixed: text(""),
					}),
				),
			),
			// Signature with type annotation - error type animates in
			line(
				"sig",
				concat(
					text("const slowDie: Effect.Effect<number"),
					slot.optional("errorType", text(", VeryBadRoll")),
					text("> ="),
					slot("genInline", {
						inline: text(" Effect.gen(function* () {"),
						hidden: empty,
					}),
				),
			),
			// Effect.gen on its own line (appears when split)
			slot.optional("genLine", line("gen", "  Effect.gen(function* () {")),
			// Random line with inline indent
			line(
				"random",
				concat(
					slot("indent", { normal: text("  "), indented: text("    ") }),
					text("const n = yield* Random.nextIntBetween(1, 6)"),
				),
			),
			// Sleep line with inline indent
			line(
				"sleep",
				concat(slot("indent", { normal: text("  "), indented: text("    ") }), text('yield* Effect.sleep("1 second")')),
			),
			// The fail line (appears in two parts like promise-hides-errors)
			slot.optional(
				"failLine",
				line(
					"fail",
					concat(
						slot("indent", { normal: text("  "), indented: text("    ") }),
						text("if (n === 4)"),
						slot("failAction", {
							hidden: text(" ..."),
							shown: text(" yield* Effect.fail(new VeryBadRoll())"),
						}),
					),
				),
			),
			// Return line with inline indent
			line("return", concat(slot("indent", { normal: text("  "), indented: text("    ") }), text("return n"))),
			// Close line with inline indent
			line("close", concat(slot("closeIndent", { normal: empty, indented: text("  ") }), text("})"))),
		),

		base: {
			commentText: "intro",
			errorType: "hidden",
			genInline: "inline",
			genLine: "hidden",
			indent: "normal",
			closeIndent: "normal",
			failLine: "hidden",
			failAction: "hidden",
		},

		flow: [
			// "Effect version of slowDie" - just cursor, no spotlight
			on("Effect").cursor("Effect.Effect<number>"),
			on("slowDie").cursor("slowDie"),

			// "gets a random number" - focus random line
			on("random").focus("random").cursor("Random.nextIntBetween"),

			// "1 second nap" - focus sleep line
			on("non-blocking").focus("sleep").cursor("Effect.sleep"),

			// "returns the result" - clear focus
			on("result"),

			// "Let's make it lethal" - split Effect.gen to new line, re-indent
			on("lethal").slots({
				genInline: "hidden",
				genLine: "shown",
				indent: "indented",
				closeIndent: "indented",
			}),

			// "If the roll is 4" - show the if check with ???
			on("roll").slots({ failLine: "shown" }).focus("fail").cursor("(n === 4)"),

			// "we will fail with our trusty VeryBadRoll" - complete the line
			on("fail").slots({ failAction: "shown" }).focus("fail").cursor("VeryBadRoll"),

			// "And finally, we have a type error!" - show error in comment + squiggle
			on("finally")
				.slots({ commentText: "error" })
				.squiggle("Effect.Effect<number>", { color: "red", persist: true })
				.focus("comment", "sig"),

			// "propagates from Effect.fail" - cursor on fail call, keep squiggle
			on("propagates").cursor("Effect.fail"),

			// "We are forced to reckon with it" - fix the type, comment says compiles
			on("reckon")
				.slots({ commentText: "fixed", errorType: "shown" })
				.squiggle.clear()
				.cursor("VeryBadRoll")
				.sound("success")
				.burst("VeryBadRoll", "🎉"),

			// "Welcome to TypeScript" - end
			on("TypeScript"),
		],
	},
})
