import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { ArrowRightIcon, ArrowSquareOutIcon, BookOpenIcon } from "@phosphor-icons/react"
import { Atom, AsyncResult as Result } from "effect/reactivity"
import { motion } from "motion/react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { audioStateAtom, recentSeekAtom, seekToAtom } from "@/atoms/audioPlayer"
import { optionHeldAtom, overrideTooltipAtom } from "@/atoms/cursor"
import type { SectionData } from "@/atoms/narration"
import type { WordStyle, WordTiming } from "@/lib/tooling/types"

export type { WordStyle, WordTiming }

// --- Markdown text rendering (for fallback when wordTimings don't match) ---

interface StyledSegment {
	text: string
	style?: WordStyle | undefined
}

/** Parse simple markdown (bold, italic, code) into styled segments */
function parseMarkdownText(text: string): StyledSegment[] {
	const segments: StyledSegment[] = []
	// Match **bold**, *italic*, `code`
	const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
	let lastIndex = 0
	let match: RegExpExecArray | null

	while ((match = pattern.exec(text)) !== null) {
		// Add plain text before this match
		if (match.index > lastIndex) {
			segments.push({ text: text.slice(lastIndex, match.index) })
		}

		// Add styled segment
		if (match[2]) {
			// **bold**
			segments.push({ text: match[2], style: { bold: true } })
		} else if (match[3]) {
			// *italic*
			segments.push({ text: match[3], style: { italic: true } })
		} else if (match[4]) {
			// `code`
			segments.push({ text: match[4], style: { code: true } })
		}

		lastIndex = pattern.lastIndex
	}

	// Add remaining plain text
	if (lastIndex < text.length) {
		segments.push({ text: text.slice(lastIndex) })
	}

	return segments
}

/** Render a styled text segment */
function StyledText({ segment }: { segment: StyledSegment }) {
	const { text, style } = segment

	if (style?.code) {
		return (
			<span
				style={{
					fontFamily: "var(--font-mono, monospace)",
					backgroundColor: "rgba(255, 255, 255, 0.08)",
					padding: "0.1em 0.3em",
					borderRadius: "0.25em",
					fontSize: "0.9em",
				}}
			>
				{text}
			</span>
		)
	}

	return (
		<span
			style={{
				fontWeight: style?.bold ? 700 : undefined,
				fontStyle: style?.italic ? "italic" : undefined,
			}}
		>
			{text}
		</span>
	)
}

/** Render markdown text with styles, split into paragraphs */
function MarkdownText({ text }: { text: string }) {
	const paragraphs = useMemo(() => {
		return text.split(/\n\n+/).map((p) => parseMarkdownText(p.trim()))
	}, [text])

	return (
		<>
			{paragraphs.map((segments, pIndex) => (
				<p key={pIndex} className="leading-relaxed font-medium tracking-wide text-white text-left">
					{segments.map((segment, sIndex) => (
						<StyledText key={sIndex} segment={segment} />
					))}
				</p>
			))}
		</>
	)
}

// Start highlighting ~180ms before word actually starts
const WORD_START_OFFSET = -0.18

// Opacity values while playing
const OPACITY_UPCOMING = 0.3
const OPACITY_ACTIVE = 1.0
const OPACITY_PAST = 0.55

// Opacity values while paused (similar to playing so current position is clear)
const OPACITY_UPCOMING_PAUSED = 0.5
const OPACITY_ACTIVE_PAUSED = 1.0
const OPACITY_PAST_PAUSED = 0.65

// Spring configs
const springActive = {
	type: "spring" as const,
	visualDuration: 0.3,
	bounce: 0,
}
const springPast = { type: "spring" as const, visualDuration: 2, bounce: 0 }

type WordState = "upcoming" | "active" | "past"

/** Compute word state from current time - pure function for memoization */
function getWordState(word: WordTiming, currentTime: number, isFirst: boolean): WordState {
	const adjustedStart = word.start + WORD_START_OFFSET
	const isInTimeWindow = currentTime >= adjustedStart && currentTime <= word.end
	const isPast = currentTime > word.end
	const isAtStart = currentTime < 0.1

	return isInTimeWindow && !(isFirst && isAtStart) ? "active" : isPast ? "past" : "upcoming"
}

// Fixed opacity for inactive sections (noticeably dimmer than active)
const OPACITY_INACTIVE = 0.3

