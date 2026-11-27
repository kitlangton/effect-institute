import { line, on, section, slot, stack } from "@/lib/content"

// ============================================================================
// Section: the-scenario
// ============================================================================

export const theScenario = section("the-scenario", {
	transcript: `
		Say you're a penurious pantheist in need of stock advice.

		Naturally, you consult an LLM council comprised of a tree,
		an obscure star system, and a dung beetle.

		\`Promise.all\` kicks off all three queries in parallel,
		so you'll get your answer in no time.
		Soon you'll have a golden hovel all your own.

		What could possibly go wrong?
	`,
	glossary: {
		penurious: "Extremely poor; poverty-stricken.",
		pantheist: "One who believes God and the universe are identical; that the divine pervades all things.",
	},

	code: {
		animation: stack(
			line("fn", "async function getStockAdvice(ticker: string) {"),
			// First line - starts as comment, becomes destructuring
			// Structure for maximum stability: const [ and ] = await Promise.all([ stay stable
			line("firstLine", [
				"  ",
				slot("lineStart", {
					placeholder: "// ...",
					code: "const [",
				}),
				slot.optional("treeVar", "tree"),
				slot.optional("starVar", ", star"),
				slot.optional("beetleVar", ", beetle"),
				slot.optional("lineEnd", "] = await Promise.all(["),
			]),
			// Each query line with optional result comment
			// Commas appear when next line arrives
			slot.optional("treeLine", line("tree", ['    ask("tree", ticker)', slot.optional("treeComma", ",")])),
			slot.optional("treeResult", line("treeResult", '    // "Hold. Forever. Very still."')),
			slot.optional("starLine", line("star", ['    ask("Zubenelgenubi", ticker)', slot.optional("starComma", ",")])),
			slot.optional("starResult", line("starResult", '    // "A bit of a tail risk."')),
			slot.optional("beetleLine", line("beetle", '    ask("dung beetle", ticker)')),
			slot.optional("beetleResult", line("beetleResult", '    // "Sell. Buy $POOP."')),
			// Close bracket - appears with structure
			slot.optional("close", line("close", "  ])")),
			// Return line - grows as we add entities
			// Structure for stability: return { and } stay stable, only vars change
			slot.optional(
				"retLine",
				line("ret", [
					"  return {",
					slot.optional("treeRet", " tree"),
					slot.optional("starRet", ", star"),
					slot.optional("beetleRet", ", beetle"),
					" }",
				]),
			),
			line("end", "}"),
		),

		base: { lineStart: "placeholder" },

		flow: [
			// "council" - show empty Promise.all structure
			on("council").slots({
				lineStart: "code",
				lineEnd: "shown",
				close: "shown",
				retLine: "shown",
			}),

			// "tree" - add tree to all three places (no comma yet)
			on("tree")
				.slots({ treeVar: "shown", treeLine: "shown", treeRet: "shown" })
				.focus({ text: 'ask("tree"', dim: 0.8 })
				.glow('"tree"', { color: "blue" })
				.cursor('"tree"'),

			// "star system" - add star, and comma to tree line
			on("system")
				.slots({ starVar: "shown", starLine: "shown", starRet: "shown", treeComma: "shown" })
				.focus({ text: 'ask("Zubenelgenubi"', dim: 0.8 })
				.glow('"Zubenelgenubi"', { color: "blue" })
				.cursor('"Zubenelgenubi"'),

			// "dung beetle" - add beetle, and comma to star line (beetle has no trailing comma)
			on("beetle")
				.slots({ beetleVar: "shown", beetleLine: "shown", beetleRet: "shown", starComma: "shown" })
				.focus({ text: 'ask("dung beetle"', dim: 0.8 })
				.glow('"dung beetle"', { color: "blue" })
				.cursor('"dung beetle"'),

			// "kicks off" - highlight the combinator
			on("kicks").focus.clear().cursor("Promise.all"),

			// "parallel" - show all running
			on("parallel")
				.status('ask("tree", ticker)', "running")
				.status('ask("Zubenelgenubi", ticker)', "running")
				.status('ask("dung beetle", ticker)', "running")
				.sound("whoosh"),

			// "answer" - all complete, show ridiculous advice
			on("answer")
				.status('ask("tree", ticker)', "success")
				.status('ask("Zubenelgenubi", ticker)', "success")
				.status('ask("dung beetle", ticker)', "success")
				.slots({
					treeResult: "shown",
					starResult: "shown",
					beetleResult: "shown",
				})
				.sound("succeed"),
		],
	},
})

