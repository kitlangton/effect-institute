import type { KeyCombo } from "./types"

const KEY_ALIASES: Record<string, string> = {
	" ": "Space",
	Spacebar: "Space",
	Esc: "Escape",
}

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"])

// Symbols that are produced by Shift+key - shift is implicit for these
export const SHIFTED_SYMBOLS = new Set([
	"!",
	"@",
	"#",
	"$",
	"%",
	"^",
	"&",
	"*",
	"(",
	")",
	"<",
	">",
	"?",
	":",
	'"',
	"{",
	"}",
	"|",
	"~",
	"_",
	"+",
])

export function normalizeKey(rawKey: string): string | null {
	if (!rawKey || rawKey === "Unidentified" || rawKey === "Dead") return null
	const alias = KEY_ALIASES[rawKey]
	const key = alias ?? rawKey
	if (MODIFIER_KEYS.has(key)) return null
	if (key.length === 1 && /[a-zA-Z]/.test(key)) return key.toLowerCase()
	return key
}

export function normalizeEvent(event: KeyboardEvent): KeyCombo | null {
	const key = normalizeKey(event.key)
	if (!key) return null

	// Don't include shift for symbols where shift is implicit (e.g., < is Shift+,)
	const implicitShift = key.length === 1 && SHIFTED_SYMBOLS.has(key)

	return {
		key,
		...(event.ctrlKey ? { ctrl: true } : {}),
		...(event.shiftKey && !implicitShift ? { shift: true } : {}),
		...(event.altKey ? { alt: true } : {}),
		...(event.metaKey ? { meta: true } : {}),
	}
}
