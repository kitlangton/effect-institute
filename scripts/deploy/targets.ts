/**
 * Deploy targets and the checks that guard them.
 *
 * The Cloudflare Vite plugin writes the resolved Wrangler config into dist/server/wrangler.json.
 * These checks run against the built config that Wrangler will actually upload, so a mismatched
 * build can never reach the production Worker by accident.
 */

export type TargetName = "dev" | "production"

export interface DeployTarget {
	/** Value of CLOUDFLARE_ENV at build time; undefined builds the top-level config. */
	readonly cloudflareEnv: string | undefined
	readonly workerName: string
	readonly routePatterns: readonly string[]
}

export const PRODUCTION_WORKER = "effect-institute"
export const PRODUCTION_CONFIRMATION = "effect.institute"

export const TARGETS: Record<TargetName, DeployTarget> = {
	dev: {
		cloudflareEnv: undefined,
		workerName: "effect-institute-dev",
		routePatterns: [],
	},
	production: {
		cloudflareEnv: "production",
		workerName: PRODUCTION_WORKER,
		routePatterns: ["www.effect.institute/*", "effect.institute/*"],
	},
}

/** The subset of a resolved Wrangler config these checks read. */
export interface DeployConfig {
	readonly name?: string | undefined
	readonly targetEnvironment?: string | null | undefined
	readonly route?: unknown
	readonly routes?: readonly unknown[] | undefined
}

const routePattern = (route: unknown): string =>
	typeof route === "string" ? route : String((route as { pattern?: unknown }).pattern ?? JSON.stringify(route))

const isCustomDomain = (route: unknown): boolean =>
	typeof route === "object" && route !== null && (route as { custom_domain?: unknown }).custom_domain === true

/** Every reason `config` must not be deployed as `target`. Empty means safe. */
export const checkDeployConfig = (targetName: TargetName, config: DeployConfig): string[] => {
	const target = TARGETS[targetName]
	const problems: string[] = []

	if (config.name !== target.workerName) {
		problems.push(`Worker name is "${config.name}", expected "${target.workerName}"`)
	}
	if (targetName !== "production" && config.name === PRODUCTION_WORKER) {
		problems.push(`a ${targetName} deploy would replace the production Worker "${PRODUCTION_WORKER}"`)
	}

	const expectedEnv = target.cloudflareEnv ?? null
	const builtEnv = config.targetEnvironment ?? null
	if (builtEnv !== expectedEnv) {
		problems.push(`build targets environment ${JSON.stringify(builtEnv)}, expected ${JSON.stringify(expectedEnv)}`)
	}

	const routes = [...(config.routes ?? []), ...(config.route === undefined ? [] : [config.route])]
	const patterns = routes.map(routePattern).sort()
	const expected = [...target.routePatterns].sort()
	if (JSON.stringify(patterns) !== JSON.stringify(expected)) {
		problems.push(`routes are ${JSON.stringify(patterns)}, expected ${JSON.stringify(expected)}`)
	}
	if (routes.some(isCustomDomain)) problems.push("custom domains are not allowed in this config")
	if (targetName !== "production" && patterns.some((p) => p.includes("effect.institute"))) {
		problems.push("a non-production config claims an effect.institute route")
	}

	return problems
}

/** Production needs an explicit confirmation; dry runs upload nothing and are always allowed. */
export const productionRefusal = (
	targetName: TargetName,
	env: Record<string, string | undefined>,
	dryRun: boolean,
): string | null => {
	if (targetName !== "production" || dryRun) return null
	if (env.CONFIRM_PRODUCTION_DEPLOY === PRODUCTION_CONFIRMATION) return null
	return `Refusing to deploy the production Worker "${PRODUCTION_WORKER}". Set CONFIRM_PRODUCTION_DEPLOY=${PRODUCTION_CONFIRMATION} to deploy production on purpose.`
}
