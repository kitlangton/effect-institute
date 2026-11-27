import { line, on, section, slot, stack } from "@/lib/content"

// ============================================================================
// Section: catch-tag
// ============================================================================

export const catchTag = section("catch-tag", {
	transcript: `
		We can also handle errors one by one.
		With \`catchTag\`, we target \`VeryBadRoll\` specifically and recover with \`-9000\`.

		And once we do, our error type narrows.
		\`TooHigh\` remains because we haven't handled it yet.

		Of course, we can add a second \`catchTag\` and handle \`TooHigh\` by returning zero.
		Now, once again, our effect cannot fail.
	`,

	code: {
		animation: stack(
			// Signature - error type narrows as we catch specific tags
			// "hidden" is a reserved state that always means empty
			line("sig", [
				"const weirdDie: Effect.Effect<number",
				slot("errorType", {
					// shown first = default visible
					shown: [", ", slot("veryBadError", { shown: "VeryBadRoll | " }), slot("tooHighError", { shown: "TooHigh" })],
				}),
				"> =",
			]),

			// Body - starts with slowDie, .pipe( appears with catchTag
			line("slowDieRef", ["  slowDie", slot.optional("pipeShow", ".pipe(")]),

			slot.optional(
				"catchVeryBad",
				line("catchVeryBadLine", [
					"    Effect.catchTag(",
					slot.optional("veryBadTag", '"VeryBadRoll"'),
					slot.optional("veryBadHandler", [
						", (",
						slot("veryBadParam", { typed: "e: VeryBadRoll", empty: "" }),
						") => ",
						slot("veryBadReturn", {
							placeholder: "???",
							complete: "Effect.succeed(-9000)",
						}),
					]),
					")",
					slot.optional("trailingComma", ","),
				]),
			),

			slot.optional(
				"catchTooHigh",
				line("catchTooHighLine", [
					'    Effect.catchTag("TooHigh"',
					slot.optional("tooHighHandler", ", () => Effect.succeed(0)"),
					")",
				]),
			),

			// closing paren - only when piped
			slot.optional("pipeShow", line("pipeClose", "  )")),
		),

		flow: [
			// "one" - cursor on first error type
			on("one").focus("sig").cursor("VeryBadRoll"),

			// "by one" - cursor on second error type
			on("one", { after: "by" }).focus("sig").cursor("TooHigh"),

			// "With" - show .pipe( first
			on("With").slots({ pipeShow: "shown" }).focus("slowDieRef").cursor(".pipe"),

			// "catchTag" - show catchTag with empty parens
			on("catchTag").slots({ catchVeryBad: "shown" }).focus("catchVeryBadLine").cursor("catchTag"),

			// "VeryBadRoll" - show just the tag string
			on("VeryBadRoll").slots({ veryBadTag: "shown" }).focus("catchVeryBadLine").cursor('"VeryBadRoll"'),

			// "specifically" - show the handler with typed param
			on("specifically").slots({ veryBadHandler: "shown" }).focus("catchVeryBadLine").cursor("VeryBadRoll", { nth: 3 }),

			// "with -9000" - complete return, remove typed param
			on("-9000").slots({ veryBadParam: "empty", veryBadReturn: "complete" }).focus("catchVeryBadLine").cursor("-9000"),

			// "error type narrows" - VeryBadRoll disappears, TooHigh remains
			on("error", { after: "our" }).focus("sig").cursor("VeryBadRoll | TooHigh"),

			// "narrows" - VeryBadRoll disappears, TooHigh remains
			on("narrows")
				.slots({ veryBadError: "hidden" })
				.focus("sig")
				.cursor("TooHigh")
				.sound("success")
				.burst("TooHigh", "✂️"),

			// "TooHigh remains" - highlight TooHigh in signature
			on("TooHigh", { after: "narrows" })
				.focus("sig")
				.at("TooHigh", (t) => t.bright().cursor().glow({ color: "red" })),

			// "second catchTag" - add second catchTag with just the tag
			on("second")
				.slots({ catchTooHigh: "shown", trailingComma: "shown" })
				.focus("catchTooHighLine")
				.cursor('"TooHigh"'),

			// "returning zero" - show the handler
			on("zero").slots({ tooHighHandler: "shown" }).focus("catchTooHighLine").cursor("0"),

			// focs on the sig on "once again"
			on("again", { after: "once" }).focus("sig").cursor("TooHigh"),

			// "cannot fail" - error type disappears entirely
			on("fail", { after: "cannot" })
				.slots({ errorType: "hidden" })
				.focus("sig")
				.cursor("number")
				.sound("success")
				.burst("number", "✅"),
		],
	},
})
