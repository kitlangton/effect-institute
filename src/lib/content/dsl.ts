/**
 * # Course DSL
 *
 * TypeScript DSL for defining course content. Compiles to JSON for runtime.
 *
 * @example
 * ```typescript
 * import { section, chapter } from "./dsl"
 *
 * const succeed = section("succeed", {
 *   transcript: `
 *     Let's start with the basics. In **Effect**, we describe
 *     computations using the \`Effect\` type.
 *   `,
 *   code: `const program = Effect.succeed(42)`,
 * })
 *
 * export default chapter("intro", "Introduction", [succeed])
 * ```
 *
 * @module
 */

import type { Animation } from "@/lib/animated-code/animation"
import type { StepBuilder } from "@/lib/animated-code/flow"
import { ChapterId, GroupId, SectionId } from "@/lib/tooling/types"

export type { StepBuilder } from "@/lib/animated-code/flow"
// Re-export flow builder for convenience (sections use `on` to define steps)
export { on } from "@/lib/animated-code/flow"

// ============================================================================
// Code Types
// ============================================================================

/** Code can be static string or flow-based animated code */
export type CodeDef = string | AnimatedCodeFlow

// ============================================================================
// Section Definition
// ============================================================================

export interface SectionDef {
	readonly id: SectionId
	/** Markdown transcript with **bold**, *italic*, `code` */
	readonly transcript: string
	/** Static code string or animated code block */
	readonly code?: CodeDef
	/** Step-driven component flow */
	readonly component?: ComponentFlow
	/** Dictionary definitions for words (word → definition) */
	readonly glossary?: Record<string, string>
	/** Hyperlinks for words (word → URL) */
	readonly links?: Record<string, string>
}

// ============================================================================
// Group Definition
// ============================================================================

export interface GroupDef {
	readonly id: GroupId
	readonly title: string
	readonly sections: readonly SectionDef[]
	readonly draft?: boolean
}

// ============================================================================
// Chapter Definition
// ============================================================================

/** A chapter item is either a section (ungrouped) or a group of sections */
export type ChapterItem = SectionDef | GroupDef

/** Type guard for GroupDef */
export function isGroup(item: ChapterItem): item is GroupDef {
	return "sections" in item && Array.isArray(item.sections)
}

export interface ChapterDef {
	readonly id: ChapterId
	readonly title: string
	readonly description?: string
	/** Items can be sections (ungrouped) or groups of sections */
	readonly items: readonly ChapterItem[]
	/** Draft chapters are hidden in production, shown with badge in dev */
	readonly draft?: boolean
	/** Coming soon chapters are always visible but non-clickable with a badge */
	readonly comingSoon?: boolean
	/** Explicit ordering (lower numbers first). Chapters without order are sorted alphabetically after ordered ones. */
	readonly order?: number
}

// ============================================================================
// Smart Constructors
// ============================================================================

/**
 * Define a section.
 *
 * @example
 * ```typescript
 * section("succeed", {
 *   transcript: `In **Effect**, we use \`Effect.succeed\`...`,
 *   code: `const x = Effect.succeed(42)`,
 * })
 * ```
 */
export function section(id: string, config: Omit<SectionDef, "id">): SectionDef {
	return { id: SectionId.make(id), ...config }
}

/**
 * Define a group of related sections with a title.
 *
 * @example
 * ```typescript
 * group("promise-problems", "Problems with Promises", [
 *   promisesOnlyHappyPath,
 *   errorsAreInvisible,
 * ])
 * ```
 */
export function group(
	id: string,
	title: string,
	sections: readonly SectionDef[],
	options?: { draft?: boolean },
): GroupDef {
	return { id: GroupId.make(id), title, sections, ...options }
}

/**
 * Define a chapter containing sections or groups.
 *
 * @example
 * ```typescript
 * chapter("intro", "Introduction to Effect", [
 *   group("problems", "Problems with Promises", [
 *     succeedSection,
 *     failSection,
 *   ]),
 *   group("solution", "The Solution", [
 *     effectSection,
 *   ]),
 * ])
 * ```
 */
export function chapter(
	id: string,
	title: string,
	items: readonly ChapterItem[],
	options?: { description?: string; draft?: boolean; comingSoon?: boolean; order?: number },
): ChapterDef {
	return { id: ChapterId.make(id), title, items, ...options }
}

// ============================================================================
// Flow-Based Animated Code
// ============================================================================

/** Flow-based animated code (new API) */
export interface AnimatedCodeFlow {
	readonly animation: Animation
	/** Initial slot state (optional, defaults to first value for each slot) */
	readonly base?: Record<string, string>
	/** Step definitions with slot changes and annotations */
	readonly flow: readonly StepBuilder[]
}

/** Step-driven component definition */
export interface ComponentFlow {
	/** Component name (must be registered in componentRegistry) */
	readonly name: string
	/** Initial component state */
	readonly base?: Record<string, unknown>
	/** Step definitions with state changes */
	readonly flow: readonly StepBuilder[]
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Extract all sections from a chapter, flattening groups */
export function flattenSections(chapter: ChapterDef): readonly SectionDef[] {
	return chapter.items.flatMap((item) => (isGroup(item) ? item.sections : [item]))
}

/** Extract published (non-draft) sections from a chapter, flattening groups */
export function flattenPublishedSections(chapter: ChapterDef): readonly SectionDef[] {
	return chapter.items.flatMap((item) => {
		if (isGroup(item)) {
			return item.draft ? [] : item.sections
		}
		// Standalone sections are always published
		return [item]
	})
}

// ============================================================================
// Type Guards
// ============================================================================

export function isAnimatedCodeFlow(code: CodeDef): code is AnimatedCodeFlow {
	return typeof code !== "string" && "animation" in code && "flow" in code
}

export function isComponentFlow(component: ComponentFlow | undefined): component is ComponentFlow {
	return typeof component === "object" && component !== null && "name" in component && "flow" in component
}
