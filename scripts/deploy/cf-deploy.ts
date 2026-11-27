/**
 * The only supported way to deploy this Worker.
 *
 *   bun scripts/deploy/cf-deploy.ts dev [--dry-run]
 *   CONFIRM_PRODUCTION_DEPLOY=effect.institute bun scripts/deploy/cf-deploy.ts production [--dry-run]
 *
 * Builds with the matching CLOUDFLARE_ENV, checks the built config Wrangler will upload (name, environment, routes),
 * deploys, and for non-production targets proves the production deployment did not change.
 */
import { existsSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"
import { parseArgs } from "node:util"
import {
	checkDeployConfig,
	type DeployConfig,
	PRODUCTION_WORKER,
	productionRefusal,
	TARGETS,
	type TargetName,
} from "./targets"

const root = path.resolve(import.meta.dir, "../..")
const redirectPath = path.join(root, ".wrangler/deploy/config.json")
const wrangler = ["bunx", "wrangler"]

const { values, positionals } = parseArgs({
	args: Bun.argv.slice(2),
	allowPositionals: true,
	options: {
		"dry-run": { type: "boolean", default: false },
	},
})

const targetName = positionals[0]
if (targetName !== "dev" && targetName !== "production") {
	console.error("Usage: bun scripts/deploy/cf-deploy.ts <dev|production> [--dry-run]")
	process.exit(2)
}
const target = TARGETS[targetName as TargetName]
const dryRun = values["dry-run"] === true

const refusal = productionRefusal(targetName, process.env, dryRun)
if (refusal) {
	console.error(refusal)
	process.exit(1)
}

const run = (cmd: string[], env: Record<string, string | undefined> = process.env) => {
	const proc = Bun.spawnSync(cmd, { cwd: root, env, stdio: ["inherit", "inherit", "inherit"] })
	if (proc.exitCode !== 0) throw new Error(`${cmd.join(" ")} exited with ${proc.exitCode}`)
}

const capture = (cmd: string[]): string => {
	const proc = Bun.spawnSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "pipe"] })
	if (proc.exitCode !== 0) throw new Error(`${cmd.join(" ")} failed: ${proc.stderr.toString().slice(-500)}`)
	return proc.stdout.toString()
}

const productionVersions = (): string => {
	const status = JSON.parse(capture([...wrangler, "deployments", "status", "--name", PRODUCTION_WORKER, "--json"])) as {
		versions: { version_id: string; percentage: number }[]
	}
	return status.versions.map((v) => `${v.version_id}@${v.percentage}%`).join(",")
}

const readBuiltConfig = (): DeployConfig => {
	if (!existsSync(redirectPath)) throw new Error(`build did not produce ${redirectPath}`)
	const redirect = JSON.parse(readFileSync(redirectPath, "utf8")) as { configPath: string }
	return JSON.parse(readFileSync(path.resolve(path.dirname(redirectPath), redirect.configPath), "utf8")) as DeployConfig
}

const buildEnv: Record<string, string | undefined> = { ...process.env, CLOUDFLARE_ENV: target.cloudflareEnv }
if (target.cloudflareEnv === undefined) delete buildEnv.CLOUDFLARE_ENV

try {
	rmSync(redirectPath, { force: true })
	run(["bun", "run", "build"], buildEnv)

	const problems = checkDeployConfig(targetName, readBuiltConfig())
	if (problems.length > 0) {
		throw new Error(`Refusing to deploy ${targetName}:\n${problems.map((p) => `  - ${p}`).join("\n")}`)
	}
	console.log(`Built config checked: ${target.workerName}, routes [${target.routePatterns.join(", ")}]`)

	const before = targetName === "production" || dryRun ? null : productionVersions()
	if (before) console.log(`Production ${PRODUCTION_WORKER} before: ${before}`)

	const sha = capture(["git", "rev-parse", "HEAD"]).trim()
	run([
		...wrangler,
		"deploy",
		...(target.cloudflareEnv ? ["--env", target.cloudflareEnv] : []),
		"--var",
		`GIT_COMMIT_SHA:${sha}`,
		...(dryRun ? ["--dry-run"] : []),
	])

	if (before) {
		const after = productionVersions()
		console.log(`Production ${PRODUCTION_WORKER} after:  ${after}`)
		if (after !== before) {
			throw new Error(
				`PRODUCTION CHANGED during a ${targetName} deploy (was ${before}). Roll back now: bunx wrangler rollback <version> --name ${PRODUCTION_WORKER}`,
			)
		}
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : error)
	process.exitCode = 1
} finally {
	// A production build left behind would let a bare `wrangler deploy` ship production again.
	if (targetName === "production") rmSync(redirectPath, { force: true })
}
