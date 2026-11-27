import { describe, expect, it } from "vitest"
import { formatDuration, formatTakeLabel, type KeyLike, recordingKeyAction } from "./logic"

const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({
	key: k,
	ctrlKey: false,
	metaKey: false,
	altKey: false,
	shiftKey: false,
	...mods,
})

describe("recordingKeyAction", () => {
	it("starts or restarts on Ctrl+R, recording or not", () => {
		expect(recordingKeyAction(key("r", { ctrlKey: true }), false, false)).toBe("start")
		expect(recordingKeyAction(key("R", { ctrlKey: true, shiftKey: true }), true, false)).toBe("start")
	})

	it("leaves Cmd+R (browser reload) alone", () => {
		expect(recordingKeyAction(key("r", { metaKey: true }), false, false)).toBeNull()
	})

	it("stops on Enter and discards on Escape only while recording", () => {
		expect(recordingKeyAction(key("Enter"), true, false)).toBe("stop")
		expect(recordingKeyAction(key("Escape"), true, false)).toBe("discard")
		expect(recordingKeyAction(key("Enter"), false, false)).toBeNull()
		expect(recordingKeyAction(key("Escape"), false, false)).toBeNull()
	})

	it("ignores Enter in form fields and with modifiers", () => {
		expect(recordingKeyAction(key("Enter"), true, true)).toBeNull()
		expect(recordingKeyAction(key("Enter", { shiftKey: true }), true, false)).toBeNull()
	})
})

describe("formatDuration", () => {
	it("formats minutes and seconds", () => {
		expect(formatDuration(0)).toBe("0:00")
		expect(formatDuration(75.9)).toBe("1:15")
	})
})

describe("formatTakeLabel", () => {
	const now = new Date(2026, 10, 27, 15, 0)
	it("uses relative day names for recent takes", () => {
		expect(formatTakeLabel(new Date(2026, 10, 27, 9, 5).toISOString(), now)).toMatch(/^Today /)
		expect(formatTakeLabel(new Date(2026, 10, 26, 9, 5).toISOString(), now)).toMatch(/^Yesterday /)
		expect(formatTakeLabel(new Date(2026, 10, 24, 9, 5).toISOString(), now)).toMatch(/^3 days ago /)
	})

	it("falls back to the raw value for unparseable dates", () => {
		expect(formatTakeLabel("not-a-date", now)).toBe("not-a-date")
	})
})