// ============================================================================
// Section: runaway-promises
// ============================================================================

export const runawayPromises = section("runaway-promises", {
	transcript: `
		Your \`ask\` function queries a language model,
		which is flakier and costlier than your average API.

		What if Zubenelgenubi implodes?
		\`Promise.all\` will reject immediately,
		while tree and beetle keep churning,
		draining your already parched coffers for nothing.

		Promise-strewn code is prone to leakage.
		Once created, promises run to completion,
		whether or not they're still required.
	`,
	glossary: {
		zubenelgenubi: "The alpha star of Libra, ~77 light-years away. Arabic for 'the southern claw.'",
	},

	code: {
		animation: stack(
			// The ask function definition
			line("askFn", "function ask(role: string, ticker: string) {"),
			line("askBody1", "  return generateText({"),
			line("askBody2", "    model: anthropic('claude-opus-4-5'),"),
			line("askBody3", "    system: `You are a ${role}. Give stock advice.`,"),
			line("askBody4", "    prompt: ticker,"),
			line("askBody5", "  })"),
			line("askEnd", "}"),
			line("blank", ""),
			// The getStockAdvice function
			line("getFn", "async function getStockAdvice(ticker: string) {"),
			line("destructure", "  const [tree, star, beetle] = await Promise.all(["),
			// Each ask call - status indicator rendered after the pattern match
			line("treeCall", '    ask("tree", ticker),'),
			line("starCall", '    ask("Zubenelgenubi", ticker),'),
			line("beetleCall", '    ask("dung beetle", ticker)'),
			line("closeAll", "  ])"),
			line("return", "  return { tree, star, beetle }"),
			line("getEnd", "}"),
		),

		flow: [
			// "ask" - highlight the ask function definition
			on("ask").focus({ text: "function ask(", dim: 0.7 }).cursor("ask", { nth: 1 }),

			// "language model" - highlight the model
			on("model")
				.focus({ text: "anthropic('claude-opus-4-5')", dim: 0.7 })
				.cursor("claude-opus-4-5", { persist: true }),

			// "flakier" - explosion
			on("flakier").burst("claude-opus-4-5", "💥"),

			// "costlier" - money bags
			on("costlier").burst("claude-opus-4-5", "💸"),

			// "What" - all three start running
			on("What")
				.focus.clear()
				.status('ask("tree", ticker)', "running", { persist: true })
				.status('ask("Zubenelgenubi", ticker)', "running", { persist: true })
				.status('ask("dung beetle", ticker)', "running", { persist: true }),

			// "Zubenelgenubi" - focus on that call with cursor
			on("Zubenelgenubi").focus({ text: 'ask("Zubenelgenubi"', dim: 0.7 }).cursor('"Zubenelgenubi"', { persist: true }),

			// "implodes" - only Zubenelgenubi errors, others still running
			on("implodes")
				.focus.clear()
				.status('ask("tree", ticker)', "running", { persist: true })
				.status('ask("Zubenelgenubi", ticker)', "error", { persist: true })
				.status('ask("dung beetle", ticker)', "running", { persist: true })
				.sound("fail"),

			// "reject immediately" - highlight Promise.all rejection
			on("reject").cursor("Promise.all").burst("Promise.all", "💥"),

			// "tree" - focus on tree, money bags
			on("tree", { after: "while" }).cursor('"tree"').burst('"tree"', "💸"),

			// "beetle" - focus on dung beetle, money bags
			on("beetle", { after: "while" }).cursor('"dung beetle"').burst('"dung beetle"', "💸"),

			on("Promise-strewn"),

			// "run to completion" - tree and beetle complete (wasted work)
			on("completion")
				.status('ask("tree", ticker)', "success", { persist: true })
				.status('ask("Zubenelgenubi", ticker)', "error", { persist: true })
				.status('ask("dung beetle", ticker)', "success", { persist: true })
				.sound("succeed"),
		],
	},
})

