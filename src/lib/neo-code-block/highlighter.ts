/**
 * Interface for syntax tokens
 */
export interface Token {
	text: string
	type: "keyword" | "type" | "string" | "number" | "operator" | "comment" | "identifier" | "punctuation" | "default"
	color?: string // Optional inline color from Shiki
}
