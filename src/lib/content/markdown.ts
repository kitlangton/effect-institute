/**
 * Simple inline markdown parser for transcripts.
 *
 * Supports: **bold**, *italic*, `code`
 *
 * @module
 */

// Re-export WordStyle from canonical source
import { WordStyle } from "@/lib/tooling/types"

export { WordStyle }

export interface ParsedWord {
	readonly word: string
	readonly style?: WordStyle
	readonly paragraphBreak?: boolean
	readonly listItem?: boolean
	/** Text after this word (default " " if undefined). Empty string for hyphenated words. */
	readonly suffix?: string
}

export interface ParseResult {
	readonly text: string
	readonly words: readonly ParsedWord[]
}

/** Segment with optional style (intermediate representation) */
interface Segment {
	readonly text: string
	readonly style?: WordStyle
}

/** A block is either a paragraph or a list item */
interface Block {
	readonly text: string
	readonly isListItem: boolean
}

/**
 * Split markdown into blocks (paragraphs and list items).
 * List items are lines starting with `- ` or `* `.
 * Consecutive list items stay separate; paragraphs are joined.
 */
function splitIntoBlocks(markdown: string): Block[] {
	const lines = markdown.trim().split("\n")
	const blocks: Block[] = []
	let currentParagraph: string[] = []

	const flushParagraph = () => {
		if (currentParagraph.length > 0) {
			const text = currentParagraph.join(" ").replace(/\s+/g, " ").trim()
			if (text) blocks.push({ text, isListItem: false })
			currentParagraph = []
		}
	}

	for (const line of lines) {
		const trimmed = line.trim()

		// Empty line ends current paragraph
		if (!trimmed) {
			flushParagraph()
			continue
		}

		// List item (starts with - or * followed by space)
		const listMatch = trimmed.match(/^[-*]\s+(.+)$/)
		if (listMatch) {
			flushParagraph()
			blocks.push({ text: listMatch[1], isListItem: true })
			continue
		}

		// Regular line - add to current paragraph
		currentParagraph.push(trimmed)
	}

	flushParagraph()
	return blocks
}

/**
 * Parse markdown transcript to plain text and styled words.
 */
export function parseTranscript(markdown: string): ParseResult {
	const blocks = splitIntoBlocks(markdown)
	const words: ParsedWord[] = []

	for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
		const block = blocks[bIdx]
		const segments = tokenize(block.text)
		const isNewBlock = bIdx > 0

		for (let i = 0; i < segments.length; i++) {
			const seg = segments[i]

			// Code spans stay as single words (even with spaces like `Effect<A, E>`)
			// Other segments split by whitespace
			const segWords = seg.style?.code
				? [seg.text.trim()].filter((w) => w.length > 0)
				: seg.text.split(/\s+/).filter((w) => w.length > 0)

			for (let j = 0; j < segWords.length; j++) {
				const word = segWords[j]

				// Attach trailing punctuation to previous word
				if (/^[.,!?;:]+$/.test(word) && words.length > 0) {
					words[words.length - 1] = {
						...words[words.length - 1],
						word: words[words.length - 1].word + word,
					}
					continue
				}

				const isBlockStart = i === 0 && j === 0
				const isParagraphStart = isNewBlock && isBlockStart && words.length > 0
				const isListItem = block.isListItem && isBlockStart

				words.push({
					word,
					...(seg.style && { style: seg.style }),
					...(isParagraphStart && { paragraphBreak: true }),
					...(isListItem && { listItem: true }),
				})
			}
		}
	}

	// Post-process: compute suffix for each word
	// If next word starts with hyphen/dash, no space between them
	for (let i = 0; i < words.length - 1; i++) {
		const nextWord = words[i + 1].word
		if (/^[-–—]/.test(nextWord)) {
			words[i] = { ...words[i], suffix: "" }
		}
	}

	return {
		text: words.map((w) => w.word).join(" "),
		words,
	}
}

/**
 * Tokenize inline markdown to segments with styles.
 * Processes in order: code (highest precedence), bold, italic.
 */
function tokenize(text: string): Segment[] {
	return parseCode(text)
}

/** Parse `code` spans */
function parseCode(text: string): Segment[] {
	const results: Segment[] = []
	let remaining = text

	while (remaining.length > 0) {
		const match = remaining.match(/^(.*?)`([^`]+)`(.*)$/s)
		if (match) {
			const [, before, code, after] = match
			if (before) results.push(...parseBold(before))
			results.push({ text: code, style: { code: true } })
			remaining = after
		} else {
			results.push(...parseBold(remaining))
			break
		}
	}

	return results
}

/** Parse **bold** spans */
function parseBold(text: string): Segment[] {
	const results: Segment[] = []
	let remaining = text

	while (remaining.length > 0) {
		const match = remaining.match(/^(.*?)\*\*([^*]+)\*\*(.*)$/s)
		if (match) {
			const [, before, bold, after] = match
			if (before) results.push(...parseItalic(before))
			results.push({ text: bold, style: { bold: true } })
			remaining = after
		} else {
			results.push(...parseItalic(remaining))
			break
		}
	}

	return results
}

/** Parse *italic* spans (but not **) */
function parseItalic(text: string): Segment[] {
	const results: Segment[] = []
	let remaining = text

	while (remaining.length > 0) {
		// Match *text* but not **text**
		const match = remaining.match(/^(.*?)(?<!\*)\*([^*]+)\*(?!\*)(.*)$/s)
		if (match) {
			const [, before, italic, after] = match
			if (before) results.push({ text: before })
			results.push({ text: italic, style: { italic: true } })
			remaining = after
		} else {
			if (remaining) results.push({ text: remaining })
			break
		}
	}

	return results
}
