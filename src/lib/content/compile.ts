/**
 * # Course Compiler
 *
 * Compiles DSL definitions to JSON format for runtime.
 *
 * Output files:
 * - `{section}.json` - Section data (text, code, animation)
 * - `{section}.timings.json` - Word timings from alignment (separate, AI-generated)
 *
 * @module
 */

import { createHash } from "node:crypto"
import { type Animation, type Snapshot, stack } from "@/lib/animated-code/animation/animation"
import { render, toPlainText } from "@/lib/animated-code/animation/render"
import type { StepRef } from "@/lib/animated-code/flow"
import {
	type CompiledComponentFlow,
	compileComponentFlow,
	compileFlow,
	extractLineIds,
	type FlowWarning,
	validateFlowPatterns,
	validateFlowWords,
} from "@/lib/animated-code/flow"
import { normalizeWord } from "@/lib/text"
import type { ChapterManifest, ManifestGroupEntry } from "@/lib/tooling/types"
import type { AnimatedCodeFlow, ChapterDef, GroupDef, SectionDef } from "./dsl"
import { isAnimatedCodeFlow, isComponentFlow, isGroup } from "./dsl"
import { parseTranscript, type WordStyle } from "./markdown"

export { type ParsedWord, parseTranscript, type WordStyle } from "./markdown"

// ============================================================================
// Output Types (what gets written to JSON)
// ============================================================================

/** Compiled section without timings */
export interface CompiledSection {
	readonly id: string
	/** Plain text (markdown stripped) */
	readonly text: string
	/** Code string (static or from animation) */
	readonly code: string
	/** Step-driven component flow (new mode - receives state per step) */
	readonly componentFlow?: CompiledComponentFlow
	/** Code animation (static code is a one-step animation), compiled to slideshowData by the build */
	readonly animation?: CompiledAnimation
	/** Hash of DSL content for change detection */
	readonly contentHash: string
	/** Group ID if section belongs to a group */
	readonly groupId?: string
	/** Group title if section belongs to a group */
	readonly groupTitle?: string
	/** Whether this is the first section in its group */
	readonly isFirstInGroup?: boolean
	/** Whether the group this section belongs to is a draft */
	readonly groupDraft?: boolean
}

/** Compiled animation with step references */
export interface CompiledAnimation {
	readonly animation: Animation
	readonly snapshots: readonly Snapshot[]
	readonly steps: readonly StepRef[]
}

// WordTiming imported from @/lib/tooling/types

/** Indexed timing - references DSL word by index */
export interface IndexedWordTiming {
	/** Index into DSL parsed words array */
	readonly index: number
	/** DSL word (redundant, for debugging) */
	readonly word: string
	readonly start: number
	readonly end: number
}

/** Timings file content (indexed format) */
export interface TimingsFile {
	readonly wordTimings: readonly IndexedWordTiming[]
	/** Hash of DSL transcript text */
	readonly textHash: string
	/** Number of words in DSL (for validation) */
	readonly wordCount: number
}

export type { ChapterManifest } from "@/lib/tooling/types"

// ============================================================================
// Warning Logging
// ============================================================================

function logFlowWarnings(sectionId: string, warnings: FlowWarning[], prefix = ""): void {
	for (const w of warnings) {
		const pre = prefix ? `${prefix}: ` : ""
		if (w.type === "word-not-found") {
			const suggestions = w.suggestions ? `. Did you mean: ${w.suggestions.join(", ")}?` : ""
			console.warn(
				`⚠ [${sectionId}] ${pre}Word "${w.word}" not found in transcript for step "${w.stepName}"${suggestions}`,
			)
		} else if (w.type === "pattern-not-found") {
			console.warn(
				`⚠ [${sectionId}] ${pre}Pattern "${w.pattern}" not found for annotation "${w.annotation}" in step "${w.stepName}"`,
			)
		} else if (w.type === "line-id-not-found") {
			console.warn(`⚠ [${sectionId}] ${pre}Line ID "${w.lineId}" not found in step "${w.stepName}"`)
		} else if (w.type === "slot-not-found") {
			const available = w.availableSlots.length > 0 ? `. Available slots: ${w.availableSlots.join(", ")}` : ""
			console.warn(`⚠ [${sectionId}] ${pre}Slot "${w.slotName}" not found in step "${w.stepName}"${available}`)
		}
	}
}

// ============================================================================
// Code Extraction
// ============================================================================

/**
 * Extract code string from CodeDef.
 * For animated code, renders the base state.
 */
export function extractCode(code: string | AnimatedCodeFlow): string {
	if (typeof code === "string") {
		return code.trim()
	}

	// Flow-based animated code: render with base state (defaults if not specified)
	const rendered = render(code.animation, code.base ?? {})
	return toPlainText(rendered)
}

