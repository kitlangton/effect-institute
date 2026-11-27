import { chapter, empty, group, line, on, output, section, slot, stack } from "@/lib/content"

// ============================================================================
// Intro
// ============================================================================

const effectIsADescription = section("effect-is-a-description", {
	transcript: `
		An \`Effect\` is a blueprint, an inert description of a computation.
		To run an Effect, one must do so explicitly.

		If this sounds familiar, that's because this also describes a function.
		Functions are similarly dormant until they are called.

		This property, often referred to as **laziness** by programming language people, is deceptively powerful.
		In time, we will learn of its many fruits.
	`,

	code: {
		animation: stack(
			slot.optional("import", stack(line("import", 'import { Effect, Clock } from "effect"'), line("importBlank", ""))),
			slot.optional(
				"comment",
				line("comment", [
					"// ",
					slot("commentSubject", {
						fn: "Functions",
						effect: "Effects",
					}),
					" are LAZY",
				]),
			),
			line("def", [
				"const getTime",
				slot.optional("typeAnnotation", [
					": ",
					slot("typePrefix", {
						effect: "Effect.Effect<",
						fn: "() => ",
					}),
					"number",
					slot("typeSuffix", {
						effect: ">",
						fn: "",
					}),
				]),
				" = ",
				slot("impl", {
					effect: "Clock.currentTimeMillis",
					fn: "() => Date.now()",
				}),
			]),
			slot.optional(
				"runBlock",
				stack(
					line("blank", ""),
					line("run", [
						slot("runPrefix", {
							effect: "Effect.runSync(",
							fn: "",
						}),
						"getTime",
						slot("runMiddle", {
							effect: "",
							fn: "(",
						}),
						")",
					]),
				),
			),
		),
		base: {
			import: "shown",
			impl: "effect",
			runPrefix: "effect",
			runMiddle: "effect",
			runBlock: "hidden",
			comment: "hidden",
			commentSubject: "fn",
			typeAnnotation: "hidden",
			typePrefix: "effect",
			typeSuffix: "effect",
		},
		flow: [
			on("blueprint").slots({ typeAnnotation: "shown" }).cursor("Effect.Effect<number>"),
			on("To").slots({ runBlock: "shown" }).cursor("Effect.runSync"),
			on("run").cursor("runSync").status("Effect.runSync(getTime)", "running"),
			on("explicitly").cursor("runSync").status("Effect.runSync(getTime)", "success", { persist: true }),
			on("function")
				.slots({ import: "hidden", impl: "fn", runPrefix: "fn", runMiddle: "fn", typeAnnotation: "hidden" })
				.cursor("() => Date.now()")
				.focus({ text: "() => Date.now()" })
				.status.clear(),
			on("called").cursor("getTime()").focus("run"),
			on("laziness").slots({ comment: "shown" }).cursor("LAZY"),
			on("In")
				.slots({
					commentSubject: "effect",
					impl: "effect",
					runPrefix: "effect",
					runMiddle: "effect",
					typeAnnotation: "shown",
				})
				.cursor.clear(),
		],
	},

	component: {
		name: "EffectIsDescriptionDemo",
		base: { show: true, visualState: "idle", result: "" },
		flow: [
			on("run").state({ visualState: "running" }),
			on("explicitly").state({ visualState: "completed", result: "1736078400000" }),
			on("function").state({ visualState: "idle", result: "" }),
		],
	},
})

const effectSucceed = section("effect-succeed", {
	transcript: `
		Now let's take a look at a few rudimentary Effect constructors.

		We'll begin with \`Effect.succeed\`, which describes a computation that succeeds with the given value.
		Here we'll give it the string "pismire", which was my grandmother's favorite word.

		This is an \`Effect<string>\`.
		It succeeds with a string, it can never fail, and it has no requirements.
		Luckily, we can elide trailing nevers, leaving us with a much more readable type ascription.
	`,

	code: {
		animation: stack(
			line("import", 'import { Effect } from "effect"'),
			line("blank", ""),
			line("magicWord", [
				"const magicWord",
				slot.optional("typeAnnotation", [
					": Effect.Effect<string",
					slot.optional("errorNever", ", never"),
					slot.optional("reqNever", ", never"),
					">",
				]),
				" = ",
				slot.optional("effectSucceed", "Effect.succeed("),
				slot("value", { ellipsis: "...", pismire: '"pismire"' }),
				slot.optional("closeParen", ")"),
			]),
		),
		base: {
			effectSucceed: "hidden",
			closeParen: "hidden",
			value: "ellipsis",
			typeAnnotation: "hidden",
			errorNever: "hidden",
			reqNever: "hidden",
		},
		flow: [
			on("Effect.succeed").slots({ effectSucceed: "shown", closeParen: "shown" }).cursor("succeed").bright("succeed"),
			on('"pismire"').slots({ value: "pismire" }).cursor("pismire"),
			on("Effect<string>").slots({ typeAnnotation: "shown" }).cursor("Effect.Effect<string>"),
			on("string", { nth: 2 }).cursor("string"),
			on("never").slots({ errorNever: "shown" }).cursor("never"),
			on("no").slots({ reqNever: "shown" }).cursor("never", { nth: 2 }),
			on("elide").slots({ errorNever: "hidden", reqNever: "hidden" }).cursor("Effect.Effect<string>"),
			on("readable").burst("Effect.Effect<string>", "✅"),
		],
	},

	glossary: {
		pismire: "An ant. Archaic.",
	},
})

const effectFail = section("effect-fail", {
	transcript: `
		What good is success without the failure of others?
		\`Effect.fail\` creates an effect that will always fail with the given value.
		Here, we'll give it the string "too chonky," an adjective which entirely bypassed my grandmother's lexicon.

		Now, \`boom\` is an Effect that can never succeed, and always fails with our awful string.

		If we run it with \`Effect.runSync\`, it throws.
		If we add a delay and run it with \`Effect.runPromise\`, we, after two glorious seconds, see our promise rejected.
	`,

	code: {
		animation: stack(
			line("import", 'import { Effect } from "effect"'),
			line("blank", ""),
			line("error", [
				"const ",
				slot("varName", { sync: "boom", async: "slowBoom" }),
				slot.optional("typeAnnotation", [
					": Effect.Effect<",
					slot("successType", { unknown: "?", never: "never" }),
					slot.optional("errorType", ", string"),
					">",
				]),
				" = ",
				slot.optional("effectFail", "Effect.fail("),
				slot("value", { ellipsis: "...", error: '"too chonky"' }),
				slot.optional("closeParen", ")"),
			]),
			slot.optional("delay", line("delay", '  .pipe(Effect.delay("2 seconds"))')),
			slot.optional(
				"runBlock",
				stack(
					line("runBlank", ""),
					line("run", [
						slot.optional("await", "await "),
						"Effect.run",
						slot("runnerSuffix", { sync: "Sync", promise: "Promise" }),
						"(",
						slot("refName", { sync: "boom", async: "slowBoom" }),
						")",
					]),
				),
			),
		),
		base: {
			effectFail: "hidden",
			closeParen: "hidden",
			value: "ellipsis",
			typeAnnotation: "hidden",
			successType: "unknown",
			errorType: "hidden",
			delay: "hidden",
			runBlock: "hidden",
			await: "hidden",
			runnerSuffix: "sync",
			varName: "sync",
			refName: "sync",
		},
		flow: [
			on("Effect.fail").slots({ effectFail: "shown", closeParen: "shown" }).cursor("fail").bright("fail"),
			on("chonky").slots({ value: "error" }).cursor("too chonky"),
			on("boom").slots({ typeAnnotation: "shown" }).cursor("boom"),
			on("Effect", { after: "boom" }).cursor("Effect.Effect<?>"),
			on("never").slots({ successType: "never" }).cursor("never"),
			on("fails").slots({ errorType: "shown" }).cursor("string"),
			on("Effect.runSync").slots({ runBlock: "shown" }).cursor("runSync").bright("runSync"),
			on("throws").cursor("runSync").status("Effect.runSync(boom)", "error", { persist: true }),
			on("delay")
				.slots({ delay: "shown", varName: "async", refName: "async" })
				.cursor("delay")
				.bright("delay")
				.status.clear(),
			on("Effect.runPromise")
				.slots({ await: "shown", runnerSuffix: "promise" })
				.cursor("runPromise")
				.bright("runPromise"),
			on("after").cursor("runPromise").status("Effect.runPromise(slowBoom)", "running"),
			on("rejected").cursor("runPromise").status("Effect.runPromise(slowBoom)", "error", { persist: true }),
		],
	},

	component: {
		name: "EffectFailDemo",
		base: { show: false, mode: "sync", syncState: "idle", asyncState: "idle" },
		flow: [
			on("Effect.runSync").state({ show: true }),
			on("throws").state({ syncState: "failed" }), // sync fails instantly
			on("delay").state({ mode: "async" }),
			on("after").state({ asyncState: "running" }),
			on("rejected").state({ asyncState: "failed" }), // ~2s later in transcript
		],
	},
})