interface WordProps {
	word: WordTiming
	wordState: WordState
	isPlaying: boolean
	inactive?: boolean
	onWordClick?: ((wordTime: number) => void) | undefined
	/** When true, show underline on hover to indicate clickability */
	cmdHeld?: boolean
	/** When true, use fast snap transitions (after seek/jump) */
	recentSeek?: boolean
	/** Callback to mark that a seek just happened */
	onSeek?: () => void
}

/** Styling for words with dictionary definitions */
const DEFINITION_STYLE = {
	textDecoration: "underline",
	textDecorationStyle: "dotted" as const,
	textDecorationColor: "rgba(255, 255, 255, 0.6)",
	textUnderlineOffset: "3px",
}

/** Styling for words with hyperlinks */
const LINK_STYLE = {
	textDecoration: "underline",
	textDecorationStyle: "solid" as const,
	textDecorationColor: "rgba(255, 255, 255, 0.7)",
	textUnderlineOffset: "3px",
	cursor: "pointer" as const,
}

/** Render word content with optional code styling, definition underline, or link styling */
function WordContent({
	word,
	style,
	hasDefinition,
	hasLink,
	suffix,
}: {
	word: string
	style?: WordStyle | undefined
	hasDefinition?: boolean
	hasLink?: boolean
	/** Text after this word (default " " if undefined) */
	suffix?: string
}) {
	const spacing = suffix ?? " "

	// Determine which underline style to apply (link takes precedence over definition)
	const underlineStyle = hasLink ? LINK_STYLE : hasDefinition ? DEFINITION_STYLE : undefined

	if (style?.code) {
		// Separate code content from trailing punctuation
		const match = word.match(/^(.+?)([.,!?;:]+)?$/)
		const codeText = match?.[1] ?? word
		const punctuation = match?.[2] ?? ""

		return (
			<>
				<span
					style={{
						fontFamily: "var(--font-mono, monospace)",
						fontSize: "0.9em",
						backgroundColor: "rgba(255, 255, 255, 0.08)",
						padding: "0.15em 0.4em",
						border: "1px solid rgba(255, 255, 255, 0.15)",
						...underlineStyle,
					}}
				>
					{codeText}
				</span>
				{punctuation}
				{spacing}
			</>
		)
	}

	// Apply underline style only to the word, not the trailing space
	if (underlineStyle) {
		return (
			<>
				<span style={underlineStyle}>{word}</span>
				{spacing}
			</>
		)
	}

	return (
		<>
			{word}
			{spacing}
		</>
	)
}

// Fast snap transition for after seek/jump (200ms)
const springSnap = { type: "spring" as const, visualDuration: 0.2, bounce: 0 }

