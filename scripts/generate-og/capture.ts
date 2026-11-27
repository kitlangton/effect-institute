import path from "node:path"
import { Console, Effect } from "effect"
import { OUTPUT_DIR, TEMPLATE_ROUTE } from "./config"
import { screenshotPage } from "./page"
import { TemplateServer } from "./template-server"

export const captureOGImage = Effect.gen(function* () {
	const server = yield* TemplateServer
	const templateURL = new URL(TEMPLATE_ROUTE, server.baseUrl).toString()

	yield* Console.log(`Navigating to ${templateURL}...`)
	const filePath = yield* screenshotPage(templateURL, path.join(OUTPUT_DIR, "home.png"), "500 millis")
	yield* Console.log(`OG image generated: ${path.relative(process.cwd(), filePath)}`)
})
