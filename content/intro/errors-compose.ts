import { concat, line, on, section, slot, stack, text } from "@/lib/content"

// ============================================================================
// Section: errors-compose
// ============================================================================

export const errorsCompose = section("errors-compose", {
	transcript: `
		Let's see what happens when we add a second failure case.

    I've always found 6 to be rather bumptious.
		So whenever it is rolled, the effect will fail with \`TooHigh\`.

		The very moment we update our code, the type changes.
		The error type becomes the union of all possible failures,
		perfectly modeling the actual runtime behavior of our program.
	`,
	glossary: {
		bumptious: "Self-assertive to an irritating degree; pushy.",
	},

	code: {
		animation: stack(
			// Dictionary definition - appears briefly on "bumptious"
			slot.optional(
				"definition",
				stack(
					line("def1", "// bumptious /ˈbʌmp.ʃəs/ adj."),
					line("def2", "//   self-assertive to an irritating degree"),
					line("def3", ""),
				),
			),
			// Type annotation line - error type expands
			line(
				"sig",
				concat(
					text("const slowDie: Effect.Effect<number, VeryBadRoll"),
					slot.optional("tooHighPart", text(" | TooHigh")),
					text("> ="),
				),
			),
			line("gen", "  Effect.gen(function* () {"),
			line("random", "    const n = yield* Random.nextIntBetween(1, 6)"),
			line("sleep", '    yield* Effect.sleep("1 second")'),
			line("fail4", "    if (n === 4) yield* Effect.fail(new VeryBadRoll())"),
			// The second fail line - appears in two steps (condition, then action)
			slot.optional(
				"fail6Line",
				line(
					"fail6",
					concat(
						text("    if (n === 6)"),
						slot("fail6Action", {
							hidden: text(" ..."),
							shown: text(" yield* Effect.fail(new TooHigh())"),
						}),
					),
				),
			),
			line("return", "    return n"),
			line("close", "  })"),
		),

		base: {
			definition: "hidden",
			tooHighPart: "hidden",
			fail6Line: "hidden",
			fail6Action: "hidden",
		},

		flow: [
			// "Let's see what happens when we add a second failure case"
			on("see"),

			// "I've always found 6 to be rather bumptious" - show dictionary definition
			on("bumptious").slots({ definition: "shown" }).focus("def1", "def2"),
			on("so").slots({ definition: "hidden" }),

			// "So whenever it is rolled" - hide definition, show the condition with ???
			on("rolled").slots({ fail6Line: "shown" }).focus("fail6").cursor("(n === 6)"),

			// "the effect will fail with TooHigh" - reveal the full action
			on("TooHigh").after("rolled").slots({ fail6Action: "shown" }).focus("fail6").cursor("TooHigh"),

			// "The very moment we update our code" - focus on signature
			on("moment").focus("sig").cursor("VeryBadRoll"),

			// "the type changes" - show the union type
			on("changes").slots({ tooHighPart: "shown" }).cursor("| TooHigh").sound("success").burst("TooHigh", "🎉"),

			// "The error type becomes the union of all possible failures"
			on("union").focus({ text: "VeryBadRoll | TooHigh" }),

			// "perfectly modeling the actual runtime behavior"
			on("modeling"),
		],
	},
})