// ============================================================================
// Hashing
// ============================================================================

/** Length of {@link hash} output: 16 hex chars = 64 bits of SHA-256. */
export const HASH_LENGTH = 16

/**
 * Content hash for change detection: SHA-256, hex, truncated to {@link HASH_LENGTH}.
 *
 * Build-time only (Bun/Node, or the Worker with `nodejs_compat`); never bundled for the browser.
 */
export function hash(content: string): string {
	return createHash("sha256").update(content).digest("hex").slice(0, HASH_LENGTH)
}

/**
 * The 32-bit hash used before {@link hash} switched to SHA-256.
 *
 * Only for reading `textHash` in timings files written by older alignments; never write it.
 */
export function legacyHash(content: string): string {
	let h = 0
	for (let i = 0; i < content.length; i++) {
		h = ((h << 5) - h + content.charCodeAt(i)) | 0
	}
	return h.toString(36)
}

/** Whether a stored hash (current or legacy format) matches `content`. */
export function hashMatches(stored: string, content: string): boolean {
	return stored === hash(content) || stored === legacyHash(content)
}

// ============================================================================
// Compilation
// ============================================================================

/** Parsed word with optional style (placeholder timing) */
export interface ParsedWordTiming {
	readonly word: string
	readonly start: number
	readonly end: number
	readonly style?: WordStyle
	readonly paragraphBreak?: boolean
	readonly listItem?: boolean
	readonly definition?: string
	readonly link?: string
	/** Text after this word (default " " if undefined). Empty string for hyphenated words. */
	readonly suffix?: string
}

/** Optional group context for section compilation */
export interface GroupContext {
	readonly groupId: string
	readonly groupTitle: string
	readonly isFirstInGroup: boolean
	readonly groupDraft?: boolean
}

/** Static code as a one-snapshot animation: one auto-ID line per source line */
const staticAnimation = (code: string): CompiledAnimation => ({
	animation: stack(...code.split("\n")),
	snapshots: [{ slots: {}, annotations: [] }],
	steps: [{ name: "start", at: "start" }],
})

/**
 * Compile a section definition to output format.
 */
export function compileSection(
	def: SectionDef,
	groupContext?: GroupContext,
): CompiledSection & {
	parsedWords: ParsedWordTiming[]
	warnings?: FlowWarning[]
} {
	const { text, words } = parseTranscript(def.transcript)
	const code = def.code ? extractCode(def.code) : ""

	// Generate placeholder wordTimings from parsed words (no real timing data)
	const parsedWords: ParsedWordTiming[] = words.map((w, i) => {
		// Normalize word for glossary/link lookup (lowercase, strip punctuation)
		const normalized = normalizeWord(w.word)
		const definition = def.glossary?.[normalized]
		const link = def.links?.[normalized]

		return {
			word: w.word,
			start: i, // placeholder
			end: i + 1, // placeholder
			...(w.style && { style: w.style }),
			...(w.paragraphBreak && { paragraphBreak: true }),
			...(w.listItem && { listItem: true }),
			...(definition && { definition }),
			...(link && { link }),
			...(w.suffix !== undefined && { suffix: w.suffix }),
		}
	})

	// Static code becomes a one-step animation so every section renders through the same player
	let animationData: CompiledAnimation | undefined = code ? staticAnimation(code) : undefined
	let componentFlowData: CompiledComponentFlow | undefined
	let warnings: FlowWarning[] | undefined
	const transcriptWords = words.map((w) => w.word)

	// Handle flow-based animated code
	if (def.code && isAnimatedCodeFlow(def.code)) {
		const {
			steps,
			snapshots,
			warnings: flowWarnings,
		} = compileFlow(
			def.code.base,
			[...def.code.flow], // Convert readonly to mutable
			def.code.animation,
		)
		animationData = {
			animation: def.code.animation,
			snapshots,
			steps,
		}

		// Validate step words exist in transcript
		const wordWarnings = validateFlowWords([...def.code.flow], transcriptWords)

		// Validate each step's annotation patterns against the code that step renders.
		// snapshots[0] is the base state; snapshots[i + 1] is produced by flow[i].
		const anim = def.code.animation
		const stepCode = snapshots.slice(1).map((snap) => toPlainText(render(anim, snap.slots)))
		const lineIds = extractLineIds(anim)
		const patternWarnings = validateFlowPatterns([...def.code.flow], stepCode, lineIds)

		warnings = [...flowWarnings, ...wordWarnings, ...patternWarnings]
		if (warnings.length > 0) {
			logFlowWarnings(def.id, warnings)
		}
	}

	// Handle step-driven component flow
	if (isComponentFlow(def.component)) {
		componentFlowData = compileComponentFlow({
			name: def.component.name,
			base: def.component.base,
			flow: [...def.component.flow],
		})

		// Validate step words exist in transcript
		const componentWarnings = validateFlowWords([...def.component.flow], transcriptWords)
		if (componentWarnings.length > 0) {
			warnings = [...(warnings ?? []), ...componentWarnings]
			logFlowWarnings(def.id, componentWarnings, "Component flow")
		}
	}

	const compiled = {
		id: def.id,
		text,
		code,
		contentHash: hash(def.transcript + code),
		parsedWords,
		// Step-driven component flow
		...(componentFlowData && { componentFlow: componentFlowData }),
		...(animationData && { animation: animationData }),
		...(warnings && warnings.length > 0 && { warnings }),
		...(groupContext && {
			groupId: groupContext.groupId,
			groupTitle: groupContext.groupTitle,
			isFirstInGroup: groupContext.isFirstInGroup,
			...(groupContext.groupDraft && { groupDraft: true }),
		}),
	}

	return compiled
}

