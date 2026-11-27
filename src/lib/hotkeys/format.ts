import { SHIFTED_SYMBOLS } from "./normalize"
import type { KeyCombo, KeySequence } from "./types"

const KEY_LABELS: Record<string, string> = {
	ArrowLeft: "Left",
	ArrowRight: "Right",
	ArrowUp: "Up",
	ArrowDown: "Down",
	Space: "Space",
	Escape: "Esc",
	Enter: "Enter",
	Home: "Home",
	End: "End",
}

const formatKey = (key: string) => {
	if (key.length === 1) return key.toUpperCase()
	return KEY_LABELS[key] ?? key
}

/** Returns array of key parts (e.g., ["Ctrl", "Shift", "A"]) for custom rendering */
export const getKeyParts = (combo: KeyCombo): string[] => {
	const parts: string[] = []
	if (combo.ctrl) parts.push("Ctrl")
	if (combo.alt) parts.push("Alt")
	if (combo.meta) parts.push("Cmd")
	// Skip shift for symbols where it's implicit
	const implicitShift = combo.key.length === 1 && SHIFTED_SYMBOLS.has(combo.key)
	if (combo.shift && !implicitShift) parts.push("Shift")
	parts.push(formatKey(combo.key))
	return parts
}

export const formatKeyCombo = (combo: KeyCombo): string => getKeyParts(combo).join("+")

export const formatKeySequence = (sequence: KeySequence): string =>
	sequence.map((combo) => formatKeyCombo(combo)).join(" then ")

export const serializeKeyCombo = (combo: KeyCombo): string => {
	const parts: string[] = []
	if (combo.ctrl) parts.push("ctrl")
	if (combo.alt) parts.push("alt")
	if (combo.meta) parts.push("meta")
	if (combo.shift) parts.push("shift")
	parts.push(combo.key)
	return parts.join("+")
}

export const serializeKeySequence = (sequence: KeySequence): string =>
	sequence.map((combo) => serializeKeyCombo(combo)).join(" ")
