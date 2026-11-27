import { type Duration, Effect } from "effect"
import type { Page } from "playwright"
import { Browser } from "./browser"
import { DEVICE_SCALE, VIEWPORT } from "./config"
import { ogError } from "./errors"

/** Open `url` in a fresh OG-sized page, let animations settle, screenshot it to `filePath`, and close the page. */
export const screenshotPage = (url: string, filePath: string, settle: Duration.Input) =>
	Effect.gen(function* () {
		const browser = yield* Browser
		const page = yield* Effect.acquireRelease(
			Effect.tryPromise({
				try: () => browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE }),
				catch: ogError("Failed to open page"),
			}),
			(page: Page) => Effect.promise(() => page.close()),
		)
		yield* Effect.tryPromise({
			try: () => page.goto(url, { waitUntil: "networkidle" }),
			catch: ogError(`Failed to load ${url}`),
		})
		yield* Effect.sleep(settle)
		yield* Effect.tryPromise({
			try: () => page.screenshot({ path: filePath, type: "png" }),
			catch: ogError(`Failed to capture ${filePath}`),
		})
		return filePath
	}).pipe(Effect.scoped)