// ============================================================================
// Section: promise-abort-ceremony
// The "correct" Promise solution requires threading AbortController everywhere
// ============================================================================

export const promiseAbortCeremony = section("promise-abort-ceremony", {
	transcript: `
		If we wanted to fix this, we'd first need an \`AbortController\`.
		Then we could wrap our logic in try/catch, aborting and rethrowing upon failure.

		\`ask\` would need to take an abort signal
		and pass it through to the AI SDK function it calls.
		Luckily, this library supports abort signals,
		otherwise we'd be sort of doomed.

		Finally, we'd thread our signal through each call site.
	`,

	code: {
		animation: stack(
			// ask function - signal param hidden initially
			line("askFn", [
				"function ask(role: string, ticker: string",
				slot.optional("signalParam", ", signal: AbortSignal"),
				") {",
			]),
			line("askBody1", "  return generateText({"),
			line("askBody2", "    model: anthropic('claude-opus-4-5'),"),
			line("askBody3", "    system: `You are a ${role}. Give stock advice.`,"),
			line("askBody4", ["    prompt: ticker", slot.optional("promptComma", ",")]),
			slot.optional("abortSignalLine", line("abortSignal", "    abortSignal: signal")),
			line("askBody5", "  })"),
			line("askEnd", "}"),
			line("blank", ""),
			// getStockAdvice function
			line("getFn", "async function getStockAdvice(ticker: string) {"),
			slot.optional("controllerLine", line("controller", "  const controller = new AbortController()")),
			slot.optional("blankLine", line("blank2", "")),
			slot.optional("tryLine", line("try", "  try {")),
			// Indentation changes when try/catch wraps the block
			line("destructure", [
				slot("i1", { base: "  ", wrapped: "    " }),
				"const [tree, star, beetle] = await Promise.all([",
			]),
			line("treeCall", [
				slot("i2", { base: "    ", wrapped: "      " }),
				'ask("tree", ticker',
				slot.optional("treeSignal", ", controller.signal"),
				"),",
			]),
			line("starCall", [
				slot("i3", { base: "    ", wrapped: "      " }),
				'ask("Zubenelgenubi", ticker',
				slot.optional("starSignal", ", controller.signal"),
				"),",
			]),
			line("beetleCall", [
				slot("i4", { base: "    ", wrapped: "      " }),
				'ask("dung beetle", ticker',
				slot.optional("beetleSignal", ", controller.signal"),
				")",
			]),
			line("closeAll", [slot("i5", { base: "  ", wrapped: "    " }), "])"]),
			line("return", [slot("i6", { base: "  ", wrapped: "    " }), "return { tree, star, beetle }"]),
			// try closing brace (shown alone before catch appears)
			slot.optional("tryClose", line("tryClose", "  }")),
			// catch block - split into separate parts for granular reveal
			slot.optional("catchLine", line("catch", "  } catch (e) {")),
			slot.optional("abortLine", line("abort", "    controller.abort()")),
			slot.optional("throwLine", line("throw", "    throw e")),
			slot.optional("catchEnd", line("catchEnd", "  }")),
			line("getEnd", "}"),
		),

		base: {
			i1: "base",
			i2: "base",
			i3: "base",
			i4: "base",
			i5: "base",
			i6: "base",
		},

		flow: [
			// "AbortController" - show controller line AND blank line
			on("AbortController").slots({ controllerLine: "shown", blankLine: "shown" }).cursor("new AbortController()"),

			// "wrap" - show just try { } and change indentation
			on("wrap")
				.slots({
					tryLine: "shown",
					tryClose: "shown",
					i1: "wrapped",
					i2: "wrapped",
					i3: "wrapped",
					i4: "wrapped",
					i5: "wrapped",
					i6: "wrapped",
				})
				.cursor("try"),

			// "try/catch" - swap tryClose for catch block
			on("try/catch")
				.slots({
					tryClose: "hidden",
					catchLine: "shown",
					catchEnd: "shown",
				})
				.cursor("catch"),

			// "aborting" - add abort line
			on("aborting").slots({ abortLine: "shown" }).cursor("controller.abort()"),

			// "rethrowing" - add throw line
			on("rethrowing").slots({ throwLine: "shown" }).cursor("throw e"),

			// "ask" - focus on the ask function
			on("ask", { after: "rethrowing" })
				.focus("askFn", "askBody1", "askBody2", "askBody3", "askBody4", "askBody5", "askEnd")
				.cursor("function ask"),

			// "abort" (in "abort signal") - add signal param to ask
			on("abort", { after: "ask" }).slots({ signalParam: "shown" }).cursor("signal: AbortSignal"),

			// "pass" - add abortSignal line (comma appears on prompt: ticker)
			on("pass")
				.slots({ promptComma: "shown", abortSignalLine: "shown" })
				.cursor("abortSignal: signal", { persist: true }),

			// "supports" - positive glow
			on("supports").focus.clear().glow("abortSignal: signal", { color: "blue" }),

			// "thread" - show first signal
			on("thread").slots({ treeSignal: "shown" }).cursor("controller.signal", { nth: 1 }),

			// "signal" (after "thread") - show second signal
			on("signal", { after: "thread" }).slots({ starSignal: "shown" }).cursor("controller.signal", { nth: 2 }),

			// "each" - show third signal
			on("each").slots({ beetleSignal: "shown" }).cursor("controller.signal", { nth: 3 }),
		],
	},
})

