/**
 * Build-time TypeScript highlighting with Shiki (fine-grained core, JS regex engine, github-dark).
 *
 * @module
 */

import { createHighlighterCore, type HighlighterCore } from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"
import typescript from "shiki/langs/typescript.mjs"
import githubDark from "shiki/themes/github-dark.mjs"
import type { Token } from "@/lib/animated-code/slideshow"

/** Tokens for one line of code */
export type Highlight = (code: string) => readonly Token[]

/** No highlighting: the whole text as one uncolored token */
export const plainText: Highlight = (code) => [{ text: code, type: "default" }]

let highlighterPromise: Promise<HighlighterCore> | null = null

/** Load Shiki once, then highlight synchronously. Results are cached by text. */
export async function typescriptHighlighter(): Promise<Highlight> {
	const highlighter = await (highlighterPromise ??= createHighlighterCore({
		themes: [githubDark],
		langs: [typescript],
		engine: createJavaScriptRegexEngine(),
	}))
	const cache = new Map<string, readonly Token[]>()
	return (code) => {
		const cached = cache.get(code)
		if (cached) return cached
		const tokens: Token[] = []
		const lines = highlighter.codeToTokens(code, { lang: "typescript", theme: "github-dark" }).tokens
		for (const [index, line] of lines.entries()) {
			for (const token of line) {
				tokens.push(
					token.color
						? { text: token.content, type: "default", color: token.color }
						: { text: token.content, type: "default" },
				)
			}
			if (index < lines.length - 1) tokens.push({ text: "\n", type: "default" })
		}
		cache.set(code, tokens)
		return tokens
	}
}
