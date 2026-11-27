/**
 * Compile AnimationDef to frame-based SlideshowData with syntax highlighting.
 *
 * @module
 */

import type { Token } from "@/lib/neo-code-block/highlighter"
import { tokenizeWithShiki } from "@/lib/neo-code-block/shiki-highlighter"
import type { SlideshowData } from "@/lib/neo-code-block/types"
import type { AnimationDef } from "./animation"
import { compile } from "./compile/compile"

/**
 * Compile AnimationDef to SlideshowData and add syntax highlighting tokens.
 */
export async function compileAndTokenize(def: AnimationDef, language?: string): Promise<SlideshowData> {
	const data = compile(def)

	// Skip tokenization if no language specified or unsupported
	if (
		language !== "ts" &&
		language !== "typescript" &&
		language !== "js" &&
		language !== "javascript" &&
		language !== "json"
	) {
		return data
	}

	const tokenLang =
		language === "json" ? "json" : language === "js" || language === "javascript" ? "javascript" : "typescript"
	const tokenCache = new Map<string, Token[]>()

	// Tokenize each part in each frame
	for (const frame of data.frames) {
		for (const line of frame.lines) {
			// Get full line text from VISIBLE parts only
			// (hidden parts would produce invalid code, e.g., "// ..." followed by real code)
			const visibleParts = line.parts.filter((p) => p.isVisible)
			const fullText = visibleParts.map((p) => p.tokens.map((t) => t.text).join("")).join("")
			if (!fullText) continue

			// Stable lines recur across animation frames; highlight each distinct line once per section.
			let tokens = tokenCache.get(fullText)
			if (!tokens) {
				tokens = await tokenizeWithShiki(fullText, tokenLang)
				tokenCache.set(fullText, tokens)
			}

			// Assign tokens to visible parts only
			let offset = 0
			for (const part of visibleParts) {
				const partText = part.tokens.map((t) => t.text).join("")
				const partEnd = offset + partText.length

				// Slice tokens for this part
				part.tokens = sliceTokens(tokens, offset, partEnd)
				offset = partEnd
			}
		}
	}

	return data
}

/**
 * Slice tokens to extract a substring, preserving token boundaries.
 */
function sliceTokens(allTokens: Token[], start: number, end: number): Token[] {
	const sliced: Token[] = []
	let currentOffset = 0

	for (const token of allTokens) {
		const tokenStart = currentOffset
		const tokenEnd = tokenStart + token.text.length

		if (tokenEnd <= start || tokenStart >= end) {
			currentOffset += token.text.length
			continue
		}

		const sliceStart = Math.max(0, start - tokenStart)
		const sliceEnd = Math.min(token.text.length, end - tokenStart)
		const slicedText = token.text.slice(sliceStart, sliceEnd)

		if (slicedText) {
			sliced.push({ ...token, text: slicedText })
		}

		currentOffset += token.text.length
	}

	return sliced
}