const typesCaptureRuntime = section("types-capture-runtime", {
	transcript: `
		The \`Effect\` type has three parameters.

		The first is its **success** type, which is what you'll get when the Effect completes successfully.

		The second is its **error** type, which describes how it might fail.

		And the third is its **requirements**, which are the services it needs to run.
		We won't worry about this too much just yet.
	`,

	component: {
		name: "EffectTypeDisplay",
		base: {
			showSuccess: false,
			showError: false,
			showRequirements: false,
		},
		flow: [
			on("success").state({ showSuccess: true }).sound("ping1"),
			on("error").state({ showError: true }).sound("ping1"),
			on("requirements").state({ showRequirements: true }).sound("ping1"),
		],
	},
})

const runningEffects = section("running-effects", {
	transcript: `
		So now that we've defined our effect, how do we get our hands on its juicy result?
		Remember, because effects are *lazy*, we have to **explicitly** run them.

		For simple, synchronous effects, we can use \`Effect.runSync\`.
		This runs the effect immediately and returns the value.

		However, in real applications, Effects probably involve async work.
		We'll mostly use \`Effect.runPromise\`, running our effect as a \`Promise\`, which, mind you, is *not* lazy, but a handle on a running computation.
	`,

	code: {
		animation: stack(
			line("import", 'import { Effect } from "effect"'),
			line("importBlank", ""),
			line("program", [
				"const ",
				slot("varPrefix", { sync: "magic", async: "async" }),
				'Word = Effect.succeed("pismire")',
				slot.optional("delay", '.pipe(Effect.delay("3 seconds"))'),
			]),
			slot.optional(
				"runBlock",
				stack(
					line("blank", ""),
					line("run", [
						"const value",
						slot.optional("typeAnnotation", [
							": ",
							slot.optional("promiseWrapper", "Promise<"),
							"string",
							slot.optional("promiseClose", ">"),
						]),
						" = ",
						"Effect.run",
						slot("runnerSuffix", {
							sync: "Sync",
							promise: "Promise",
						}),
						"(",
						slot("refPrefix", { sync: "magic", async: "async" }),
						"Word)",
					]),
				),
			),
		),
		base: {
			varPrefix: "sync",
			delay: "hidden",
			runBlock: "hidden",
			typeAnnotation: "hidden",
			runnerSuffix: "sync",
			promiseWrapper: "hidden",
			promiseClose: "hidden",
			refPrefix: "sync",
		},
		flow: [
			on("simple").cursor("succeed"),
			on("Effect.runSync").slots({ runBlock: "shown" }).cursor("runSync").bright("runSync"),
			on("immediately").cursor("runSync").status("Effect.runSync(magicWord)", "success", { persist: true }),
			on("returns").slots({ typeAnnotation: "shown" }).cursor("string"),
			on("async")
				.slots({ varPrefix: "async", delay: "shown", refPrefix: "async" })
				.cursor("delay")
				.bright("delay")
				.status.clear(),
			on("Effect.runPromise")
				.slots({ runnerSuffix: "promise", promiseWrapper: "shown", promiseClose: "shown" })
				.cursor("runPromise")
				.bright("runPromise"),
			on("running").cursor("runPromise").status("Effect.runPromise(asyncWord)", "running"),
			on("lazy", { nth: 2 }).cursor("runPromise").status("Effect.runPromise(asyncWord)", "success", { persist: true }),
		],
	},

	component: {
		name: "EffectRunDemo",
		base: { mode: "sync", syncState: "idle", asyncState: "idle" },
		flow: [
			on("immediately").state({ syncState: "completed" }), // sync completes instantly
			on("async").state({ mode: "async" }),
			on("running").state({ asyncState: "running" }),
			on("lazy", { nth: 2 }).state({ asyncState: "completed" }), // ~3s later in transcript
		],
	},
})

const effectSync = section("effect-sync", {
	transcript: `
		Succeeding or failing with a value is fine.
		But what if we want to do something more computery?

		\`Effect.sync\` takes a function of no arguments, a.k.a. a **thunk**, and stores it in an Effect.
		Here we'll log a message and return \`new Date()\`.

		*By the way, Effect's laziness isn't magic. It's inherited from the functions it wraps.*

		When we run it, the thunk will be called, our message will be logged, and we'll succeed with a \`Date\`.
		If we run it again, the thunk will be called again, and we'll get a new \`Date\`.
	`,

	code: {
		animation: stack(
			line("import", 'import { Effect } from "effect"'),
			line("blank", ""),
			line("effectOpen", [
				"const getDate = ",
				slot.optional("effectSync", "Effect.sync("),
				slot.optional("arrowFn", "() => "),
				slot.optional("openBrace", "{"),
				slot("bodyPlaceholder", {
					ellipsis: "...",
					placeholder: " ... ",
					thunk: " /* THUNK! */ ",
					expanded: "",
				}),
				slot("inlineCloseBrace", { shown: "}", hidden: "" }),
				slot("inlineCloseParen", { shown: ")", hidden: "" }),
			]),
			slot.optional("logLine", line("log", '  console.log("I\'M TRAPPED IN A THUNK!")')),
			slot.optional("returnLine", line("return", "  return new Date()")),
			slot.optional("closeLine", line("close", "})")),
			slot.optional(
				"runBlock",
				stack(
					line("runBlank", ""),
					slot.optional("run1", line("run1", "const now = await Effect.runPromise(getDate)")),
					slot.optional("run2", line("run2", "const later = await Effect.runPromise(getDate)")),
				),
			),
		),
		base: {
			effectSync: "hidden",
			arrowFn: "hidden",
			openBrace: "hidden",
			bodyPlaceholder: "ellipsis",
			inlineCloseBrace: "hidden",
			inlineCloseParen: "hidden",
			logLine: "hidden",
			returnLine: "hidden",
			closeLine: "hidden",
			runBlock: "hidden",
			run1: "hidden",
			run2: "hidden",
		},
		flow: [
			on("Effect.sync").slots({ effectSync: "shown", inlineCloseParen: "shown" }).cursor("sync").bright("sync"),
			on("function")
				.slots({ arrowFn: "shown", openBrace: "shown", inlineCloseBrace: "shown", bodyPlaceholder: "placeholder" })
				.cursor("() => { ... }")
				.bright("() => { ... }"),
			on("no").cursor("()").bright("()"),
			on("thunk").slots({ bodyPlaceholder: "thunk" }).cursor("THUNK!").bright("THUNK!"),
			on("log")
				.slots({
					bodyPlaceholder: "expanded",
					inlineCloseBrace: "hidden",
					inlineCloseParen: "hidden",
					logLine: "shown",
					closeLine: "shown",
				})
				.cursor("log")
				.bright("log")
				.focus("log"),
			on("return").slots({ returnLine: "shown" }).cursor("new Date()").bright("new Date()").focus("return"),
			on("way").focus(),
			on("inherited")
				.focus({ text: "() => {" })
				.focus({ text: 'console.log("I\'M TRAPPED IN A THUNK!")' })
				.focus({ text: "return new Date()" })
				.focus({ line: "close", text: "}" }),
			on("When")
				.slots({ runBlock: "shown", run1: "shown" })
				.focus.clear()
				.cursor("runPromise")
				.focus("run1", { persist: true }),
			on("thunk", { nth: 2 }).cursor("runPromise").status("Effect.runPromise(getDate)", "running"),
			on("Date.").cursor("runPromise").status("Effect.runPromise(getDate)", "success", { persist: true }),
			on("If", { nth: 2 }).slots({ run2: "shown" }).cursor("runPromise", { nth: 2 }).focus("run2", { persist: true }),
			on("again").cursor("runPromise", { nth: 2 }).status("Effect.runPromise(getDate)", "running", { nth: 2 }),
			on("new", { nth: 2 })
				.cursor("runPromise", { nth: 2 })
				.status("Effect.runPromise(getDate)", "success", { nth: 2, persist: true }),
		],
	},

	component: {
		name: "EffectSyncDemo",
		base: { show1: false, state1: "idle", showLog1: false, show2: false, state2: "idle", showLog2: false },
		flow: [
			on("When").state({ show1: true }),
			on("thunk", { nth: 2 }).state({ state1: "running" }),
			on("message", { nth: 2 }).state({ showLog1: true }),
			on("Date.").state({ state1: "completed", showLog1: false }),
			on("If", { nth: 2 }).state({ show2: true }),
			on("again").state({ state2: "running" }),
			on("called", { nth: 2 }).state({ showLog2: true }),
			on("new", { nth: 2 }).state({ state2: "completed", showLog2: false }),
		],
	},
})

