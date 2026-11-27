/**
 * # Animation DSL
 *
 * Algebraic data type for composable code animations. Define animations declaratively,
 * then render to different states via snapshots.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { compile, empty, line, slot, stack, type AnimationDef } from "@/lib/animated-code/animation"
 *
 * const animation = stack(
 *   line("sig", "function greet(name: string) {"),
 *   slot("body", {
 *     simple: line("return", '  return "Hello"'),
 *     withName: line("return", '  return `Hello ${name}`'),
 *   }),
 *   line("close", "}"),
 * )
 *
 * const def: AnimationDef = {
 *   animation,
 *   snapshots: [
 *     { slots: { body: "simple" }, annotations: [] },
 *     { slots: { body: "withName" }, annotations: [] },
 *   ],
 * }
 *
 * const slideshowData = compile(def)
 * ```
 *
 * ## Core Concepts
 *
 * ### Primitives
 *
 * - `text(s)` - Literal text (leaf node)
 * - `line(id, s)` - Line with ID and text content
 * - `stack(...parts)` - Vertical composition (different lines)
 * - `concat(...parts)` - Horizontal composition (same line)
 * - `slot(name, values)` - Choice point, values are Animations
 * - `section(name, content)` - Namespace for line IDs
 * - `empty` - Identity element (renders nothing)
 *
 * ### Line Identity
 *
 * Lines need stable IDs for smooth animations. Use `line(id, content)`:
 *
 * ```typescript
 * stack(
 *   line("line1", "const x = 1"),  // ID: "line1"
 *   line("line2", "const y = 2"),  // ID: "line2"
 * )
 * ```
 *
 * When lines appear/disappear, IDs track which line is which.
 *
 * ### Slots (Choice Points)
 *
 * Slots define where content can change between snapshots:
 *
 * ```typescript
 * slot("visibility", {
 *   hidden: empty,                       // Show nothing
 *   collapsed: line("dots", "// ..."),   // Show collapsed
 *   expanded: stack(                     // Show full content
 *     line("a", "line a"),
 *     line("b", "line b"),
 *   ),
 * })
 * ```
 *
 * Snapshot selects which value: `{ visibility: "expanded" }`
 *
 * ### Sections (Namespacing)
 *
 * Sections prefix line IDs to prevent collisions:
 *
 * ```typescript
 * stack(
 *   section("foo", line("sig", "function foo() {}")),  // ID: "foo/sig"
 *   section("bar", line("sig", "function bar() {}")),  // ID: "bar/sig"
 * )
 * ```
 *
 * ### Horizontal Composition
 *
 * `concat` joins parts on the same line:
 *
 * ```typescript
 * line("call", concat(
 *   text("const result = "),
 *   slot("fn", { a: text("foo"), b: text("bar") }),
 *   text("()"),
 * ))
 * // Renders: "const result = foo()" or "const result = bar()"
 * ```
 *
 * ## Snapshots
 *
 * Snapshots define the state at each step:
 *
 * ```typescript
 * import { Cursor, Focus, Mark, Spotlight } from "@/lib/animated-code/annotations"
 *
 * const snapshots = [
 *   { slots: { slotName: "value1" }, annotations: [] },
 *   { slots: { slotName: "value2" }, annotations: [new Focus({ lines: ["await"] })] },
 *   { slots: { slotName: "value2" }, annotations: [new Spotlight({ patterns: ["Promise<Order>"] })] },
 * ]
 * ```
 *
 * ### Available Annotations (from @/lib/animated-code/annotations)
 *
 * - `Focus` - Dim all lines except those containing patterns
 * - `Spotlight` - Dim all text except matching patterns
 * - `Mark`, `Glow`, `Squiggle`, `Bright` - Text highlight effects
 * - `Cursor` - Show pointer at text
 * - `Burst` - Emoji particles
 * - `Status` - Running/success/error indicators
 * - `Background`, `Sound` - Line backgrounds and sound effects
 *
 * ## Full Example
 *
 * ```typescript
 * const animation = stack(
 *   section("checkout", stack(
 *     line("sig", "async function checkout(cartId: string) {"),
 *     slot("body", {
 *       expanded: stack(
 *         line("get", "  const cart = await getCart(cartId);"),
 *         line("pay", "  const payment = await charge(cart);"),
 *         line("ship", "  return await ship(payment);"),
 *       ),
 *       collapsed: line("dots", "  // ..."),
 *     }),
 *     line("close", "}"),
 *   )),
 *
 *   slot("gap", { none: empty, show: line("blank", "") }),
 *
 *   section("getCart", slot("getCartVisible", {
 *     hidden: empty,
 *     shown: stack(
 *       line("sig", "async function getCart(id: string) {"),
 *       line("body", "  return fetch(`/cart/${id}`);"),
 *       line("close", "}"),
 *     ),
 *   })),
 * )
 *
 * const def: AnimationDef = {
 *   animation,
 *   snapshots: [
 *     // Just checkout expanded
 *     { slots: { body: "expanded", gap: "none", getCartVisible: "hidden" }, annotations: [] },
 *     // Spotlight getCart call
 *     {
 *       slots: { body: "expanded", gap: "none", getCartVisible: "hidden" },
 *       annotations: [new Spotlight({ patterns: ["getCart"] })],
 *     },
 *     // Drill into getCart
 *     { slots: { body: "collapsed", gap: "show", getCartVisible: "shown" }, annotations: [] },
 *   ],
 * }
 * ```
 *
 * @module
 */

