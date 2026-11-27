import type { Token } from "../highlighter"

/* ------------------------------------------------------------------ */
/* Token Splitting at Spotlight Boundaries                             */
/* ------------------------------------------------------------------ */

export interface TokenSegment {
	token: Token
	start: number
	end: number
	isSpotlit: boolean
}

/**
 * Splits tokens at spotlight boundaries so we can apply different opacities
 * to different parts of the same token.
 */
export function splitTokensAtSpotlightBoundaries(
	tokens: Token[],
	partOffset: number,
	spotlightRanges: Array<{ start: number; end: number }>,
): TokenSegment[] {
	const result: TokenSegment[] = []
	let charOffset = partOffset

	for (const token of tokens) {
		const tokenStart = charOffset
		const tokenEnd = charOffset + token.text.length
		charOffset = tokenEnd

		// Collect all boundary points within this token
		const boundaries = new Set<number>([tokenStart, tokenEnd])
		for (const r of spotlightRanges) {
			if (r.start > tokenStart && r.start < tokenEnd) boundaries.add(r.start)
			if (r.end > tokenStart && r.end < tokenEnd) boundaries.add(r.end)
		}

		// Sort boundaries and create segments
		const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b)
		for (let i = 0; i < sortedBoundaries.length - 1; i++) {
			const segStart = sortedBoundaries[i]
			const segEnd = sortedBoundaries[i + 1]
			const relStart = segStart - tokenStart
			const relEnd = segEnd - tokenStart
			const segmentText = token.text.slice(relStart, relEnd)

			// Check if this segment is within any spotlight range
			const isSpotlit = spotlightRanges.some((r) => segStart >= r.start && segEnd <= r.end)

			result.push({
				token: { ...token, text: segmentText },
				start: segStart,
				end: segEnd,
				isSpotlit,
			})
		}
	}

	return result
}
