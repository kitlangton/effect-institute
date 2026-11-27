import { Console, Context, Effect, Layer } from "effect"
import type { Browser as PlaywrightBrowser } from "playwright"
import { chromium } from "playwright"
import { ogError } from "./errors"

/** One headless Chromium for the whole run, closed when the program's scope closes. */
export class Browser extends Context.Service<Browser, PlaywrightBrowser>()("@effect-institute/og/Browser") {
	static readonly layer = Layer.effect(
		Browser,
		Effect.gen(function* () {
			const browser = yield* Effect.tryPromise({
				try: () => chromium.launch(),
				catch: ogError("Failed to launch browser"),
			})
			yield* Console.log("Browser launched")
			yield* Effect.addFinalizer(() =>
				Effect.promise(() => browser.close()).pipe(Effect.andThen(Console.log("Browser closed"))),
			)
			return browser
		}),
	)
}