// ============================================================================
// Animation Type (TaggedClass variants)
// ============================================================================

import { Schema } from "effect"
import type { Annotation } from "@/lib/animated-code/annotations"

/**
 * Animation is an algebraic data type for composable code animations.
 *
 * Variants:
 * - `Text` - Literal text content
 * - `Slot` - Choice point with named Animation values
 * - `Concat` - Horizontal composition (same line)
 * - `Stack` - Vertical composition (different lines)
 * - `Line` - Assigns stable ID for animation tracking
 * - `Section` - Namespaces line IDs to prevent collisions
 * - `Empty` - Identity element, renders nothing
 */

/** Lazy schema reference for recursive Animation */
const AnimationLazy: Schema.Schema<Animation> = Schema.suspend(() => AnimationSchema)

/** Literal text content */
export class Text extends Schema.TaggedClass<Text>()("Text", {
	content: Schema.String,
}) {}

/** Choice point with named Animation values */
export class Slot extends Schema.TaggedClass<Slot>()("Slot", {
	name: Schema.String,
	values: Schema.Record(Schema.String, AnimationLazy),
	/** If true, defaults to "hidden" state (which is reserved to mean `empty`) */
	defaultHidden: Schema.optional(Schema.Boolean),
}) {}

/** Horizontal composition (same line) */
export class Concat extends Schema.TaggedClass<Concat>()("Concat", {
	parts: Schema.Array(AnimationLazy),
}) {}

/** Vertical composition (different lines) */
export class Stack extends Schema.TaggedClass<Stack>()("Stack", {
	parts: Schema.Array(AnimationLazy),
}) {}

/** Assigns stable ID for animation tracking */
export class Line extends Schema.TaggedClass<Line>()("Line", {
	id: Schema.String,
	content: AnimationLazy,
}) {}

/** Namespaces line IDs to prevent collisions */
export class Section extends Schema.TaggedClass<Section>()("Section", {
	name: Schema.String,
	content: AnimationLazy,
}) {}

/** Identity element, renders nothing */
export class Empty extends Schema.TaggedClass<Empty>()("Empty", {}) {}

/** Inline component - renders with special styling based on variant */
export class Inline extends Schema.TaggedClass<Inline>()("Inline", {
	content: Schema.String,
	/** Variant: "output" (console), "result", "error", "warning", etc. */
	variant: Schema.String,
}) {}

/** Animation type - discriminated union of all variants */
export type Animation = Text | Slot | Concat | Stack | Line | Section | Empty | Inline

/** Schema for validating/serializing Animation trees */
export const AnimationSchema: Schema.Schema<Animation> = Schema.Union([
	Text,
	Slot,
	Concat,
	Stack,
	Line,
	Section,
	Empty,
	Inline,
])

// ============================================================================
// AnimationInput Type (for flexible input coercion)
// ============================================================================

/**
 * Flexible input type that auto-coerces to Animation.
 * - `string` → `text(string)`
 * - `Animation` → as-is
 * - `AnimationInput[]` → `concat(...coerced)`
 *
 * Use this type in function signatures to allow flexible inputs.
 */
export type AnimationInput = Animation | string | readonly AnimationInput[]

// ============================================================================
// Smart Constructors
// ============================================================================

/**
 * Create literal text content.
 *
 * @example
 * ```typescript
 * text("const x = 1")
 * ```
 */