// ============================================================================
// Constructors (continued)
// ============================================================================

const syncVsSucceed = section("sync-vs-succeed", {
	transcript: `
		It's worth clarifying a subtle distinction between \`Effect.succeed\` and \`Effect.sync\`.

		With \`succeed\`, the value is captured when the effect is first created.
		If we pass in \`new Date()\`, it will once and forever return that exact \`Date\`.
		When we run it, we'll get the original \`Date\`.
		Try again later, same \`Date\`.
		Tomorrow? That same God-forsaken \`Date\`.

		With \`sync\`, the computation is suspended within a thunk.
		When we run it, the thunk is called, and we get a brand new \`Date\`.
		When we run it again, it's re-executed, and we get another pristine \`Date\`.
	`,

	code: {
		animation: stack(
			line("import", 'import { Effect } from "effect"'),
			line("blank", ""),
			line("effect", [
				"const getDate = Effect.",
				slot("method", { succeed: "succeed", sync: "sync" }),
				"(",
				slot.optional("thunk", "() => "),
				"new Date())",
			]),
			slot.optional(
				"runBlock",
				stack(
					line("blank2", ""),
					slot.optional("run1", line("run1", "const now = await Effect.runPromise(getDate)")),
					slot.optional("run2", line("run2", "const later = await Effect.runPromise(getDate)")),
					slot.optional("sleep", line("sleep", "await new Promise(r => setTimeout(r, 86_400_000))")),
					slot.optional("run3", line("run3", "const tomorrow = await Effect.runPromise(getDate)")),
				),
			),
		),
		base: {
			method: "succeed",
			thunk: "hidden",
			runBlock: "hidden",
			run1: "hidden",
			run2: "hidden",
			sleep: "hidden",
			run3: "hidden",
		},
		flow: [
			on("succeed,").cursor("succeed").bright("succeed"),
			on("new Date(),").cursor("new Date()").bright("new Date()"),
			on("run")
				.slots({ runBlock: "shown", run1: "shown" })
				.cursor("runPromise")
				.bright("runPromise")
				.focus("run1")
				.status("Effect.runPromise(getDate)", "running"),
			on("original").cursor("runPromise").status("Effect.runPromise(getDate)", "success", { persist: true }),
			on("again")
				.slots({ run2: "shown" })
				.cursor("runPromise", { nth: 2 })
				.focus("run2")
				.status("Effect.runPromise(getDate)", "running", { nth: 2 }),
			on("same")
				.cursor("runPromise", { nth: 2 })
				.status("Effect.runPromise(getDate)", "success", { nth: 2, persist: true }),
			on("Tomorrow?")
				.slots({ sleep: "shown", run3: "shown" })
				.cursor("runPromise", { nth: 3 })
				.focus("run3")
				.status("Effect.runPromise(getDate)", "running", { nth: 3 }),
			on("Date.", { nth: 4 })
				.cursor("runPromise", { nth: 3 })
				.status("Effect.runPromise(getDate)", "success", { nth: 3, persist: true }),
			on("sync,")
				.slots({ method: "sync", thunk: "shown", run2: "hidden", sleep: "hidden", run3: "hidden" })
				.cursor("sync")
				.bright("sync")
				.focus("effect")
				.status.clear(),
			on("thunk.").cursor("() => new Date()").focus({ text: "() => new Date()" }),
			on("run", { nth: 2 })
				.slots({ run1: "shown" })
				.cursor("runPromise")
				.focus("run1")
				.status("Effect.runPromise(getDate)", "running"),
			on("called,").cursor("runPromise").status("Effect.runPromise(getDate)", "success", { persist: true }),
			on("again", { nth: 2 })
				.slots({ run2: "shown" })
				.cursor("runPromise", { nth: 2 })
				.focus("run2")
				.status("Effect.runPromise(getDate)", "running", { nth: 2 }),
			on("Date.", { nth: 6 })
				.cursor("runPromise", { nth: 2 })
				.status("Effect.runPromise(getDate)", "success", { nth: 2, persist: true }),
		],
	},

	component: {
		name: "SyncVsSucceedDemo",
		base: { mode: "succeed", run1State: "idle", run2State: "idle", run3State: "idle" },
		flow: [
			on("run").state({ run1State: "running" }),
			on("original").state({ run1State: "completed" }),
			on("again").state({ run2State: "running" }),
			on("same").state({ run2State: "completed" }),
			on("Tomorrow?").state({ run3State: "running" }),
			on("Date.", { nth: 4 }).state({ run3State: "completed" }),
			on("sync,").state({ mode: "sync", run1State: "idle", run2State: "idle", run3State: "idle" }),
			on("run", { nth: 2 }).state({ run1State: "running" }),
			on("called,").state({ run1State: "completed" }),
			on("again", { nth: 2 }).state({ run2State: "running" }),
			on("Date.", { nth: 6 }).state({ run2State: "completed" }),
		],
	},
})

const effectPromise = section("effect-promise", {
	transcript: `
		Before we move on, we should look at one last constructor.
		This concerns my arch enemy abstraction, the loathsome \`Promise\`.

		Here is a \`Promise\` that fetches your sensor data.
		You run it each morning before exiting your bunker.
		Today the air is clear, so you crank open the airlock and spend your day frolicking and collecting meat.

		The next morning you run it again.
		The exact same reading as yesterday! What providence!
		So you hurriedly crank open the airlock and proceed to die a slow and agonizing death.
	`,

	code: {
		animation: stack(
			line("def1", ["const sensorData", slot.optional("type", ": Promise<any>"), ' = fetch("/api/sensors")']),
			line("def2", "  .then(r => r.json())"),
			line("blank1", ""),
			slot.optional(
				"day1",
				stack(
					line("assign1", "const today = await sensorData"),
					line("log1", ["console.log(today)", slot.optional("result1", output("{ mSv: 0.3 }"))]),
				),
			),
			slot.optional(
				"sleep",
				stack(line("blank2", ""), line("sleepLine", "await new Promise(r => setTimeout(r, 86_400_000))")),
			),
			slot.optional(
				"day2",
				stack(
					line("blank3", ""),
					line("assign2", "const tomorrow = await sensorData"),
					line("log2", ["console.log(tomorrow)", slot.optional("result2", output("{ mSv: 0.3 }"))]),
				),
			),
		),
		base: { type: "hidden", day1: "hidden", result1: "hidden", sleep: "hidden", day2: "hidden", result2: "hidden" },
		flow: [
			on("Promise", { after: "loathsome" }).slots({ type: "shown" }).cursor("Promise<any>"),
			on("sensor").cursor("sensorData"),
			on("run").slots({ day1: "shown" }).cursor("sensorData", { nth: 2, persist: true }).focus("assign1"),
			on("morning").status("await sensorData", "running"),
			on("Today").status("await sensorData", "success", { persist: true }),
			on("clear").slots({ result1: "shown" }).cursor("0.3").focus("log1"),
			on("next").slots({ sleep: "shown" }).cursor("setTimeout").focus("sleepLine").status.clear(),
			on("run", { after: "next" })
				.slots({ day2: "shown" })
				.cursor("sensorData", { nth: 3 })
				.focus("assign2")
				.status("await sensorData", "success", { nth: 2, persist: true }),
			on("The", { after: "again" }).slots({ result2: "shown" }).cursor("0.3", { nth: 2 }).focus("log2"),
			on("die").sound("sad"),
		],
	},
})

