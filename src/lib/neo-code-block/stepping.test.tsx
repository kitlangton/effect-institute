// @vitest-environment jsdom
/**
 * Regression tests for NeoCodeBlock's bulletproof rendering model.
 *
 * Lines and parts never unmount: the current frame only changes animation
 * targets. These tests hammer the snapshot back and forth (interrupting
 * animations) and assert the DOM always converges to the current frame's
 * state: every line present, visible lines settle at full opacity, and the
 * measurable (non-excluded) text matches the frame's text exactly.
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { describe, expect, it } from "vitest"
import { type AnimationDef, line, slot, stack } from "@/lib/animated-code/animation"
import { compileAndTokenize } from "@/lib/animated-code/animation/compile-with-tokens"
import { Focus } from "@/lib/animated-code/annotations"
import { compress, expandFrame } from "@/lib/neo-code-block/compress"
import type { TemplateSlideshowData } from "@/lib/neo-code-block/types"
import { NeoCodeBlock } from "@/lib/neo-code-block/view/NeoCodeBlock"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// jsdom lacks matchMedia
window.matchMedia ??= ((query: string) => ({
	matches: false,
	media: query,
	addEventListener: () => {},
	removeEventListener: () => {},
	addListener: () => {},
	removeListener: () => {},
	onchange: null,
	dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia

// jsdom lacks ResizeObserver
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
}

const lifecycleDef: AnimationDef = {
	animation: stack(
		line("header", "const program = Effect.gen(function* () {"),
		slot.optional("fetch", line("fetch", '  const res = yield* fetchUser("42")')),
		slot.optional("validate", line("validate", "  const user = yield* decodeUser(res)")),
		slot.optional("save", line("save", "  yield* saveUser(user)")),
		line("return", ["  return ", slot("result", { raw: "res", parsed: "user" })]),
		line("close", "})"),
	),
	snapshots: [
		{ fetch: "hidden", validate: "hidden", save: "hidden", result: "raw" },
		{
			fetch: "shown",
			validate: "hidden",
			save: "hidden",
			result: "raw",
			annotations: [new Focus({ lines: ["fetch"] })],
		},
		{
			fetch: "shown",
			validate: "shown",
			save: "hidden",
			result: "parsed",
			annotations: [new Focus({ lines: ["validate", "return"] })],
		},
		{
			fetch: "shown",
			validate: "shown",
			save: "shown",
			result: "parsed",
			annotations: [new Focus({ lines: ["save"] })],
		},
		{ fetch: "shown", validate: "shown", save: "shown", result: "parsed" },
	],
}

const crossfadeDef: AnimationDef = {
	animation: stack(
		line("import", 'import { Effect } from "effect"'),
		line("call", [
			"const result = ",
			slot("mode", {
				promise: "await fetchData()",
				effect: "Effect.runPromise(getData)",
				layer: "Effect.runPromise(getData.pipe(Effect.provide(Live)))",
			}),
		]),
	),
	snapshots: [
		{ mode: "promise" },
		{ mode: "effect", annotations: [new Focus({ lines: ["call"] })] },
		{ mode: "layer" },
	],
}

async function compileFixture(def: AnimationDef): Promise<TemplateSlideshowData> {
	return compress(await compileAndTokenize(def, "ts"))
}

interface Harness {
	container: HTMLDivElement
	setSnapshot: (snapshot: number) => Promise<void>
	/** Lets animations run until `check` passes, failing with its last error after `timeoutMs`. */
	settle: (check: () => void, timeoutMs?: number) => Promise<void>
	unmount: () => void
}