export const text = (content: string): Animation => new Text({ content })

/**
 * Coerce flexible input to Animation.
 * - string → text(string)
 * - Animation → as-is
 * - array → concat(...coerced items)
 */
const coerce = (input: AnimationInput): Animation => {
	if (typeof input === "string") return text(input)
	if (Array.isArray(input)) {
		const coerced = input.map(coerce)
		// Flatten single-element arrays
		return coerced.length === 1 ? coerced[0] : new Concat({ parts: coerced })
	}
	// After string and array checks, input must be Animation
	return input as Animation
}

// ============================================================================
// Auto-line Helpers (used by stack and slot for string → Line conversion)
// ============================================================================

const isString = (value: unknown): value is string => typeof value === "string"

/** Generate a URL-safe slug from text content */
const slugify = (s: string): string =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 24) || "line"

/** Create a Line with deterministic ID from content + index */
const autoLine = (content: string, index: number): Animation =>
	new Line({
		id: `auto-${slugify(content)}-${index}`,
		content: text(content),
	})

/**
 * Create a choice point where values are Animations.
 * Snapshot selects which value to render via `{ slotName: "valueName" }`.
 *
 * @example
 * ```typescript
 * slot("body", {
 *   expanded: stack(line("a", "line a"), line("b", "line b")),
 *   collapsed: line("dots", "// ..."),
 *   hidden: empty,
 * })
 *
 * // Use slot.optional() for the common hide/show pattern:
 * slot.optional("extra", line("line", "extra content"))
 * ```
 */
const slotFn = (name: string, values: Record<string, AnimationInput>): Animation =>
	new Slot({
		name,
		values: Object.fromEntries(
			Object.entries(values).map(([key, value], idx) => [
				key,
				// Strings become autoLine (with IDs), arrays coerce to concat, Animation as-is
				typeof value === "string" ? autoLine(value, idx) : Array.isArray(value) ? coerce(value) : (value as Animation),
			]),
		),
	})

export const slot = Object.assign(slotFn, {
	/**
	 * Create a slot that defaults to hidden. Use `.slots({ name: "shown" })` to reveal.
	 * Uses reserved "hidden" state (rendered as `empty`) without defining it explicitly.
	 *
	 * @example
	 * ```typescript
	 * slot.optional("tag", '"VeryBadRoll"')
	 * // Defaults to "hidden" state (reserved, means empty)
	 * // Then in flow: on("word").slots({ tag: "shown" })
	 * ```
	 */
	optional: (name: string, content: AnimationInput): Animation =>
		new Slot({
			name,
			values: { shown: coerce(content) },
			defaultHidden: true,
		}),
})

/** Resolve a slot selection consistently across authoring previews and compiled output. */
export const resolveSlotValue = (slot: Slot, selectedValue?: string): string | undefined =>
	selectedValue ?? (slot.defaultHidden ? "hidden" : Object.keys(slot.values)[0])

/**
 * Horizontal composition - parts render on the same line.
 * Strings and arrays are allowed and auto-coerced.
 *
 * @example
 * ```typescript
 * concat("return ", slot("val", { a: "1", b: "2" }))
 * // Renders: "return 1" or "return 2"
 *
 * // Arrays flatten into the concat:
 * concat("a", ["b", "c"], "d")  // Same as concat("a", "b", "c", "d")
 * ```
 */
export const concat = (...parts: ReadonlyArray<AnimationInput>): Animation =>
	new Concat({
		parts: parts.flatMap((p) => {
			const coerced = coerce(p)
			// Flatten nested concats
			return coerced._tag === "Concat" ? coerced.parts : [coerced]
		}),
	})

/**
 * Vertical composition - parts render on different lines.
 * Strings are allowed for static lines and get auto-generated IDs.
 *
 * @example
 * ```typescript
 * stack(
 *   "const x = 1",              // auto-ID line
 *   line("line2", "second line"),
 * )
 * ```
 */
export const stack = (...parts: ReadonlyArray<Animation | string>): Animation =>
	new Stack({
		parts: parts.map((p, i) => (isString(p) ? autoLine(p, i) : p)),
	})

/**
 * Assign explicit line ID for animation tracking.
 * Content can be Animation, string, or array (auto-coerced).
 *
 * @example
 * ```typescript
 * line("myLine", concat(text("fn"), slot("name", { a: text("foo") })))
 *
 * // With array shorthand:
 * line("call", ["fn(", slot("arg", { a: "1", b: "2" }), ")"])
 * ```
 */