const promisesAreEager = section("promises-are-eager", {
	transcript: `
		What went wrong? Ah, yes. That perfidious \`Promise\`.

		A \`Promise\` is not lazy. In fact, it is what the programming linguists call **eager**.
		It kicks off the moment it is defined.
		And once it resolves, either successfully or catastrophically, it will forever hold this initial value.

		Thus, when it was awaited a second time on the day of your unexpected demise, it did not procure a fresh reading, but instead regurgitated yesterday's value.
	`,

	glossary: {
		perfidious: "Treacherous; deceitful.",
	},

	code: {
		animation: stack(
			line("def1", ["const sensorData", slot.optional("type", ": Promise<any>"), ' = fetch("/api/sensors")']),
			line("def2", "  .then(r => r.json())"),
			line("blank1", ""),
			slot.optional(
				"day1",
				stack(
					line("assign1", "const today = await sensorData"),
					line("log1", ["console.log(today)", slot.optional("result1", output("{ mSv: 0.3 }"))]),
				),
			),
			slot.optional(
				"sleep",
				stack(line("blank2", ""), line("sleepLine", "await new Promise(r => setTimeout(r, 86_400_000))")),
			),
			slot.optional(
				"day2",
				stack(
					line("blank3", ""),
					line("assign2", "const tomorrow = await sensorData"),
					line("log2", ["console.log(tomorrow)", slot.optional("result2", output("{ mSv: 0.3 }"))]),
				),
			),
		),
		base: { type: "hidden", day1: "hidden", result1: "hidden", sleep: "hidden", day2: "hidden", result2: "hidden" },
		flow: [
			on("perfidious").slots({ type: "shown" }).cursor("Promise<any>").focus("def1"),
			on("eager").cursor("fetch", { persist: true }).bright("fetch"),
			on("defined").status('fetch("/api/sensors")', "running", { persist: true }),
			on("successfully").status('fetch("/api/sensors")', "success", { persist: true }).sound("ping1"),
			on("hold").slots({ day1: "shown", result1: "shown" }).cursor("0.3").focus("log1"),
			on("Thus").slots({ sleep: "shown", day2: "shown" }).cursor("0.3"),
			on("second").cursor("await", { nth: 3 }).focus("assign2"),
			on("reading").slots({ result2: "shown" }).cursor("0.3", { nth: 2 }).focus("log2"),
			on("regurgitated").cursor("0.3", { nth: 2 }),
		],
	},
})

const effectPromiseFix = section("effect-promise-fix", {
	transcript: `
		To fix this, we would have to wrap our \`Promise\` in a thunk.
		Then each time we call it, a fresh \`Promise\` is created.

		Alas, it is too easy to make meaningful and likely erroneous semantic changes to your programs.
		You have to be extremely careful when refactoring \`Promise\`-strewn code.

		Instead, let's call \`Effect.promise\`, wrapping up our \`Promise\` thunk into a perfectly cozy and inert \`Effect\`.

		When this is run, the thunk will be called, which will kick off a new \`Promise\`, and the \`Effect\` will succeed when the underlying \`Promise\` resolves.
	`,

	code: {
		animation: stack(
			line("def1", [
				"const sensorData: ",
				slot.optional("thunkType", "() => "),
				slot("mainType", { promise: "Promise", effect: "Effect.Effect" }),
				"<any> =",
			]),
			line("def2", [
				"  ",
				slot.optional("effectWrapOpen", "Effect.promise("),
				slot.optional("thunkImpl", "() => "),
				'fetch("/api/sensors").then(r => r.json())',
				slot.optional("effectWrapClose", ")"),
			]),
			slot.optional(
				"calls",
				stack(
					line("blank1", ""),
					line("call1", [
						"console.log(await sensorData",
						slot.optional("callParens1", "()"),
						")",
						slot.optional("result1", output("{ mSv: 0.3 }")),
					]),
					line("sleep", "await new Promise(r => setTimeout(r, 86_400_000))"),
					line("call2", [
						"console.log(await sensorData",
						slot.optional("callParens2", "()"),
						")",
						slot.optional("result2", output("{ mSv: 847 }")),
						slot.optional("badResult2", output("{ mSv: 0.3 }")),
						slot.optional("staleComment", "  // stale!"),
					]),
				),
			),
			slot.optional("run", stack(line("blank2", ""), line("run1", "await Effect.runPromise(sensorData)"))),
		),
		base: {
			mainType: "promise",
			thunkType: "hidden",
			thunkImpl: "hidden",
			calls: "hidden",
			callParens1: "shown",
			callParens2: "shown",
			result1: "hidden",
			result2: "hidden",
			badResult2: "hidden",
			staleComment: "hidden",
			effectWrapOpen: "hidden",
			effectWrapClose: "hidden",
			run: "hidden",
		},
		flow: [
			on("our").cursor("Promise"),
			on("thunk").slots({ thunkType: "shown", thunkImpl: "shown" }).cursor("() =>").bright("() =>"),
			on("each").slots({ calls: "shown" }).cursor("sensorData()").focus("call1"),
			on("time").slots({ result1: "shown" }).cursor("0.3").focus("call1"),
			on("fresh").slots({ result2: "shown" }).cursor("847").focus("call2"),
			on("Alas").focus.clear().cursor("fetch"),
			on("erroneous")
				.slots({
					thunkType: "hidden",
					thunkImpl: "hidden",
					callParens1: "hidden",
					callParens2: "hidden",
					result2: "hidden",
					badResult2: "shown",
				})
				.cursor("fetch"),
			on("extremely").slots({ staleComment: "shown" }).cursor("0.3", { nth: 2 }),
			on("Instead").slots({ staleComment: "hidden", calls: "hidden", badResult2: "hidden" }).cursor("fetch"),
			on("Effect.promise")
				.slots({ thunkImpl: "shown", effectWrapOpen: "shown", effectWrapClose: "shown" })
				.cursor("Effect.promise")
				.bright("Effect.promise"),
			on("Promise", { after: "wrapping" })
				.cursor('() => fetch("/api/sensors").then(r => r.json())')
				.focus({ text: '() => fetch("/api/sensors").then(r => r.json())' }),
			on("inert")
				.slots({ mainType: "effect" })
				.cursor("Effect.Effect<any>")
				.focus.clear()
				.focus({ text: "Effect.Effect<any>" }),
			on("When", { after: "inert" }).slots({ run: "shown" }).cursor("runPromise").focus("run1", { persist: true }),
			on("run", { after: "When" }).cursor("runPromise").status("Effect.runPromise(sensorData)", "running"),
			on("succeed").cursor("runPromise").status("Effect.runPromise(sensorData)", "success", { persist: true }),
		],
	},

	component: {
		name: "EffectPromiseDemo",
		base: { show: false, state: "idle" },
		flow: [
			on("When", { after: "inert" }).state({ show: true }),
			on("run", { after: "When" }).state({ state: "running" }),
			on("succeed").state({ state: "completed" }),
		],
	},
})

// ============================================================================
// Composing Effects
// ============================================================================

const whyCompose = section("why-compose", {
	transcript: `
		Now that we can create and run a few primitive Effects, it's time to compose them into larger and more meaningful programs.

		In the preceding lessons, I've hacked my way around this by running one Effect and then separately running another.
		If Effect has anything to offer us, it's not down this path.

		We want to combine our effects without forfeiting their *blueprintness*.
		Ideally, our entire program will be composed into a single Effect that is run once at the very top of our application.
	`,

	code: {
		animation: slot.optional(
			"code",
			stack(
				line("import", 'import { Effect } from "effect"'),
				line("blank1", ""),
				line("getSensor", 'const sensorData = Effect.promise(() => fetch("/api/sensors").then(r => r.json()))'),
				line("shout", "const shout = (msg: string) => Effect.sync(() => console.log(msg))"),
				line("blank2", ""),
				slot.optional("run1", line("runSensor", "const { mSv } = await Effect.runPromise(sensorData)")),
				slot.optional("run2", line("runShout", 'await Effect.runPromise(shout(mSv < 1 ? "ALL CLEAR!" : "EVACUATE!"))')),
			),
		),
		base: { code: "shown" },
		flow: [
			// "hacked" - show run lines too
			on("hacked").slots({ run1: "shown", run2: "shown" }),
			// "running one Effect" - run the first one
			on("running").focus("runSensor").cursor("runPromise"),
			// "separately running another" - run the second one
			on("separately").focus("runShout").cursor("runPromise", { nth: 2 }),
			// "If Effect has anything to offer us" - clear focus
			on("If", { after: "another" }).focus.clear(),
			// "it's not down this path" - sad sound
			on("path").sound("sad"),
			// "We want to combine" - hide ALL code
			on("We", { after: "path" }).slots({ code: "hidden" }),
		],
	},

	component: {
		name: "WhyComposeDemo",
		base: {
			show: false,
			state1: "idle",
			state2: "idle",
			showLog2: false,
			showContainer: false,
			combined: false,
			showProgramNode: false,
			hideBackground: false,
			programState: "idle",
			showProgramLog: false,
		},
		flow: [
			// "hacked" - show both effects in idle state
			on("hacked").state({ show: true }),
			// "running" - first effect runs, then completes
			on("running").state({ state1: "running" }),
			on("running").offset(0.5).state({ state1: "completed" }),
			// "separately" - second effect starts running with log
			on("separately").state({ state2: "running", showLog2: true }),
			// "If Effect has anything..." - second effect completes, log hides
			on("If", { after: "another" }).state({ state2: "completed", showLog2: false }),
			// "We want to combine" - reset both effects
			on("We", { after: "path" }).state({ state1: "idle", state2: "idle" }),
			// "entire program" - show container around both
			on("entire").state({ showContainer: true }),
			// "single Effect" - combine into single "program" effect (border shrinks + node appears together)
			on("single").state({ combined: true, showProgramNode: true }),
			// "that is" - hide the background after it's settled behind the node
			on("that", { after: "single" }).state({ hideBackground: true }),
			// "run once" - run the program with log
			on("run", { after: "single" }).state({ programState: "running", showProgramLog: true }),
			// "application" - complete, hide log
			on("application").state({ programState: "completed", showProgramLog: false }),
		],
	},
})

