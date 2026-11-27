import { createHighlighterCore, type HighlighterCore } from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"
import javascript from "shiki/langs/javascript.mjs"
import json from "shiki/langs/json.mjs"
import typescript from "shiki/langs/typescript.mjs"
import githubDark from "shiki/themes/github-dark.mjs"
import type { Token } from "./highlighter"

let highlighterPromise: Promise<HighlighterCore> | null = null

/**
 * Get or create a cached Shiki highlighter instance.
 * Uses fine-grained shiki/core with the JS regex engine and only the grammars
 * used in course content (TypeScript, JavaScript, JSON) plus github-dark.
 */
function getHighlighter(): Promise<HighlighterCore> {
	return (highlighterPromise ??= createHighlighterCore({
		themes: [githubDark],
		langs: [typescript, javascript, json],
		engine: createJavaScriptRegexEngine(),
	}))
}

/**
 * Tokenize code using Shiki and convert to our Token format.
 * Returns tokens with text, type, and color properties.
 */
export async function tokenizeWithShiki(
	code: string,
	language: "typescript" | "javascript" | "json" = "typescript",
): Promise<Token[]> {
	const highlighter = await getHighlighter()

	const result = highlighter.codeToTokens(code, {
		lang: language,
		theme: "github-dark",
	})

	// Flatten multi-line tokens into a single array
	const tokens: Token[] = []

	for (let lineIndex = 0; lineIndex < result.tokens.length; lineIndex++) {
		const line = result.tokens[lineIndex]

		for (const token of line) {
			const shikiToken: Token = {
				text: token.content,
				type: "default", // Shiki uses colors directly, so we keep type as default
			}
			if (token.color) {
				shikiToken.color = token.color
			}
			tokens.push(shikiToken)
		}

		// Add newline token between lines (except after the last line)
		if (lineIndex < result.tokens.length - 1) {
			tokens.push({
				text: "\n",
				type: "default",
			})
		}
	}

	return tokens
}