async function mountBlock(code: TemplateSlideshowData): Promise<Harness> {
	const container = document.createElement("div")
	document.body.appendChild(container)
	let root: Root | undefined
	await act(async () => {
		root = createRoot(container)
		root.render(<NeoCodeBlock data={code} snapshot={0} />)
	})
	return {
		container,
		setSnapshot: async (snapshot) => {
			await act(async () => {
				root?.render(<NeoCodeBlock data={code} snapshot={snapshot} />)
			})
		},
		settle: async (check, timeoutMs = 5000) => {
			const deadline = Date.now() + timeoutMs
			for (;;) {
				await act(async () => {
					await new Promise((resolve) => setTimeout(resolve, 100))
				})
				try {
					check()
					return
				} catch (error) {
					if (Date.now() > deadline) throw error
				}
			}
		},
		unmount: () => {
			root?.unmount()
			container.remove()
		},
	}
}

/** The text a viewer (and the measurement Range walker) actually sees. */
function visibleLineText(container: HTMLElement, lineId: string): string | null {
	const lineEl = container.querySelector(`[data-line-id="${lineId}"]`)
	if (!lineEl) return null
	const clone = lineEl.cloneNode(true) as HTMLElement
	for (const hidden of clone.querySelectorAll("[data-measure-exclude]")) {
		hidden.remove()
	}
	return (clone.textContent ?? "").replace(/\u00a0/g, "")
}

function lineOpacity(container: HTMLElement, lineId: string): number {
	const el = container.querySelector(`[data-line-container-id="${lineId}"]`) as HTMLElement | null
	if (!el) return Number.NaN
	return parseFloat(el.style.opacity || "1")
}

/** Assert the DOM matches the given frame exactly. */
function expectFrameRendered(container: HTMLElement, code: TemplateSlideshowData, snapshot: number) {
	const frame = expandFrame(code.frames[snapshot], code.template)
	for (const line of frame.lines) {
		expect(visibleLineText(container, line.lineId), `line ${line.lineId} text at frame ${snapshot}`).toBe(line.text)
		const opacity = lineOpacity(container, line.lineId)
		const expected = line.dimmed ? 0.4 : 1
		expect(opacity, `line ${line.lineId} opacity at frame ${snapshot}`).toBeCloseTo(expected, 1)
	}
}

describe("NeoCodeBlock stepping", { timeout: 20_000 }, () => {
	it("converges after stepping forward through every frame", async () => {
		const code = await compileFixture(lifecycleDef)
		const harness = await mountBlock(code)

		for (let i = 1; i < code.frames.length; i++) {
			await harness.setSnapshot(i)
		}
		await harness.settle(() => expectFrameRendered(harness.container, code, code.frames.length - 1))

		harness.unmount()
	})

	it("converges after rapid back/forth hammering (no settling between steps)", async () => {
		const code = await compileFixture(lifecycleDef)
		const harness = await mountBlock(code)
		const last = code.frames.length - 1

		const sequence = [last, 0, last, 2, 0, 3, 1, last, 0, last]
		for (const snapshot of sequence) {
			await harness.setSnapshot(snapshot)
		}
		await harness.settle(() => expectFrameRendered(harness.container, code, last))

		await harness.setSnapshot(0)
		const lastFrame = expandFrame(code.frames[last], code.template)
		const firstFrame = expandFrame(code.frames[0], code.template)
		const firstIds = new Set(firstFrame.lines.map((l) => l.lineId))
		await harness.settle(() => {
			expectFrameRendered(harness.container, code, 0)
			for (const line of lastFrame.lines) {
				if (firstIds.has(line.lineId)) continue
				const opacity = lineOpacity(harness.container, line.lineId)
				expect(opacity, `line ${line.lineId} should hide at frame 0`).toBeLessThan(0.05)
			}
		})

		harness.unmount()
	})

	it("converges for crossfade version swaps under hammering", async () => {
		const code = await compileFixture(crossfadeDef)
		const harness = await mountBlock(code)
		const last = code.frames.length - 1

		const sequence = [last, 0, last, 1, last, 0, last]
		for (const snapshot of sequence) {
			await harness.setSnapshot(snapshot)
		}
		await harness.settle(() => expectFrameRendered(harness.container, code, last))

		harness.unmount()
	})
})