const effectGenSyntax = section("effect-gen-syntax", {
	transcript: `
		To see how to compose Effects properly, let us briefly return to the vile \`Promise\`.

		To sequence these, we define a \`program\`, mark it \`async\`, \`await\` sensor data, \`await\` biometrics, then \`await\` analyze. As we all know, calling this will execute the first promise, then the second, then the third, resolving the outer \`program\`.

		And now, prepare yourself. First, we'll wrap each thunk in \`Effect.promise\`. And then, I'll gesture magnificently to the right. To the left. Back to the right. Promise. Effect. Async/Await. Effect.gen. Do you see it now?
	`,

	code: {
		animation: stack(
			// All const definitions wrapped in optional slot
			slot.optional(
				"consts",
				stack(
					// sensorData
					line("sensor1", ["const sensorData = ", slot.optional("sensorWrap", "Effect.promise("), "() =>"]),
					line("sensor2", "  fetch('/api/sensors').then(r => r.json())"),
					slot.optional("sensorClose", line("sensor3", ")")),
					line("blank1", ""),
					// biometrics
					line("bio1", ["const biometrics = ", slot.optional("bioWrap", "Effect.promise("), "() =>"]),
					line("bio2", "  fetch('/api/biometrics').then(r => r.json())"),
					slot.optional("bioClose", line("bio3", ")")),
					line("blank2", ""),
					// analyze - param before Effect.promise
					line("save1", ["const analyze = (data: unknown) =>", slot.optional("saveWrap", " Effect.promise(() =>")]),
					line("save2", "  fetch('/api/analyze', { method: 'POST', body: JSON.stringify(data) })"),
					slot.optional("saveClose", line("save3", ")")),
					line("blank3", ""),
				),
			),
			// Program
			slot.optional(
				"program",
				stack(
					line("programOpen", [
						"const program = ",
						slot.optional("asyncKw", "async "),
						slot("fnStyle", { async: "() => {", gen: "Effect.gen(function* () {" }),
					]),
					slot.optional(
						"awaitSensor",
						line("awaitSensorLine", [
							"  const { mSv } = ",
							slot("kw1", { await: "await", yield: "yield*" }),
							" sensorData",
							slot.optional("sensorParens", "()"),
						]),
					),
					slot.optional(
						"awaitBio",
						line("awaitBioLine", [
							"  const { pulse } = ",
							slot("kw2", { await: "await", yield: "yield*" }),
							" biometrics",
							slot.optional("bioParens", "()"),
						]),
					),
					slot.optional(
						"awaitSave",
						line("awaitSaveLine", ["  ", slot("kw3", { await: "await", yield: "yield*" }), " analyze({ mSv, pulse })"]),
					),
					line("programClose", ["}", slot.optional("programCloseExtra", ")")]),
				),
			),
			// Call block
			slot.optional("callBlock", stack(line("callBlank", ""), line("callLine", "await program()"))),
		),
		base: {
			// Start with Promise versions
			consts: "shown",
			sensorWrap: "hidden",
			sensorClose: "hidden",
			bioWrap: "hidden",
			bioClose: "hidden",
			saveWrap: "hidden",
			saveClose: "hidden",
			// Program hidden initially
			program: "hidden",
			asyncKw: "hidden",
			fnStyle: "async",
			awaitSensor: "hidden",
			awaitBio: "hidden",
			awaitSave: "hidden",
			kw1: "await",
			kw2: "await",
			kw3: "await",
			sensorParens: "shown",
			bioParens: "shown",
			programCloseExtra: "hidden",
			callBlock: "hidden",
		},
		flow: [
			// Build up the program
			on("program").slots({ program: "shown" }).cursor("program =").focus("programOpen", "programClose"),
			on("async").slots({ asyncKw: "shown" }).cursor("async").focus("programOpen", "programClose"),
			on("await")
				.slots({ awaitSensor: "shown" })
				.cursor("await")
				.focus("programOpen", "awaitSensorLine", "programClose"),
			on("await", { nth: 2 })
				.slots({ awaitBio: "shown" })
				.cursor("await", { nth: 2 })
				.focus("programOpen", "awaitSensorLine", "awaitBioLine", "programClose"),
			on("await", { nth: 3 })
				.slots({ awaitSave: "shown" })
				.cursor("await", { nth: 3 })
				.focus("programOpen", "awaitSensorLine", "awaitBioLine", "awaitSaveLine", "programClose"),
			// Show calling the program - evenly spaced triggers for each promise
			on("calling")
				.slots({ callBlock: "shown" })
				.cursor("program()")
				.focus("programOpen", "awaitSensorLine", "awaitBioLine", "awaitSaveLine", "programClose", "callLine", {
					persist: true,
				})
				.status("await program()", "running"),
			on("first")
				.cursor("await sensorData()", { substring: true })
				.status("await program()", "running")
				.status("await sensorData()", "running", { substring: true }),
			on("second")
				.cursor("await biometrics()", { substring: true })
				.status("await program()", "running")
				.status("await sensorData()", "success", { substring: true })
				.status("await biometrics()", "running", { substring: true }),
			on("third")
				.cursor("await analyze({ mSv, pulse })", { substring: true })
				.status("await program()", "running")
				.status("await sensorData()", "success", { substring: true })
				.status("await biometrics()", "success", { substring: true })
				.status("await analyze({ mSv, pulse })", "running", { substring: true }),
			on("program", { after: "outer" })
				.cursor("program()")
				.status("await program()", "success")
				.status("await sensorData()", "success", { substring: true })
				.status("await biometrics()", "success", { substring: true })
				.status("await analyze({ mSv, pulse })", "success", { substring: true }),
			// Effect transformation - "And" after "outer" to match "And now, prepare yourself"
			on("And", { after: "outer" }).focus.clear().status.clear().slots({ callBlock: "hidden" }),
			on("wrap").focus("sensor1", "sensor2", "sensor3", "bio1", "bio2", "bio3", "save1", "save2", "save3"),
			on("Effect.promise").slots({
				sensorWrap: "shown",
				sensorClose: "shown",
				bioWrap: "shown",
				bioClose: "shown",
				saveWrap: "shown",
				saveClose: "shown",
			}),
			// Hide consts and focus on program for the hand-waving
			on("gesture")
				.slots({ consts: "hidden" })
				.focus("programOpen", "awaitSensorLine", "awaitBioLine", "awaitSaveLine", "programClose", { persist: true }),
			// Magical transformation - right (to Effect.gen)
			on("right").slots({
				fnStyle: "gen",
				asyncKw: "hidden",
				kw1: "yield",
				kw2: "yield",
				kw3: "yield",
				sensorParens: "hidden",
				bioParens: "hidden",
				programCloseExtra: "shown",
			}),
			// Left (back to async/await)
			on("left").slots({
				fnStyle: "async",
				asyncKw: "shown",
				kw1: "await",
				kw2: "await",
				kw3: "await",
				sensorParens: "shown",
				bioParens: "shown",
				programCloseExtra: "hidden",
			}),
			// Right again
			on("right", { nth: 2 }).slots({
				fnStyle: "gen",
				asyncKw: "hidden",
				kw1: "yield",
				kw2: "yield",
				kw3: "yield",
				sensorParens: "hidden",
				bioParens: "hidden",
				programCloseExtra: "shown",
			}),
			// Promise → async/await
			on("Promise", { after: "right" }).slots({
				fnStyle: "async",
				asyncKw: "shown",
				kw1: "await",
				kw2: "await",
				kw3: "await",
				sensorParens: "shown",
				bioParens: "shown",
				programCloseExtra: "hidden",
			}),
			// Effect → Effect.gen (nth: 2 to skip "Effect" in "Effect.promise")
			on("Effect", { after: "Promise", nth: 2 }).slots({
				fnStyle: "gen",
				asyncKw: "hidden",
				kw1: "yield",
				kw2: "yield",
				kw3: "yield",
				sensorParens: "hidden",
				bioParens: "hidden",
				programCloseExtra: "shown",
			}),
			// Async/Await → async/await
			on("Async/Await").slots({
				fnStyle: "async",
				asyncKw: "shown",
				kw1: "await",
				kw2: "await",
				kw3: "await",
				sensorParens: "shown",
				bioParens: "shown",
				programCloseExtra: "hidden",
			}),
			// Effect.gen → Effect.gen (final)
			on("Effect.gen").slots({
				fnStyle: "gen",
				asyncKw: "hidden",
				kw1: "yield",
				kw2: "yield",
				kw3: "yield",
				sensorParens: "hidden",
				bioParens: "hidden",
				programCloseExtra: "shown",
			}),
		],
	},
})

