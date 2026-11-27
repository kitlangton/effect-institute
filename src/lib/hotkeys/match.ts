import type { KeyCombo, KeySequence } from "./types"

const matchesRequired = (required: boolean | undefined, actual: boolean) => {
	if (required === true) return actual === true
	return actual === false
}

const matchesShift = (required: boolean | undefined, actual: boolean) => {
	if (required === undefined) return true
	return required === actual
}

export const comboMatches = (combo: KeyCombo, actual: KeyCombo): boolean => {
	if (combo.key !== actual.key) return false
	if (!matchesRequired(combo.ctrl, actual.ctrl ?? false)) return false
	if (!matchesRequired(combo.alt, actual.alt ?? false)) return false
	if (!matchesRequired(combo.meta, actual.meta ?? false)) return false
	if (!matchesShift(combo.shift, actual.shift ?? false)) return false
	return true
}

export const sequenceMatches = (sequence: KeySequence, buffer: KeySequence): boolean => {
	if (sequence.length > buffer.length) return false
	const start = buffer.length - sequence.length
	for (let i = 0; i < sequence.length; i += 1) {
		if (!comboMatches(sequence[i], buffer[start + i])) return false
	}
	return true
}

export const sequenceIsPrefix = (sequence: KeySequence, buffer: KeySequence): boolean => {
	if (buffer.length >= sequence.length) return false
	for (let i = 0; i < buffer.length; i += 1) {
		if (!comboMatches(sequence[i], buffer[i])) return false
	}
	return true
}

export const comboSpecificity = (combo: KeyCombo): number => {
	let score = 0
	if (combo.ctrl) score += 1
	if (combo.alt) score += 1
	if (combo.meta) score += 1
	if (combo.shift !== undefined) score += 1
	return score
}

export const sequenceSpecificity = (sequence: KeySequence): number =>
	sequence.reduce((sum, combo) => sum + comboSpecificity(combo), 0)