const Word = memo(function Word({
	word,
	wordState,
	isPlaying,
	inactive,
	onWordClick,
	cmdHeld,
	recentSeek,
	onSeek,
}: WordProps) {
	const hasDefinition = !!word.definition
	const hasLink = !!word.link
	const [isHovering, setIsHovering] = useState(false)
	const setOverride = useAtomSet(overrideTooltipAtom)
	const optionHeld = useAtomValue(optionHeldAtom)

	// Single effect to manage tooltip based on all state
	// This ensures tooltip updates immediately when cmdHeld changes while hovering
	// Skip if Option key is held (it has its own override)
	useEffect(() => {
		if (!isHovering || optionHeld) {
			return
		}

		if (cmdHeld && onWordClick) {
			// Show jump tooltip
			setOverride({ label: "Jump", icon: <ArrowRightIcon size={14} /> })
		} else if (hasLink) {
			// Show link tooltip
			setOverride({ label: word.link ?? "", icon: <ArrowSquareOutIcon size={14} /> })
		} else if (hasDefinition) {
			// Show definition tooltip
			setOverride({ title: "Definition", label: word.definition ?? "", icon: <BookOpenIcon size={14} /> })
		} else {
			// No tooltip to show
			setOverride(null)
		}
	}, [isHovering, optionHeld, cmdHeld, onWordClick, hasLink, word.link, hasDefinition, word.definition, setOverride])

	// Clear tooltip on mouse leave or unmount (unless Option is held)
	const handleMouseEnter = () => setIsHovering(true)
	const handleMouseLeave = () => {
		setIsHovering(false)
		if (!optionHeld) {
			setOverride(null)
		}
	}

	// Handle clicks: link click (normal click) or cmd+click to seek
	const handleClick = (e: React.MouseEvent) => {
		// cmd+click to seek (takes precedence)
		if ((e.metaKey || e.ctrlKey) && onWordClick) {
			e.preventDefault()
			e.stopPropagation()
			onSeek?.() // Mark recent seek for fast transitions
			// Seek to 50ms before word start
			onWordClick(Math.max(0, word.start - 0.05))
			return
		}

		// Normal click on link opens in new tab
		if (hasLink && word.link) {
			e.preventDefault()
			e.stopPropagation()
			window.open(word.link, "_blank", "noopener,noreferrer")
		}
	}

	// Word opacity: inactive sections use fixed dim opacity
	const opacity = inactive
		? OPACITY_INACTIVE
		: isPlaying
			? wordState === "active"
				? OPACITY_ACTIVE
				: wordState === "past"
					? OPACITY_PAST
					: OPACITY_UPCOMING
			: wordState === "active"
				? OPACITY_ACTIVE_PAUSED
				: wordState === "past"
					? OPACITY_PAST_PAUSED
					: OPACITY_UPCOMING_PAUSED

	// Glow on active word only while playing (never when inactive)
	const glow = !inactive && isPlaying && wordState === "active" ? 0.8 : 0
	const glowIntensity = glow * 12
	const textShadow = glow > 0 ? `0 0 ${glowIntensity}px rgba(255, 255, 100, ${glow})` : "none"

	// Use fast snap transition after seek, otherwise normal spring
	const transition = recentSeek ? springSnap : wordState === "past" ? springPast : springActive

	// Show underline when cmd held + hovering + word is clickable
	const showSeekIndicator = cmdHeld && isHovering && onWordClick

	return (
		<motion.span
			initial={false}
			animate={{ opacity, textShadow }}
			transition={transition}
			onClick={handleClick}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			style={{
				willChange: "opacity",
				backfaceVisibility: "hidden",
				fontWeight: word.style?.bold ? 700 : undefined,
				fontStyle: word.style?.italic ? "italic" : undefined,
				color: showSeekIndicator ? "rgb(250, 204, 21)" : undefined, // yellow-400 when seeking
			}}
		>
			<WordContent
				word={word.word}
				style={word.style}
				hasDefinition={hasDefinition}
				hasLink={hasLink}
				{...(word.suffix !== undefined && { suffix: word.suffix })}
			/>
		</motion.span>
	)
})

interface NarratedSectionProps {
	section: SectionData
	isActive: boolean
}

/** Static atom that never updates - used for inactive sections */
const inactiveAudioAtom = Atom.make(() =>
	Result.success({
		currentTime: 0,
		playbackState: "idle" as const,
		duration: 0,
		loadedSectionId: null,
	}),
)

/** A block is either a paragraph or a list item */
interface TextBlock {
	words: WordTiming[]
	isListItem: boolean
}

/** Group words into blocks (paragraphs and list items) */
function useTextBlocks(wordTimings: readonly WordTiming[]) {
	return useMemo(() => {
		const blocks: TextBlock[] = []
		let currentBlock: WordTiming[] = []
		let currentIsListItem = false

		for (const word of wordTimings) {
			// Start new block on paragraph break or list item
			if ((word.paragraphBreak || word.listItem) && currentBlock.length > 0) {
				blocks.push({ words: currentBlock, isListItem: currentIsListItem })
				currentBlock = []
			}

			// Track if this block is a list item (first word determines it)
			if (currentBlock.length === 0) {
				currentIsListItem = !!word.listItem
			}

			currentBlock.push(word)
		}

		if (currentBlock.length > 0) {
			blocks.push({ words: currentBlock, isListItem: currentIsListItem })
		}

		return blocks
	}, [wordTimings])
}

/**
 * Narration section renderer.
 * Single component structure ensures stable React tree across active/inactive transitions.
 * Uses conditional atom subscription: active sections subscribe to audioStateAtom,
 * inactive sections use a static atom that never updates (no re-renders).
 */
