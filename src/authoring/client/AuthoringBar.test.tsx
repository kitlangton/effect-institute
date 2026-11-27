// @vitest-environment jsdom
/**
 * Smoke test for the dev-only recording bar with the browser media APIs faked:
 * no microphone is used and nothing is played.
 */
import { RegistryProvider } from "@effect/atom-react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AuthoringBar } from "./AuthoringBar"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

class FakeRecorder {
	static isTypeSupported = (type: string) => type === "audio/webm"
	state: "inactive" | "recording" = "inactive"
	mimeType = "audio/webm"
	ondataavailable: ((e: { data: Blob }) => void) | null = null
	onstop: (() => void) | null = null
	constructor(readonly stream: MediaStream) {}
	start() {
		this.state = "recording"
	}
	stop() {
		this.state = "inactive"
		this.ondataavailable?.({ data: new Blob(["take"], { type: "audio/webm" }) })
		this.onstop?.()
	}
}

class FakeAudioContext {
	createAnalyser() {
		return { fftSize: 256, smoothingTimeConstant: 0, getFloatTimeDomainData: () => {} }
	}
	createMediaStreamSource() {
		return { connect: () => {} }
	}
	close() {
		return Promise.resolve()
	}
}

const requests: Array<{ url: string; method: string; body: unknown }> = []
const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: () => {} }] }) as unknown as MediaStream)

const respond = (url: string) => {
	if (url.startsWith("/__authoring/status")) return { ffmpeg: true, elevenLabsKey: false, voiceId: false }
	if (url.startsWith("/__authoring/takes")) return { takes: [] }
	if (url.startsWith("/__authoring/record")) {
		return {
			ok: true,
			result: { timingsSource: "estimated", notice: "No ELEVENLABS_API_KEY is set, so word timings were estimated" },
		}
	}
	return { ok: false, error: "unexpected" }
}

beforeEach(() => {
	requests.length = 0
	vi.stubGlobal("MediaRecorder", FakeRecorder)
	vi.stubGlobal("AudioContext", FakeAudioContext)
	vi.stubGlobal("requestAnimationFrame", () => 1)
	vi.stubGlobal("cancelAnimationFrame", () => {})
	Object.defineProperty(navigator, "mediaDevices", {
		configurable: true,
		value: {
			getUserMedia,
			enumerateDevices: async () => [],
			addEventListener: () => {},
			removeEventListener: () => {},
		},
	})
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string, init?: RequestInit) => {
			requests.push({ url, method: init?.method ?? "GET", body: init?.body })
			return new Response(JSON.stringify(respond(url)))
		}),
	)
})

afterEach(() => {
	vi.unstubAllGlobals()
	document.body.innerHTML = ""
})

const flush = () => act(async () => await new Promise((resolve) => setTimeout(resolve, 0)))
const press = (key: string, init: KeyboardEventInit = {}) =>
	act(async () => {
		window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }))
		await new Promise((resolve) => setTimeout(resolve, 0))
	})

describe("AuthoringBar", () => {
	it("records with Ctrl+R, saves with Enter, and shows the estimated-timings notice", async () => {
		const container = document.createElement("div")
		document.body.append(container)
		const root = createRoot(container)
		await act(async () =>
			root.render(
				<RegistryProvider>
					<AuthoringBar chapter="intro" sectionId="welcome" />
				</RegistryProvider>,
			),
		)
		await flush()
		expect(container.textContent).toContain("Ctrl+R record")
		expect(container.textContent).toContain("no ElevenLabs key")
		expect(getUserMedia).not.toHaveBeenCalled()

		await press("r", { ctrlKey: true })
		expect(getUserMedia).toHaveBeenCalledTimes(1)
		expect(container.textContent).toContain("Rec")

		await press("Enter")
		await flush()
		const upload = requests.find((r) => r.url.startsWith("/__authoring/record"))
		expect(upload?.method).toBe("POST")
		expect(upload?.url).toContain("chapter=intro")
		expect(upload?.url).toContain("section=welcome")
		expect(upload?.body).toBeInstanceOf(Blob)
		expect(container.textContent).toContain("Saved, timings estimated")
		expect(container.textContent).toContain("No ELEVENLABS_API_KEY is set")

		await act(async () => root.unmount())
	})

	it("discards a take with Esc without uploading", async () => {
		const container = document.createElement("div")
		document.body.append(container)
		const root = createRoot(container)
		await act(async () =>
			root.render(
				<RegistryProvider>
					<AuthoringBar chapter="intro" sectionId="welcome" />
				</RegistryProvider>,
			),
		)
		await press("r", { ctrlKey: true })
		await press("Escape")
		await flush()
		expect(requests.some((r) => r.url.startsWith("/__authoring/record"))).toBe(false)
		expect(container.textContent).toContain("Ctrl+R record")
		await act(async () => root.unmount())
	})
})
