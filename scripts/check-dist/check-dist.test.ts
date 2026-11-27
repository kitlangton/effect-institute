import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { findAuthoringCode } from "./check-dist"

let dir: string
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe("findAuthoringCode", () => {
	it("passes a clean build", () => {
		dir = mkdtempSync(path.join(tmpdir(), "dist-"))
		mkdirSync(path.join(dir, "client/assets"), { recursive: true })
		writeFileSync(path.join(dir, "client/assets/index.js"), "console.log('lesson')")
		expect(findAuthoringCode(dir)).toEqual([])
	})

	it("reports each leaked marker with its file", () => {
		dir = mkdtempSync(path.join(tmpdir(), "dist-"))
		mkdirSync(path.join(dir, "server"), { recursive: true })
		writeFileSync(path.join(dir, "server/index.js"), 'fetch("/__authoring/record");const k="ELEVENLABS_API_KEY"')
		expect(findAuthoringCode(dir)).toEqual([
			{ file: path.join("server", "index.js"), marker: "__authoring" },
			{ file: path.join("server", "index.js"), marker: "ELEVENLABS" },
		])
	})
})