export const line = (id: string, content: AnimationInput): Animation => new Line({ id, content: coerce(content) })

/**
 * Namespace for line IDs - prevents collision when composing.
 * Line IDs become `sectionName/lineId`.
 *
 * @example
 * ```typescript
 * stack(
 *   section("foo", line("sig", "function foo() {}")),  // ID: "foo/sig"
 *   section("bar", line("sig", "function bar() {}")),  // ID: "bar/sig"
 * )
 * ```
 */
export const section = (name: string, content: AnimationInput): Animation =>
	new Section({ name, content: coerce(content) })

/**
 * Identity element - renders nothing.
 * Useful for conditional visibility in slots.
 *
 * @example
 * ```typescript
 * slot("extra", {
 *   hidden: empty,            // Slot renders nothing
 *   shown: line("x", "..."), // Slot renders a line
 * })
 * ```
 */
export const empty: Animation = new Empty({})

/**
 * Inline component with custom styling.
 * Variant determines the visual treatment.
 *
 * @example
 * ```typescript
 * line("log", ["console.log(data)", inline("{ mSv: 0.3 }", "output")])
 * ```
 */
export const inline = (content: string, variant: string = "output"): Animation => new Inline({ content, variant })

/**
 * Console output box - convenience wrapper for inline with "output" variant.
 *
 * @example
 * ```typescript
 * line("log", ["console.log(data)", output("{ mSv: 0.3 }")])
 * ```
 */
export const output = (content: string): Animation => inline(content, "output")

// ============================================================================
// Static Code Block Helper
// ============================================================================

/**
 * Simple dedent helper - removes common leading whitespace.
 */
function dedent(str: string): string {
	const lines = str.split("\n").filter((l) => l.trim().length > 0)
	if (lines.length === 0) return ""
	const minIndent = Math.min(...lines.map((l) => l.match(/^\s*/)?.[0].length ?? 0))
	return lines.map((l) => l.slice(minIndent)).join("\n")
}

/**
 * Template tag for static code blocks. Dedents and splits into lines.
 *
 * Use for code that doesn't need individual line IDs (no focus/cursor/annotations).
 * Much cleaner than listing each line in stack().
 *
 * @param indent - base indent (spaces) to add to each line
 *
 * @example
 * ```typescript
 * // Static code block with 2-space indent
 * code(2)`
 *   Effect.gen(function* () {
 *     const n = yield* Random.nextIntBetween(1, 7)
 *     return n
 *   })
 * `
 *
 * // No indent
 * code(0)`
 *   function greet() {
 *     return "hello"
 *   }
 * `
 * ```
 */
export const code =
	(indent: number = 0) =>
	(strings: TemplateStringsArray): Animation => {
		const lines = dedent(strings[0])
			.split("\n")
			.filter((l) => l.length > 0)
			.map((l) => " ".repeat(indent) + l)
		return stack(...lines)
	}

// ============================================================================
// Snapshot Type
// ============================================================================

/** Which value each slot shows, by slot name. Slots not listed show their default. */
export type SlotValues = Readonly<Record<string, string>>

/**
 * The animation state at one step: which value each slot shows, and the visual annotations.
 *
 * @example
 * ```typescript
 * import { Focus, Mark } from "@/lib/animated-code/annotations"
 *
 * {
 *   slots: { body: "expanded", visibility: "shown" },
 *   annotations: [new Focus({ lines: ["getCart"] }), new Mark({ text: "Promise", color: "yellow" })],
 * }
 * ```
 */
export interface Snapshot {
	readonly slots: SlotValues
	readonly annotations: readonly Annotation[]
}

// ============================================================================
// Animation Definition
// ============================================================================

/**
 * Complete animation definition with animation tree and snapshots.
 *
 * @example
 * ```typescript
 * const def: AnimationDef = {
 *   animation: stack(
 *     line("a", "line 1"),
 *     slot("extra", { hidden: empty, shown: line("b", "line 2") }),
 *   ),
 *   snapshots: [
 *     { slots: { extra: "hidden" }, annotations: [] },
 *     { slots: { extra: "shown" }, annotations: [] },
 *   ],
 * }
 *
 * // In the app, the build pipeline compiles this to slideshow data:
 * // const slideshowData = compile(def)
 * ```
 */
export interface AnimationDef {
	readonly animation: Animation
	readonly snapshots: readonly Snapshot[]
}