const generatorsVsPromises = section("generators-vs-promises", {
	transcript: `
		Some internet ne'er-do-wells have suggested that Effect requires a PhD in generator functions.

		This is unadulterated poppycock. If you get \`async/await\`, you'll get \`Effect.gen\`. The former is, unfortunately, hard-coded to work with \`Promise\`, so the authors of Effect needed to come up with an alternate method of direct-style, sequential composition. And yes, it happens to involve a few asterisks.

		So when we execute this program, the first Effect will run until it completes, then the next, until the last. The fact that generator functions are involved is incidental. It is mere syntax.
	`,

	code: {
		animation: stack(
			line("programOpen", [
				"const program = ",
				slot.optional("asyncKw", "async "),
				slot.optional("effectGen", "Effect.gen("),
				slot.optional("fnStar", "function* "),
				"()",
				slot("arrow", { async: " =>", gen: "" }),
				" {",
			]),
			line("sensor", [
				"  const { mSv } = ",
				slot("kw1", { await: "await", yield: "yield*" }),
				" sensorData",
				slot.optional("sensorParens", "()"),
			]),
			line("bio", [
				"  const { pulse } = ",
				slot("kw2", { await: "await", yield: "yield*" }),
				" biometrics",
				slot.optional("bioParens", "()"),
			]),
			line("analyze", ["  ", slot("kw3", { await: "await", yield: "yield*" }), " analyze({ mSv, pulse })"]),
			line("programClose", ["}", slot.optional("closeExtra", ")")]),
		),
		base: {
			asyncKw: "hidden",
			effectGen: "shown",
			fnStar: "shown",
			arrow: "gen",
			kw1: "yield",
			kw2: "yield",
			kw3: "yield",
			sensorParens: "hidden",
			bioParens: "hidden",
			closeExtra: "shown",
		},
		flow: [
			on("async/await").slots({
				asyncKw: "shown",
				effectGen: "hidden",
				fnStar: "hidden",
				arrow: "async",
				kw1: "await",
				kw2: "await",
				kw3: "await",
				sensorParens: "shown",
				bioParens: "shown",
				closeExtra: "hidden",
			}),
			on("Effect.gen").slots({
				asyncKw: "hidden",
				effectGen: "shown",
				fnStar: "shown",
				arrow: "gen",
				kw1: "yield",
				kw2: "yield",
				kw3: "yield",
				sensorParens: "hidden",
				bioParens: "hidden",
				closeExtra: "shown",
			}),
			on("former").slots({
				asyncKw: "shown",
				effectGen: "hidden",
				fnStar: "hidden",
				arrow: "async",
				kw1: "await",
				kw2: "await",
				kw3: "await",
				sensorParens: "shown",
				bioParens: "shown",
				closeExtra: "hidden",
			}),
			on("authors").slots({
				asyncKw: "hidden",
				effectGen: "shown",
				fnStar: "shown",
				arrow: "gen",
				kw1: "yield",
				kw2: "yield",
				kw3: "yield",
				sensorParens: "hidden",
				bioParens: "hidden",
				closeExtra: "shown",
			}),
			on("asterisks").focus({ text: "function*" }).focus({ text: "yield*" }),
			on("So", { after: "asterisks" }).focus.clear(),
			on("first").focus("sensor").status("yield* sensorData", "running", { substring: true }),
			on("completes")
				.focus("bio")
				.status("yield* sensorData", "success", { substring: true })
				.status("yield* biometrics", "running", { substring: true }),
			on("next")
				.focus("analyze")
				.status("yield* sensorData", "success", { substring: true })
				.status("yield* biometrics", "success", { substring: true })
				.status("yield* analyze({ mSv, pulse })", "running", { substring: true }),
			on("last")
				.status("yield* sensorData", "success", { substring: true })
				.status("yield* biometrics", "success", { substring: true })
				.status("yield* analyze({ mSv, pulse })", "success", { substring: true }),
		],
	},

	component: {
		name: "GeneratorsDemo",
		base: { visible: false, sensor: "idle", bio: "idle", analyze: "idle" },
		flow: [
			on("this", { after: "execute" }).state({ visible: true }),
			on("first").state({ sensor: "running" }),
			on("completes").state({ sensor: "completed", bio: "running" }),
			on("next").state({ bio: "completed", analyze: "running" }),
			on("last").state({ analyze: "completed" }),
		],
	},

	glossary: {
		poppycock: "Nonsense; rubbish.",
	},
})

