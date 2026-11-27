import { on, section } from "@/lib/content"

export const welcome = section("welcome", {
	transcript: `
		Welcome to the **Effect Institute**.
		I'm Kit and I want to teach you Effect.

		But first, the briefest of tutorials. Pressing \`SPACE\`, as you may have discovered,
		will play or pause the current section. The \`↑\` and \`↓\` arrow keys will navigate between sections.

		When I finish this sentence, you'll claim a small greenish square to mark your progress,
		and then you can press \`SPACE\` to trigger the next section.
	`,
	links: {
		kit: "https://x.com/kitlangton",
	},
	component: {
		name: "KeyboardDiagram",
		base: {
			pressed: "none",
			activeWord: -1,
			showSpace: false,
			showArrows: false,
			showCompletion: false,
		},
		flow: [
			// Title words highlight as spoken (slight delay so restart doesn't flash)
			on("Welcome").offset(0.1).state({ activeWord: 0 }),
			on("to").after("Welcome").state({ activeWord: 1 }),
			on("the").state({ activeWord: 2 }),
			on("Effect").state({ activeWord: 3 }),
			on("Institute").state({ activeWord: 4 }),
			on("Kit").state({ activeWord: 999 }),

			// Spacebar appears and presses
			on("SPACE").state({ showSpace: true }),
			on("play").state({ pressed: "space" }),
			on("play").offset(0.4).state({ pressed: "none" }),
			on("pause").state({ pressed: "space" }),
			on("pause").offset(0.4).state({ pressed: "none" }),

			// Arrow keys appear and press
			on("The").after("section").state({ showArrows: true }),
			on("↑").state({ pressed: "up" }),
			on("↑").offset(0.4).state({ pressed: "none" }),
			on("↓").state({ pressed: "down" }),
			on("↓").offset(0.4).state({ pressed: "none" }),
			on("navigate").state({ pressed: "up" }),
			on("navigate").offset(0.4).state({ pressed: "none" }),
			on("between").state({ pressed: "down" }),
			on("between").offset(0.4).state({ pressed: "none" }),

			// Completion square appears
			on("claim").state({ showCompletion: true }),

			// Final spacebar
			on("SPACE").nth(2).state({ pressed: "space" }),
			on("SPACE").nth(2).offset(0.4).state({ pressed: "none" }),
		],
	},
})

export const welcomeControls = section("welcome-controls", {
	transcript: `
		Wow. You actually did it. As a prize, you get more tutorial.

		The \`R\` key will restart the current section.
		And the \`←\` and \`→\` arrow keys will jump
		backward and forward a couple of seconds.
	`,

	component: {
		name: "WelcomeControls",
		base: {
			highlightedKey: "none",
			hasRotated: false,
		},
		flow: [
			on("restart").state({ highlightedKey: "restart", hasRotated: true }),
			on("restart", { offset: 0.4 }).state({ highlightedKey: "none" }),
			on("←").state({ highlightedKey: "seek_left" }),
			on("←", { offset: 0.4 }).state({ highlightedKey: "none" }),
			on("→").state({ highlightedKey: "seek_right" }),
			on("→", { offset: 0.4 }).state({ highlightedKey: "none" }),
			on("backward").state({ highlightedKey: "seek_left" }),
			on("backward", { offset: 0.4 }).state({ highlightedKey: "none" }),
			on("forward").state({ highlightedKey: "seek_right" }),
			on("forward", { offset: 0.4 }).state({ highlightedKey: "none" }),
		],
	},
})

export const welcomeFeedback = section("welcome-feedback", {
	transcript: `
		Finally, there's a settings button at the top of the screen. In there, you can control playback speed, as well as file feedback. All feedback is appreciated.

		This is very much alpha software at the moment, so please bear with me. I'll continue to add lessons and superfluous animations until I die.

		Let us now become **effect-pilled**.
	`,
	glossary: {
		superfluous: "Exceeding what is necessary or sufficient; extra, unnecessary.",
	},

	component: {
		name: "WelcomeFeedback",
		base: {
			stage: "settings",
			cursorState: "hidden",
			selectedSpeed: "none",
			sendButtonPressed: false,
			feedbackSent: false,
			actualSpeed: null,
		},
		flow: [
			// "Finally, there's a settings button at the top of the screen. In there, you can control playback..."
			// Cursor appears and approaches
			on("Finally").state({ cursorState: "approaching" }),
			// Cursor hovers over button
			on("settings").state({ cursorState: "hovering" }),
			// Cursor clicks just before "In there"
			on("screen").state({ cursorState: "clicking" }),
			// Transition to playback after click
			on("In").state({
				stage: "playback",
				cursorState: "hidden",
				selectedSpeed: "1×",
				actualSpeed: null,
			}),

			// Speed selector cycles through options - actually change playback speed!
			// (Safari skips actual speed changes due to WebKit bugs with playbackRate)
			on("you").state({ selectedSpeed: "0.75×", actualSpeed: 0.75 }),
			on("control").state({ selectedSpeed: "0.5×", actualSpeed: 0.5 }),
			on("speed").state({ selectedSpeed: "1.5×", actualSpeed: 1.5 }),
			on("as").state({ selectedSpeed: "2×", actualSpeed: 2 }),
			on("as").nth(2).state({ selectedSpeed: "1×", actualSpeed: 1 }),

			// Transition to feedback (override auto-cleared by component)
			on("feedback").state({ stage: "feedback" }),

			// Button press then send
			on("is").state({ sendButtonPressed: true }),
			on("appreciated").state({ sendButtonPressed: false, feedbackSent: true }),

			// "Let us now become effect-pilled" - show the badge
			on("become").state({ stage: "badge" }),
		],
	},
})
