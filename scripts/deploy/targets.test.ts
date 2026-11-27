import path from "node:path"
import { describe, expect, it } from "vitest"
import { unstable_readConfig } from "wrangler"
import { checkDeployConfig, PRODUCTION_CONFIRMATION, productionRefusal, TARGETS } from "./targets"

const configPath = path.resolve(__dirname, "../../wrangler.jsonc")
const resolve = (env: string | undefined) =>
	unstable_readConfig({ config: configPath, ...(env ? { env } : {}) }, { hideWarnings: true })

const incidentBuild = {
	name: "effect-institute",
	targetEnvironment: null,
	routes: [
		{ pattern: "www.effect.institute/*", zone_name: "effect.institute" },
		{ pattern: "effect.institute/*", zone_name: "effect.institute" },
	],
}

describe("wrangler.jsonc as Wrangler resolves it", () => {
	it("defaults to dev with no routes", () => {
		const config = resolve(undefined)
		expect(checkDeployConfig("dev", { ...config, targetEnvironment: null })).toEqual([])
		expect(config.routes ?? []).toEqual([])
		expect(config.route).toBeUndefined()
	})

	it("keeps production behind env.production", () => {
		const config = resolve("production")
		expect(checkDeployConfig("production", { ...config, targetEnvironment: "production" })).toEqual([])
	})
})

describe("checkDeployConfig", () => {
	it("refuses a production-shaped build as dev", () => {
		const problems = checkDeployConfig("dev", incidentBuild)
		expect(problems.join("\n")).toMatch(/replace the production Worker/)
		expect(problems.join("\n")).toMatch(/effect\.institute route/)
	})

	it("refuses a dev build that inherited production routes", () => {
		const problems = checkDeployConfig("dev", {
			...incidentBuild,
			name: TARGETS.dev.workerName,
		})
		expect(problems).toEqual([
			expect.stringMatching(/^routes are/),
			"a non-production config claims an effect.institute route",
		])
	})

	it("refuses a production deploy of a top-level build", () => {
		expect(checkDeployConfig("production", incidentBuild)).toEqual([
			'build targets environment null, expected "production"',
		])
	})

	it("refuses custom domains", () => {
		const problems = checkDeployConfig("dev", {
			name: TARGETS.dev.workerName,
			targetEnvironment: null,
			routes: [{ pattern: "dev.effect.institute", custom_domain: true }],
		})
		expect(problems).toContain("custom domains are not allowed in this config")
	})
})

describe("productionRefusal", () => {
	it("requires the confirmation for a real production deploy", () => {
		expect(productionRefusal("production", {}, false)).toMatch(/Refusing/)
		expect(productionRefusal("production", { CONFIRM_PRODUCTION_DEPLOY: "yes" }, false)).toMatch(/Refusing/)
		expect(productionRefusal("production", { CONFIRM_PRODUCTION_DEPLOY: PRODUCTION_CONFIRMATION }, false)).toBeNull()
	})

	it("allows dry runs and dev", () => {
		expect(productionRefusal("production", {}, true)).toBeNull()
		expect(productionRefusal("dev", {}, false)).toBeNull()
	})
})