// ============================================================================
// Section: abort-signal-infusion
// The abort ceremony works, but at what cost?
// ============================================================================

export const abortSignalInfusion = section("abort-signal-infusion", {
	transcript: `
		Now when the dung beetle is crushed mid-reply,
		the error is caught and the controller is aborted,
		signaling \`generateText\` to stop itself.

		As \`Promise\` doesn't natively support cancellation,
		we must do this verbose wiring ourselves.
		Furthermore, your dependencies won't always
		work with abort signals, or do so uniformly.

		Most production TypeScript backends simply ignore this problem,
		tolerating, perhaps unwittingly, the monetary and computational costs
		of leaking everything everywhere, all of the time.
	`,

	code: {
		animation: stack(
			// ask function - signal param can be hidden
			line("askFn", [
				"function ask(role: string, ticker: string",
				slot.optional("signalParam", ", signal: AbortSignal"),
				") {",
			]),
			line("askBody1", "  return generateText({"),
			line("askBody2", "    model: anthropic('claude-opus-4-5'),"),
			line("askBody3", "    system: `You are a ${role}. Give stock advice.`,"),
			line("askBody4", ["    prompt: ticker", slot.optional("promptComma", ",")]),
			slot.optional("abortSignalLine", line("abortSignal", "    abortSignal: signal")),
			line("askBody5", "  })"),
			line("askEnd", "}"),
			line("blank", ""),
			// getStockAdvice function
			line("getFn", "async function getStockAdvice(ticker: string) {"),
			slot.optional("controllerLine", line("controller", "  const controller = new AbortController()")),
			slot.optional("blankLine", line("blank2", "")),
			slot.optional("tryLine", line("try", "  try {")),
			// Indentation changes when try/catch wraps the block
			line("destructure", [
				slot("i1", { base: "  ", wrapped: "    " }),
				"const [tree, star, beetle] = await Promise.all([",
			]),
			line("treeCall", [
				slot("i2", { base: "    ", wrapped: "      " }),
				'ask("tree", ticker',
				slot.optional("treeSignal", ", controller.signal"),
				"),",
			]),
			line("starCall", [
				slot("i3", { base: "    ", wrapped: "      " }),
				'ask("Zubenelgenubi", ticker',
				slot.optional("starSignal", ", controller.signal"),
				"),",
			]),
			line("beetleCall", [
				slot("i4", { base: "    ", wrapped: "      " }),
				'ask("dung beetle", ticker',
				slot.optional("beetleSignal", ", controller.signal"),
				")",
			]),
			line("closeAll", [slot("i5", { base: "  ", wrapped: "    " }), "])"]),
			line("return", [slot("i6", { base: "  ", wrapped: "    " }), "return { tree, star, beetle }"]),
			slot.optional("catchLine", line("catch", "  } catch (e) {")),
			slot.optional("abortLine", line("abort", "    controller.abort()")),
			slot.optional("throwLine", line("throw", "    throw e")),
			slot.optional("catchEnd", line("catchEnd", "  }")),
			line("getEnd", "}"),
		),

		// Start with everything shown (wrapped state)
		base: {
			signalParam: "shown",
			promptComma: "shown",
			abortSignalLine: "shown",
			controllerLine: "shown",
			blankLine: "shown",
			tryLine: "shown",
			treeSignal: "shown",
			starSignal: "shown",
			beetleSignal: "shown",
			catchLine: "shown",
			abortLine: "shown",
			throwLine: "shown",
			catchEnd: "shown",
			i1: "wrapped",
			i2: "wrapped",
			i3: "wrapped",
			i4: "wrapped",
			i5: "wrapped",
			i6: "wrapped",
		},

		flow: [
			// "Now" - all three start running
			on("Now")
				.status('ask("tree", ticker, controller.signal)', "running")
				.status('ask("Zubenelgenubi", ticker, controller.signal)', "running")
				.status('ask("dung beetle", ticker, controller.signal)', "running")
				.sound("whoosh"),

			// "beetle" - focus on dung beetle, still running
			on("beetle")
				.status('ask("tree", ticker, controller.signal)', "running")
				.status('ask("Zubenelgenubi", ticker, controller.signal)', "running")
				.status('ask("dung beetle", ticker, controller.signal)', "running")
				.focus("beetleCall")
				.cursor('"dung beetle"', { persist: true }),

			// "crushed" - beetle errors
			on("crushed")
				.status('ask("tree", ticker, controller.signal)', "running")
				.status('ask("Zubenelgenubi", ticker, controller.signal)', "running")
				.status('ask("dung beetle", ticker, controller.signal)', "error")
				.focus("beetleCall")
				.sound("fail"),

			// "caught" - focus on catch line
			on("caught")
				.status('ask("tree", ticker, controller.signal)', "running")
				.status('ask("Zubenelgenubi", ticker, controller.signal)', "running")
				.status('ask("dung beetle", ticker, controller.signal)', "error")
				.focus("catch")
				.cursor("catch (e)"),

			// "controller" - focus on abort line
			on("controller")
				.status('ask("tree", ticker, controller.signal)', "running")
				.status('ask("Zubenelgenubi", ticker, controller.signal)', "running")
				.status('ask("dung beetle", ticker, controller.signal)', "error")
				.focus("abort")
				.cursor("controller.abort()"),

			// "signaling" - focus on abortSignal line but keep try-catch visible
			on("signaling")
				.status('ask("tree", ticker, controller.signal)', "running")
				.status('ask("Zubenelgenubi", ticker, controller.signal)', "running")
				.status('ask("dung beetle", ticker, controller.signal)', "error")
				.focus("abortSignal")
				.cursor("abortSignal: signal"),

			// "stop" - tree and star get cancelled, cursor to Zubenelgenubi
			on("stop")
				.status('ask("tree", ticker, controller.signal)', "error")
				.status('ask("Zubenelgenubi", ticker, controller.signal)', "error")
				.status('ask("dung beetle", ticker, controller.signal)', "error")
				.focus(
					"abortSignal",
					"try",
					"destructure",
					"treeCall",
					"starCall",
					"beetleCall",
					"closeAll",
					"return",
					"catch",
					"abort",
					"throw",
					"catchEnd",
				)
				.cursor("controller.signal", { nth: 2 })
				.sound("fail"),

			on("as")
				.status('ask("tree", ticker, controller.signal)', "error")
				.status('ask("Zubenelgenubi", ticker, controller.signal)', "error")
				.status('ask("dung beetle", ticker, controller.signal)', "error"),

			// "verbose" - focus on all the abort ceremony lines
			on("verbose")
				.status('ask("tree", ticker, controller.signal)', "error")
				.status('ask("Zubenelgenubi", ticker, controller.signal)', "error")
				.status('ask("dung beetle", ticker, controller.signal)', "error")
				.focus(
					"askFn",
					"abortSignal",
					"controller",
					"try",
					"treeCall",
					"starCall",
					"beetleCall",
					"catch",
					"abort",
					"throw",
					"catchEnd",
				),

			// "dependencies" - focus on the generateText call body
			on("dependencies")
				.status('ask("tree", ticker, controller.signal)', "error")
				.status('ask("Zubenelgenubi", ticker, controller.signal)', "error")
				.status('ask("dung beetle", ticker, controller.signal)', "error")
				.focus("askBody1", "askBody2", "askBody3", "askBody4", "abortSignal", "askBody5")
				.cursor("abortSignal: signal"),

			on("Most")
				.status('ask("tree", ticker, controller.signal)', "error")
				.status('ask("Zubenelgenubi", ticker, controller.signal)', "error")
				.status('ask("dung beetle", ticker, controller.signal)', "error"),

			// "ignore" - collapse the abort ceremony back to plain code
			on("ignore")
				.status('ask("tree", ticker)', "error")
				.status('ask("Zubenelgenubi", ticker)', "error")
				.status('ask("dung beetle", ticker)', "error")
				.focus.clear()
				.slots({
					signalParam: "hidden",
					promptComma: "hidden",
					abortSignalLine: "hidden",
					controllerLine: "hidden",
					blankLine: "hidden",
					tryLine: "hidden",
					treeSignal: "hidden",
					starSignal: "hidden",
					beetleSignal: "hidden",
					catchLine: "hidden",
					abortLine: "hidden",
					throwLine: "hidden",
					catchEnd: "hidden",
					i1: "base",
					i2: "base",
					i3: "base",
					i4: "base",
					i5: "base",
					i6: "base",
				}),

			// "tolerating" - start running again (showing the leak)
			on("tolerating")
				.status('ask("tree", ticker)', "running")
				.status('ask("Zubenelgenubi", ticker)', "running")
				.status('ask("dung beetle", ticker)', "running")
				.sound("whoosh"),

			// "leaking" - one errors, others keep running (leaked)
			on("leaking")
				.status('ask("tree", ticker)', "running")
				.status('ask("Zubenelgenubi", ticker)', "error")
				.status('ask("dung beetle", ticker)', "running")
				.sound("fail"),
		],
	},
})