const genTypeInference = section("gen-type-inference", {
	transcript: `
		Here's another example. Given two effects, one to ask the user's name, and another their age, we want to write \`getUser\`.

		We'll call \`Effect.gen\` with a generator function, which is just like a normal function, only with a star for aesthetics. Next, we'll get the user's name, only we can't use \`askName\` directly because that's an \`Effect\`. We must tactically place a \`yield*\`. Again, this is semantically equivalent to awaiting a \`Promise\`.

		We do the same with \`askAge\`, and finally return a new object containing both properties. \`getUser\` is now an \`Effect\` of an object with a name that is a string and an age that is a number.

		Running this, \`askName\` succeeds with a string, \`askAge\` succeeds with a number, and \`getUser\` succeeds with their combination.
	`,

	code: {
		animation: stack(
			line("askName", [
				"const askName: ",
				slot("askNameThunk", { effect: "", promise: "() => " }),
				slot("askNameType", { effect: "Effect.Effect", promise: "Promise" }),
				"<string> = ...",
			]),
			line("askAge", [
				"const askAge: ",
				slot("askAgeThunk", { effect: "", promise: "() => " }),
				slot("askAgeType", { effect: "Effect.Effect", promise: "Promise" }),
				"<number> = ...",
			]),
			line("blank1", ""),
			slot.optional(
				"getUserLine",
				line("getUser", [
					"const getUser",
					slot.optional("getUserType", [
						": ",
						slot("getUserTypeWrapper", { effect: "Effect.Effect", promise: "Promise" }),
						"<",
						slot.optional("objectOpen", "{ "),
						slot.optional("nameLabel", "name: "),
						slot("nameType", { hidden: "", placeholder: "...", full: "string" }),
						slot.optional("afterNameType", "; "),
						slot.optional("ageLabel", "age: "),
						slot("ageType", { hidden: "", placeholder: "...", full: "number" }),
						slot.optional("objectClose", " }"),
						">",
					]),
					" = ",
					slot("genOrAsync", { effect: "Effect.gen(", promise: "async " }),
					slot.optional("fnStar", "function* "),
					"()",
					slot("arrowOrNot", { effect: "", promise: " =>" }),
					" {",
				]),
			),
			slot.optional(
				"nameLine",
				line("nameLine", [
					"  const name",
					slot.optional("nameLineType", [
						": ",
						slot.optional("effectWrapper", "Effect.Effect<"),
						"string",
						slot.optional("effectWrapperClose", ">"),
					]),
					" = ",
					slot("yieldOrAwait", { hidden: "", effect: "yield* ", promise: "await " }),
					"askName",
					slot("askNameCall", { effect: "", promise: "()" }),
				]),
			),
			slot.optional(
				"ageLine",
				line("ageLine", [
					"  const age = ",
					slot("yieldOrAwait2", { effect: "yield*", promise: "await" }),
					" askAge",
					slot("askAgeCall", { effect: "", promise: "()" }),
				]),
			),
			slot.optional(
				"returnLine",
				line("returnLine", [
					"  return",
					slot.optional("returnObject", [
						" {",
						slot.optional("returnName", " name"),
						slot.optional("returnAge", ", age"),
						" }",
					]),
				]),
			),
			slot.optional("closeLine", line("closeLine", ["}", slot("closeExtra", { effect: ")", promise: "" })])),
		),
		base: {
			askNameThunk: "effect",
			askNameType: "effect",
			askAgeThunk: "effect",
			askAgeType: "effect",
			getUserLine: "hidden",
			getUserType: "hidden",
			getUserTypeWrapper: "effect",
			objectOpen: "hidden",
			nameLabel: "hidden",
			nameType: "hidden",
			afterNameType: "hidden",
			ageLabel: "hidden",
			ageType: "placeholder",
			objectClose: "hidden",
			genOrAsync: "effect",
			fnStar: "hidden",
			arrowOrNot: "effect",
			nameLine: "hidden",
			nameLineType: "hidden",
			effectWrapper: "shown",
			effectWrapperClose: "shown",
			yieldOrAwait: "effect",
			askNameCall: "effect",
			yieldOrAwait2: "effect",
			askAgeCall: "effect",
			ageLine: "hidden",
			returnLine: "hidden",
			returnObject: "hidden",
			returnName: "hidden",
			returnAge: "hidden",
			closeLine: "hidden",
			closeExtra: "effect",
		},
		flow: [
			on("name,").cursor("askName").focus("askName"),
			on("age,").cursor("askAge").focus("askAge"),
			on("getUser").slots({ getUserLine: "shown", closeLine: "shown" }).cursor("getUser").focus("getUser", "closeLine"),
			on("Effect.gen").cursor("Effect.gen"),
			on("generator").slots({ fnStar: "shown" }).cursor("function*"),
			on("star", { after: "a" }).cursor("*").bright("*").burst("*", "⭐").sound("ping1"),
			on("name", { nth: 2 })
				.slots({ nameLine: "shown", yieldOrAwait: "hidden", nameLineType: "shown" })
				.cursor("name")
				.focus("nameLine", { persist: true }),
			on("askName").cursor("askName", { nth: 2 }),
			on("Effect", { after: "that's" }).cursor("Effect.Effect<string>", { nth: 2 }),
			on("yield*")
				.slots({ yieldOrAwait: "effect", effectWrapper: "hidden", effectWrapperClose: "hidden" })
				.cursor("yield*")
				.bright("yield*"),
			on("awaiting").cursor("yield*"),
			// Switch to Promise mode
			on("Promise")
				.slots({
					askNameThunk: "promise",
					askNameType: "promise",
					askAgeThunk: "promise",
					askAgeType: "promise",
					genOrAsync: "promise",
					fnStar: "hidden",
					arrowOrNot: "promise",
					yieldOrAwait: "promise",
					askNameCall: "promise",
					closeExtra: "promise",
				})
				.cursor("await")
				.focus("askName", "askAge", "getUser", "nameLine", "closeLine"),
			// Switch back to Effect mode on "We"
			on("We", { after: "Promise" })
				.slots({
					askNameThunk: "effect",
					askNameType: "effect",
					askAgeThunk: "effect",
					askAgeType: "effect",
					genOrAsync: "effect",
					fnStar: "shown",
					arrowOrNot: "effect",
					yieldOrAwait: "effect",
					askNameCall: "effect",
					closeExtra: "effect",
					nameLineType: "hidden",
				})
				.cursor("yield*")
				.focus("nameLine", { persist: true }),
			on("askAge,").slots({ ageLine: "shown" }).cursor("age").focus("ageLine"),
			on("return").slots({ returnLine: "shown" }).cursor("return").focus("returnLine"),
			on("object").slots({ returnObject: "shown" }).cursor("{", { nth: 2 }),
			on("both").slots({ returnName: "shown" }).cursor("name", { nth: 2 }),
			on("properties").slots({ returnAge: "shown" }).cursor("age", { nth: 2 }),
			on("now").slots({ getUserType: "shown" }).cursor("...", { nth: 3 }).focus("getUser"),
			on("object", { nth: 2 }).slots({ objectOpen: "shown", objectClose: "shown" }).cursor("{"),
			on("name", { nth: 3 }).slots({ nameLabel: "shown", nameType: "placeholder", ageType: "hidden" }).cursor("name:"),
			on("string")
				.slots({ nameType: "full", afterNameType: "shown", ageType: "placeholder" })
				.cursor("string", { nth: 2 }),
			on("age", { nth: 2 }).slots({ ageLabel: "shown" }).cursor("age:"),
			on("number").slots({ ageType: "full" }).cursor("number", { nth: 2 }),
			// Execution - status on the lines inside getUser (L5, L6, L7)
			on("this", { after: "Running" }).status("yield* askName", "running"),
			on("succeeds").status("yield* askName", "success").status("yield* askAge", "running"),
			on("succeeds", { nth: 2 })
				.status("yield* askName", "success")
				.status("yield* askAge", "success")
				.status("{ name, age }", "running"),
			on("combination")
				.status("yield* askName", "success")
				.status("yield* askAge", "success")
				.status("{ name, age }", "success"),
		],
	},

	component: {
		name: "GetUserDemo",
		base: { visible: false, askName: "idle", askAge: "idle", getUser: "idle" },
		flow: [
			on("Running").state({ visible: true }),
			on("this", { after: "Running" }).state({ askName: "running", getUser: "running" }),
			on("succeeds").state({ askName: "completed", askAge: "running" }),
			on("succeeds", { nth: 2 }).state({ askAge: "completed" }),
			on("combination").state({ getUser: "completed" }),
		],
	},
})

const errorsShortCircuit = section("errors-short-circuit", {
	transcript: `
		I must admit I lied a little when suggesting \`Effect.gen\` was morally equivalent to \`async/await\`. It's actually much better.

		Consider the sleep-deprived user who enters "banana" instead of her age. Perhaps we should fail with a \`BadNumber\` error.

		The moment this is added to \`askAge\`'s type, it changes the type of \`getUser\`. Likewise, if \`askName\` starts getting picky, its error automatically propagates to the outer type, forming a union of all possible errors.

		We now have three execution paths. \`askName\` could fail, causing \`getUser\` to fail. Or it could succeed, only for \`askAge\` to fail, short-circuiting once more. Or everything succeeds, hooray.
	`,

	code: {
		animation: stack(
			line("askName", ["const askName: Effect.Effect<string", slot.optional("askNameError", ", NoSams"), "> = ..."]),
			line("askAge", ["const askAge: Effect.Effect<number", slot.optional("askAgeError", ", BadNumber"), "> = ..."]),
			line("blank1", ""),
			line("getUser", [
				"const getUser: Effect.Effect<{ name: string; age: number }",
				slot.optional("getUserError", [
					", ",
					slot.optional("badNumber", "BadNumber"),
					slot.optional("errorUnion", " | NoSams"),
				]),
				"> =",
			]),
			line("genOpen", "  Effect.gen(function* () {"),
			line("nameLine", "    const name = yield* askName"),
			line("ageLine", "    const age = yield* askAge"),
			line("returnLine", "    return { name, age }"),
			line("genClose", "  })"),
		),
		base: {
			askNameError: "hidden",
			askAgeError: "hidden",
			getUserError: "hidden",
			badNumber: "hidden",
			errorUnion: "hidden",
		},
		flow: [
			// "suggesting Effect.gen was morally equivalent"
			on("Effect.gen").cursor("Effect.gen"),
			// "Consider the sleep-deprived user who enters banana"
			on("banana").cursor("askAge").focus("askAge", "ageLine"),
			// "fail with a BadNumber error"
			on("BadNumber").slots({ askAgeError: "shown" }).cursor("BadNumber").focus("askAge").bright("BadNumber"),
			// "it changes the type of getUser"
			on("changes")
				.slots({ getUserError: "shown", badNumber: "shown" })
				.cursor("BadNumber", { nth: 2 })
				.focus("getUser"),
			// "if askName starts getting picky"
			on("picky").slots({ askNameError: "shown" }).cursor("NoSams").focus("askName").bright("NoSams"),
			// "forming a union of all possible errors"
			on("union").slots({ errorUnion: "shown" }).cursor("BadNumber | NoSams"),
			// "We now have three execution paths" - hide cursor
			on("We", { nth: 2 }).cursor.clear(),
			// First failure path: askName fails
			on("askName", { nth: 2 }).status("yield* askName", "running", { persist: true }),
			on("fail", { nth: 2 }).status("yield* askName", "error", { persist: true }),
			// Second failure path: askAge fails
			on("Or").status.clear().status("yield* askName", "running", { persist: true }),
			on("succeed")
				.status("yield* askName", "success", { persist: true })
				.status("yield* askAge", "running", { persist: true }),
			on("fail", { nth: 4 })
				.status("yield* askName", "success", { persist: true })
				.status("yield* askAge", "error", { persist: true }),
			// Success path
			on("Or", { nth: 2 })
				.status.clear()
				.status("yield* askName", "running", { persist: true })
				.status("yield* askAge", "running", { persist: true }),
			on("everything")
				.status("yield* askName", "success", { persist: true })
				.status("yield* askAge", "running", { persist: true }),
			on("succeeds")
				.status("yield* askName", "success", { persist: true })
				.status("yield* askAge", "success", { persist: true }),
		],
	},

	component: {
		name: "ErrorShortCircuitDemo",
		base: {
			visible: false,
			mode: "success",
			askName: "idle",
			askAge: "idle",
			getUser: "idle",
			inputVisible: false,
			typedText: "",
			enterPressed: false,
			inputShake: false,
			inputError: false,
		},
		flow: [
			// "Consider" - show input and animate typing
			on("Consider").state({ inputVisible: true }),
			on("banana").offset(0.0).state({ typedText: "b" }),
			on("banana").offset(0.08).state({ typedText: "ba" }),
			on("banana").offset(0.16).state({ typedText: "ban" }),
			on("banana").offset(0.24).state({ typedText: "bana" }),
			on("banana").offset(0.32).state({ typedText: "banan" }),
			on("banana").offset(0.4).state({ typedText: "banana" }),
			on("banana").offset(0.6).state({ enterPressed: true }),
			// "age" - release enter, shake, and show error
			on("age").state({ enterPressed: false, inputShake: true, inputError: true }),
			// "We now have three execution paths" - hide input, show component, all idle
			on("We", { nth: 2 }).state({
				inputVisible: false,
				inputShake: false,
				inputError: false,
				typedText: "",
				visible: true,
				askName: "idle",
				askAge: "idle",
				getUser: "idle",
			}),
			// "askName could fail" - askName starts running, set mode for NoSams error
			on("askName", { nth: 2 }).state({ mode: "fail-name", askName: "running", getUser: "running" }),
			// "could fail" (fail #2) - askName fails, getUser keeps running
			on("fail", { nth: 2 }).state({ askName: "failed" }),
			// "causing getUser to fail" (fail #3) - getUser fails with NoSams
			on("fail", { nth: 3 }).state({ getUser: "failed" }),
			// "Or it could succeed" - reset, set mode for BadNumber error
			on("Or").state({ mode: "fail-age", askName: "running", askAge: "idle", getUser: "running" }),
			// "succeed" - askName succeeds, askAge starts running
			on("succeed").state({ askName: "completed", askAge: "running" }),
			// "askAge to fail" (fail #4) - askAge fails, getUser keeps running
			on("fail", { nth: 4 }).state({ askAge: "failed" }),
			// "short-circuiting once more" - getUser fails with BadNumber
			on("more").state({ getUser: "failed" }),
			// "Or everything" - all start running
			on("Or", { nth: 2 }).state({ mode: "success", askName: "running", askAge: "running", getUser: "running" }),
			// "everything" - askName succeeds
			on("everything").state({ askName: "completed" }),
			// "succeeds" - askAge succeeds
			on("succeeds").state({ askAge: "completed" }),
			// "hooray" - getUser succeeds
			on("hooray").state({ getUser: "completed" }),
		],
	},
})

