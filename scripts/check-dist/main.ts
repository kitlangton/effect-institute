import { existsSync } from "node:fs"
import path from "node:path"
import { FORBIDDEN, findAuthoringCode } from "./check-dist"

const dist = path.resolve(process.argv[2] ?? "dist")
if (!existsSync(dist)) {
	console.error(`check-dist: ${dist} does not exist; run vite build first`)
	process.exit(1)
}

const findings = findAuthoringCode(dist)
if (findings.length > 0) {
	console.error("check-dist: authoring code found in the production build:")
	for (const { file, marker } of findings) console.error(`  ${file}: "${marker}"`)
	console.error("Dev-only imports must be written as import.meta.env.DEV ? lazy(() => import(...)) : null")
	process.exit(1)
}
console.log(
	`check-dist: no authoring code in ${path.relative(process.cwd(), dist) || dist} (${FORBIDDEN.length} markers checked)`,
)