// ============================================================================
// Section: effect-structured-concurrency
// With Effect, the ceremony disappears - structured concurrency is built in
// ============================================================================

export const effectStructuredConcurrency = section("effect-structured-concurrency", {
	transcript: `
		How will Effect save us this time?

		First let's revert the Promise solution.
		Then we can switch \`ask\` over to Effect's AI library.
		We'll migrate \`getStockAdvice\` over to Effect,
		swapping out \`Promise.all\` for \`Effect.all\`.

		And... that's it.
		Our text generation requests will run in parallel,
		and if one fails,
		the others are automatically interrupted.

		This property of structured concurrency is built into Effect.
	`,

	code: {
		animation: stack(
			// ask function - syntax transforms from function to const arrow
			line("askFn", [
				slot("fnKw", { promise: "function ", effect: "const " }),
				"ask",
				slot.optional("fnEq", " = "),
				"(role: string, ticker: string",
				slot.optional("signalParam", ", signal: AbortSignal"),
				")",
				slot("fnEnd", { promise: " {", effect: " =>" }),
			]),
			// ask body - LanguageModel. prefix added, generateText stays stable
			line("askBody1", [
				slot("retKw", { promise: "  return ", effect: "  " }),
				slot.optional("langModelPrefix", "LanguageModel."),
				"generateText({",
			]),
			slot.optional("modelLine", line("askBody2", "    model: anthropic('claude-opus-4-5'),")),
			// Effect's generateText has no `system` option, so it folds into the prompt
			slot.optional("systemLine", line("askBody3", "    system: `You are a ${role}. Give stock advice.`,")),
			line("askBody4", [
				"    prompt: ",
				slot.optional("promptPrefix", "`You are a ${role}. Give stock advice for ${"),
				"ticker",
				slot.optional("promptSuffix", "}.`"),
				slot.optional("promptComma", ","),
			]),
			slot.optional("abortSignalLine", line("abortSignal", "    abortSignal: signal")),
			line("askBody5", "  })"),
			slot.optional("askEndBrace", line("askEnd", "}")),
			line("blank", ""),
			// getStockAdvice function - Effect.fn includes function* on same line
			line("getFn", [
				slot("getFnKw", { promise: "async function ", effect: "const " }),
				"getStockAdvice",
				// Promise: ( directly after name, Effect: = Effect.fn(function* (
				slot("getFnMiddle", { promise: "(", effect: " = Effect.fn(function* (" }),
				"ticker: string) {",
			]),
			slot.optional("controllerLine", line("controller", "  const controller = new AbortController()")),
			slot.optional("blankLine", line("blank2", "")),
			slot.optional("tryLine", line("try", "  try {")),
			// The combinator line - indentation changes (4 in try vs 2 direct)
			// Single slot for "await Promise" -> "yield* Effect" to avoid animation race
			line("destructure", [
				slot("destIndent", { wrapped: "    ", base: "  " }),
				"const [tree, star, beetle] = ",
				slot("awaitCombinator", { promise: "await Promise", effect: "yield* Effect" }),
				".all([",
			]),
			// Call lines - indentation changes (6 in try vs 4 direct)
			line("treeCall", [
				slot("callIndent", { wrapped: "      ", base: "    " }),
				'ask("tree", ticker',
				slot.optional("treeSignal", ", controller.signal"),
				"),",
			]),
			line("starCall", [
				slot("callIndent2", { wrapped: "      ", base: "    " }),
				'ask("Zubenelgenubi", ticker',
				slot.optional("starSignal", ", controller.signal"),
				"),",
			]),
			line("beetleCall", [
				slot("callIndent3", { wrapped: "      ", base: "    " }),
				'ask("dung beetle", ticker',
				slot.optional("beetleSignal", ", controller.signal"),
				")",
			]),
			// Close - indentation changes, adds concurrency option in Effect version
			line("closeAll", [
				slot("closeIndent", { wrapped: "    ", base: "  " }),
				"]",
				slot.optional("concurrencyOpt", ', { concurrency: "unbounded" }'),
				")",
			]),
			// Return - indentation changes
			line("return", [slot("returnIndent", { wrapped: "    ", base: "  " }), "return { tree, star, beetle }"]),
			slot.optional("catchLine", line("catch", "  } catch (e) {")),
			slot.optional("abortLine", line("abort", "    controller.abort()")),
			slot.optional("throwLine", line("throw", "    throw e")),
			slot.optional("catchEnd", line("catchEnd", "  }")),
			// Close function: } for promise, }) for Effect.fn
			line("getEnd", ["}", slot.optional("effectCloseParen", ")")]),
		),

		// Start with full Promise ceremony (matching end of previous section)
		base: {
			// ask function - Promise style with signal
			fnKw: "promise",
			fnEnd: "promise",
			signalParam: "shown",
			retKw: "promise",
			modelLine: "shown",
			systemLine: "shown",
			promptComma: "shown",
			abortSignalLine: "shown",
			askEndBrace: "shown",
			// getStockAdvice - Promise style with abort ceremony
			getFnKw: "promise",
			getFnMiddle: "promise",
			controllerLine: "shown",
			blankLine: "shown",
			tryLine: "shown",
			destIndent: "wrapped",
			awaitCombinator: "promise",
			callIndent: "wrapped",
			callIndent2: "wrapped",
			callIndent3: "wrapped",
			treeSignal: "shown",
			starSignal: "shown",
			beetleSignal: "shown",
			closeIndent: "wrapped",
			returnIndent: "wrapped",
			catchLine: "shown",
			abortLine: "shown",
			throwLine: "shown",
			catchEnd: "shown",
		},

		flow: [
			// "revert" - strip abort ceremony back to simple Promise code
			on("revert").slots({
				// Remove signal from ask
				signalParam: "hidden",
				promptComma: "hidden",
				abortSignalLine: "hidden",
				// Remove abort ceremony from getStockAdvice
				controllerLine: "hidden",
				blankLine: "hidden",
				tryLine: "hidden",
				destIndent: "base",
				callIndent: "base",
				callIndent2: "base",
				callIndent3: "base",
				treeSignal: "hidden",
				starSignal: "hidden",
				beetleSignal: "hidden",
				closeIndent: "base",
				returnIndent: "base",
				catchLine: "hidden",
				abortLine: "hidden",
				throwLine: "hidden",
				catchEnd: "hidden",
			}),

			// "ask" - transform ask function to Effect's AI library
			on("ask", { after: "revert" })
				.slots({
					fnKw: "effect",
					fnEq: "shown",
					fnEnd: "effect",
					retKw: "effect",
					langModelPrefix: "shown",
					modelLine: "hidden",
					systemLine: "hidden",
					promptPrefix: "shown",
					promptSuffix: "shown",
					askEndBrace: "hidden",
				})
				.focus("askFn", "askBody1", "askBody4", "askBody5")
				.cursor("LanguageModel.generateText"),

			on("migrate").cursor("getStockAdvice"),

			// "getStockAdvice" - transform function syntax (but keep Promise.all)
			on("Effect", { nth: 3 })
				.slots({
					getFnKw: "effect",
					getFnMiddle: "effect",
					effectCloseParen: "shown",
				})
				.focus.clear()
				.cursor("Effect.fn"),

			// "Promise" (in "Promise.all") - cursor on Promise.all before swap
			on("Promise", { after: "out" }).cursor("Promise.all"),

			// "Effect" (in "Effect.all") - swap to Effect.all
			on("Effect", { after: "for" })
				.slots({
					awaitCombinator: "effect",
					concurrencyOpt: "shown",
				})
				.cursor("Effect.all"),

			// "run" - run all three
			on("run")
				.status('ask("tree", ticker)', "running")
				.status('ask("Zubenelgenubi", ticker)', "running")
				.status('ask("dung beetle", ticker)', "running")
				.cursor('"dung beetle"')
				.sound("whoosh"),

			// "fails" - one fails
			on("fails")
				.status('ask("tree", ticker)', "running")
				.status('ask("Zubenelgenubi", ticker)', "error")
				.status('ask("dung beetle", ticker)', "running")
				.cursor('"Zubenelgenubi"')
				.sound("fail"),

			// "interrupted" - others automatically cancelled
			on("interrupted")
				.status('ask("tree", ticker)', "interrupted")
				.status('ask("Zubenelgenubi", ticker)', "error")
				.status('ask("dung beetle", ticker)', "interrupted")
				.cursor('"tree"'),

			// "structured concurrency" - highlight Effect.all with glow
			on("structured", { after: "interrupted" })
				.status('ask("tree", ticker)', "interrupted")
				.status('ask("Zubenelgenubi", ticker)', "error")
				.status('ask("dung beetle", ticker)', "interrupted")
				.glow("Effect.all", { color: "green" }),
		],
	},

	component: {
		name: "StructuredConcurrencyDemo",
		base: {
			visible: false,
			tree: "idle",
			star: "idle",
			beetle: "idle",
		},
		flow: [
			// "Our" - show all three in idle state
			on("Our").state({ visible: true }),
			// "run" - all three start running
			on("run").state({ tree: "running", star: "running", beetle: "running" }),
			// "fails" - star fails
			on("fails").state({ star: "failed" }),
			// "interrupted" - tree and beetle are interrupted
			on("interrupted").state({ tree: "interrupted", beetle: "interrupted" }),
		],
	},
})