const branchTypeMerging = section("branch-type-merging", {
	transcript: `
		To get a better handle on how Effect's types infer, let's use \`succeed\` and \`fail\` together.

		To do this, we'll define the classic type-safe division example. \`safeDivide\` takes the numerator and the denominator, and then checks to see if we're about to divide by zero. If so, we will fail with \`DivisionByZero\`. Otherwise, we'll succeed with the quotient.

		TypeScript will correctly infer the return type is an \`Effect\` that can either succeed with a \`number\` or fail with \`DivisionByZero\`.
	`,

	code: {
		animation: stack(
			line("error", "class DivisionByZero extends Error {}"),
			line("blank1", ""),
			line("fnName", "const safeDivide ="),
			line("fnParams", [
				"  ",
				slot("xParam", {
					placeholder: "...",
					shown: "(x: number",
				}),
				slot.optional("yParam", ", y: number"),
				slot.optional("closeParen", ")"),
				slot.optional("returnType", [
					": Effect.Effect<",
					slot.optional("successType", "number"),
					slot.optional("comma", ", "),
					slot("errorType", { placeholder: "...", shown: "DivisionByZero" }),
					">",
				]),
				slot.optional("arrow", " => {"),
			]),
			slot("outerPlaceholder", {
				shown: line("outerPh", "    ..."),
				hidden: empty,
			}),
			slot.optional("ifOpen", line("ifOpen", ["    if (", slot("condition", { empty: "", shown: "y === 0" }), ") {"])),
			slot("innerPlaceholder", {
				shown: line("innerPh", "      ..."),
				hidden: empty,
			}),
			slot.optional(
				"failReturn",
				line("failReturn", [
					"      return ",
					slot("failExpr", {
						placeholder: "...",
						shown: "Effect.fail(",
					}),
					slot("failArg", {
						placeholder: "...",
						shown: "new DivisionByZero()",
					}),
					slot.optional("failClose", ")"),
				]),
			),
			slot.optional("ifClose", line("ifClose", "    }")),
			slot.optional(
				"succeedReturn",
				line("succeedReturn", [
					"    return ",
					slot("succeedExpr", {
						placeholder: "...",
						shown: "Effect.succeed(",
					}),
					slot("succeedArg", {
						placeholder: "...",
						shown: "x / y",
					}),
					slot.optional("succeedClose", ")"),
				]),
			),
			slot.optional("fnClose", line("fnClose", "  }")),
		),
		base: {
			xParam: "placeholder",
			yParam: "hidden",
			closeParen: "hidden",
			returnType: "hidden",
			successType: "hidden",
			comma: "hidden",
			errorType: "placeholder",
			arrow: "hidden",
			outerPlaceholder: "hidden",
			fnClose: "hidden",
			ifOpen: "hidden",
			condition: "empty",
			innerPlaceholder: "hidden",
			failReturn: "hidden",
			failExpr: "placeholder",
			failArg: "hidden",
			failClose: "hidden",
			ifClose: "hidden",
			succeedReturn: "hidden",
			succeedExpr: "placeholder",
			succeedArg: "hidden",
			succeedClose: "hidden",
		},
		flow: [
			on("safeDivide").cursor("safeDivide").bright("safeDivide").focus("fnName"),
			on("numerator")
				.slots({ xParam: "shown", closeParen: "shown", arrow: "shown", outerPlaceholder: "shown", fnClose: "shown" })
				.cursor("x: number")
				.focus("fnParams"),
			on("denominator").slots({ yParam: "shown" }).cursor("y: number").focus("fnParams"),
			on("checks")
				.slots({ outerPlaceholder: "hidden", ifOpen: "shown", innerPlaceholder: "shown", ifClose: "shown" })
				.cursor("if")
				.focus("ifOpen"),
			on("divide").slots({ condition: "shown" }).cursor("y === 0").focus("ifOpen"),
			on("so").slots({ innerPlaceholder: "hidden", failReturn: "shown" }).cursor("return").focus("failReturn"),
			on("fail", { after: "so" })
				.slots({ failExpr: "shown", failArg: "placeholder", failClose: "shown" })
				.cursor("Effect.fail")
				.bright("fail")
				.focus("failReturn"),
			on("DivisionByZero").slots({ failArg: "shown" }).cursor("new DivisionByZero()").focus("failReturn"),
			on("Otherwise")
				.slots({ succeedReturn: "shown", succeedExpr: "placeholder", succeedArg: "hidden" })
				.cursor("return", { nth: 2 })
				.focus("succeedReturn"),
			on("succeed", { after: "Otherwise" })
				.slots({ succeedExpr: "shown", succeedArg: "placeholder", succeedClose: "shown" })
				.cursor("Effect.succeed")
				.bright("succeed")
				.focus("succeedReturn"),
			on("quotient").slots({ succeedArg: "shown" }).cursor("x / y").focus("succeedReturn"),
			on("infer", { after: "quotient" }).slots({ returnType: "shown" }).cursor("Effect.Effect").focus("fnParams"),
			on("number", { after: "infer" })
				.slots({ successType: "shown", comma: "shown" })
				.cursor("<number")
				.focus("fnParams"),
			on("DivisionByZero", { nth: 2 })
				.slots({ errorType: "shown" })
				.cursor(", DivisionByZero>")
				.burst("Effect.Effect<number, DivisionByZero>", "✨")
				.focus("fnParams"),
		],
	},
})

// ============================================================================
// Chapter Definition
// ============================================================================

export default chapter(
	"basics",
	"Effect Basics",
	[
		group("intro", "Intro", [effectIsADescription, typesCaptureRuntime]),
		group("constructing", "Constructing Effects", [
			effectSucceed,
			runningEffects,
			effectFail,
			branchTypeMerging,
			effectSync,
			syncVsSucceed,
		]),
		group("wrapping-promises", "Wrapping Promises", [effectPromise, promisesAreEager, effectPromiseFix]),
		group("composing", "Composing Effects", [
			whyCompose,
			effectGenSyntax,
			generatorsVsPromises,
			genTypeInference,
			errorsShortCircuit,
		]),
	],
	{
		description: "Constructing, running, and composing basic Effects",
		order: 2,
	},
)
