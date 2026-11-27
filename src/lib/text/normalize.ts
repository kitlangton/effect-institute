/**
 * Word normalization and matching for DSL transcripts and step triggers.
 *
 * @module
 */

/**
 * Normalize a word for comparison/matching.
 * Lowercases and strips common punctuation and brackets.
 */
export function normalizeWord(word: string): string {
	return word
		.toLowerCase()
		.replace(/[.,!?;:'"()[\]{}<>]/g, "")
		.trim()
}

/**
 * Match a transcript/timing word against an author-provided reference.
 *
 * Directional: only allows the *word* to be longer than the ref (prefix match),
 * which avoids surprisingly matching unrelated shorter words.
 *
 * Example: `Promise<Order>` (word) matches ref `Promise`.
 */
export function wordMatchesRef(word: string, ref: string): boolean {
	const normalizedWord = normalizeWord(word)
	const normalizedRef = normalizeWord(ref)

	if (normalizedWord === normalizedRef) return true
	if (normalizedRef.length < 3) return false
	return normalizedWord.startsWith(normalizedRef)
}