/**
 * Compile a chapter definition to manifest.
 * @param def - Chapter definition
 * @param jsonHashMap - Map of sectionId → hashed JSON filename (e.g., "welcome.a1b2c3d4.json")
 */
export interface CompilationOptions {
	/** Include draft groups in emitted authoring artifacts. Production output must leave this false. */
	readonly includeDrafts?: boolean
}

const authoredIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function validateChapterDefinition(def: ChapterDef): void {
	if (!authoredIdPattern.test(def.id)) {
		throw new Error(`Invalid chapter ID: ${def.id}`)
	}

	const groupIds = new Set<string>()
	const sectionIds = new Set<string>()
	for (const item of def.items) {
		if (isGroup(item)) {
			if (!authoredIdPattern.test(item.id)) throw new Error(`Invalid group ID: ${item.id}`)
			if (groupIds.has(item.id)) throw new Error(`Duplicate group ID: ${item.id}`)
			groupIds.add(item.id)
			for (const section of item.sections) {
				if (!authoredIdPattern.test(section.id)) throw new Error(`Invalid section ID: ${section.id}`)
				if (sectionIds.has(section.id)) throw new Error(`Duplicate section ID: ${section.id}`)
				sectionIds.add(section.id)
			}
		} else {
			if (!authoredIdPattern.test(item.id)) throw new Error(`Invalid section ID: ${item.id}`)
			if (sectionIds.has(item.id)) throw new Error(`Duplicate section ID: ${item.id}`)
			sectionIds.add(item.id)
		}
	}
}

export function compileChapter(
	def: ChapterDef,
	jsonHashMap?: Map<string, string>,
	options?: CompilationOptions,
): ChapterManifest {
	validateChapterDefinition(def)
	const includeDrafts = options?.includeDrafts === true
	const draftGroupIds = includeDrafts
		? def.items.filter((item): item is GroupDef => isGroup(item) && !!item.draft).map((g) => g.id)
		: []

	// Build groups array with section IDs
	const groups: ManifestGroupEntry[] = def.items
		.filter((item): item is GroupDef => isGroup(item) && !item.draft)
		.map((g) => ({
			id: g.id,
			title: g.title,
			sectionIds: g.sections.map((s) => s.id),
		}))

	const sections = def.items.flatMap((item) => {
		if (isGroup(item)) {
			if (item.draft && !includeDrafts) return []
			return item.sections
		}
		return [item]
	})

	return {
		id: def.id,
		title: def.title,
		...(def.description && { description: def.description }),
		sections: sections.map((s) => ({
			id: s.id,
			file: jsonHashMap?.get(s.id) ?? `${s.id}.json`,
		})),
		...(groups.length > 0 && { groups }),
		...(def.draft && { draft: true }),
		...(draftGroupIds.length > 0 && { draftGroups: draftGroupIds }),
	}
}

/**
 * Compile all sections in a chapter with group context.
 * Returns sections in order with group metadata attached.
 */
export function compileSectionsWithGroups(
	def: ChapterDef,
	options?: CompilationOptions,
): Array<
	CompiledSection & {
		parsedWords: ParsedWordTiming[]
		warnings?: FlowWarning[]
	}
> {
	validateChapterDefinition(def)
	const result: Array<
		CompiledSection & {
			parsedWords: ParsedWordTiming[]
			warnings?: FlowWarning[]
		}
	> = []

	for (const item of def.items) {
		if (isGroup(item)) {
			if (item.draft && options?.includeDrafts !== true) continue
			// Compile each section in the group with group context
			item.sections.forEach((section, index) => {
				result.push(
					compileSection(section, {
						groupId: item.id,
						groupTitle: item.title,
						isFirstInGroup: index === 0,
						...(item.draft && { groupDraft: item.draft }),
					}),
				)
			})
		} else {
			// Ungrouped section
			result.push(compileSection(item))
		}
	}

	return result
}