export const NarratedSection = memo(function NarratedSection({ section, isActive }: NarratedSectionProps) {
	const seekTo = useAtomSet(seekToAtom)
	const [cmdHeld, setCmdHeld] = useState(false)

	// Recent seek state for fast transitions
	const recentSeek = useAtomValue(recentSeekAtom)
	const setRecentSeek = useAtomSet(recentSeekAtom)
	const recentSeekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const markRecentSeek = useCallback(() => {
		if (recentSeekTimeoutRef.current) clearTimeout(recentSeekTimeoutRef.current)
		setRecentSeek(true)
		recentSeekTimeoutRef.current = setTimeout(() => setRecentSeek(false), 300)
	}, [setRecentSeek])

	// Track cmd/meta key state for seek indicator
	useEffect(() => {
		if (!isActive) return

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey) setCmdHeld(true)
		}
		const handleKeyUp = (e: KeyboardEvent) => {
			if (!e.metaKey && !e.ctrlKey) setCmdHeld(false)
		}
		const handleBlur = () => setCmdHeld(false)

		window.addEventListener("keydown", handleKeyDown)
		window.addEventListener("keyup", handleKeyUp)
		window.addEventListener("blur", handleBlur)
		return () => {
			window.removeEventListener("keydown", handleKeyDown)
			window.removeEventListener("keyup", handleKeyUp)
			window.removeEventListener("blur", handleBlur)
		}
	}, [isActive])

	// Conditionally subscribe: active uses real atom, inactive uses static atom
	// When isActive changes, useMemo creates a new atom reference, causing re-subscription
	const audioAtom = useMemo(() => (isActive ? audioStateAtom : inactiveAudioAtom), [isActive])
	const audioResult = useAtomValue(audioAtom)

	// Group words into blocks (paragraphs and list items)
	const blocks = useTextBlocks(section.wordTimings)

	// Extract values from result
	const audioState = Result.isSuccess(audioResult) ? audioResult.value : null
	const currentTime = audioState?.currentTime ?? 0
	const isPlaying = audioState?.playbackState === "playing"

	// Enable word click to seek (active section only)
	const onWordClick = isActive ? seekTo : undefined

	// Track global word index for isFirst
	let globalIndex = 0

	// Container opacity: active adjusts for playback state, inactive is full (parent handles dimming)
	const containerOpacity = isActive ? (isPlaying ? 1.0 : 0.8) : 1.0

	// Fallback: if no word timings, render plain text or placeholder
	if (blocks.length === 0 || section.wordTimings.length === 0) {
		// Empty transcript: show placeholder
		if (!section.text || section.text.trim().length === 0) {
			return <div className="text-white/30 italic">No transcript</div>
		}
		return (
			<motion.div
				initial={false}
				animate={{ opacity: containerOpacity }}
				transition={springActive}
				className="space-y-4"
			>
				<MarkdownText text={section.text} />
			</motion.div>
		)
	}

	// Helper to render words in a block
	const renderWords = (words: WordTiming[]) =>
		words.map((word: WordTiming) => {
			const idx = globalIndex++

			// Active sections use computed state, inactive use fixed dim state
			if (isActive) {
				const wordState = getWordState(word, currentTime, idx === 0)
				return (
					<Word
						key={`${word.word}-${idx}`}
						word={word}
						wordState={wordState}
						isPlaying={isPlaying}
						onWordClick={onWordClick}
						cmdHeld={cmdHeld}
						recentSeek={recentSeek}
						onSeek={markRecentSeek}
					/>
				)
			}

			// Inactive: container handles dimming, words render at full opacity
			return <Word key={`${word.word}-${idx}`} word={word} wordState="upcoming" isPlaying={false} inactive />
		})

	// Group consecutive list items together
	const groupedBlocks: { blocks: TextBlock[]; isList: boolean }[] = []
	for (const block of blocks) {
		const lastGroup = groupedBlocks[groupedBlocks.length - 1]
		if (lastGroup && lastGroup.isList === block.isListItem) {
			lastGroup.blocks.push(block)
		} else {
			groupedBlocks.push({ blocks: [block], isList: block.isListItem })
		}
	}

	return (
		<motion.div initial={false} animate={{ opacity: containerOpacity }} transition={springActive} className="space-y-4">
			{groupedBlocks.map((group, gIndex) => {
				if (group.isList) {
					// Render as unordered list
					return (
						<ul key={gIndex} className="space-y-2 list-none">
							{group.blocks.map((block, bIndex) => (
								<li key={bIndex} className="leading-relaxed font-medium tracking-wide text-white text-left flex gap-3">
									<span className="text-white/40 select-none flex-shrink-0">-</span>
									<span>{renderWords(block.words)}</span>
								</li>
							))}
						</ul>
					)
				}

				// Render as paragraphs
				return group.blocks.map((block, bIndex) => (
					<p key={`${gIndex}-${bIndex}`} className="leading-relaxed font-medium tracking-wide text-white text-left">
						{renderWords(block.words)}
					</p>
				))
			})}
		</motion.div>
	)
})
