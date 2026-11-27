import { change, changelog, release } from "@/lib/changelog"

export default changelog([
	release("2026-02-02", [change("feature", "Added customizable **hotkey bindings**.")]),
	release("2026-01-08", [
		change("feature", "Added **volume control** to the settings menu."),
		change("feature", "Added this **changelog** to track updates."),
		change("improvement", "Seeking with arrow keys now scales with playback speed. At 2x, you skip twice as far.", {
			ref: "feedback",
		}),
	]),
	release("2026-01-07", [
		change(
			"content",
			"Released the first two chapters: [Introduction](/chapters/intro) and [Basics](/chapters/basics).",
		),
	]),
	release("2026-01-06", [
		change("fix", "Fixed audio glitches on Safari by bypassing Web Audio API."),
		change("fix", "Code blocks no longer get cut off on smaller screens."),
	]),
	release("2026-01-03", [
		change("feature", "Added adjustable playback speed controls."),
		change("improvement", "Homepage moved from `/chapters` to the root URL."),
		change("improvement", "Browser back/forward buttons now sync properly with playback position."),
	]),
])
