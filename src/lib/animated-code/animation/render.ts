import { Schema } from "effect"
import { type Animation, resolveSlotValue, type SlotValues } from "./animation"

// ============================================================================
// Source Tracking (for stability analysis)
// ============================================================================

/** Static text source - content outside any slot, always stable */
export class StaticSource extends Schema.TaggedClass<StaticSource>()("StaticSource", {}) {}

/** Slot source - content from a slot, stable only if slot value unchanged */
export class SlotSource extends Schema.TaggedClass<SlotSource>()("SlotSource", {
	name: Schema.String,
	value: Schema.String,
}) {}

/** Union of all source types */
export type PartSource = StaticSource | SlotSource

/** Schema for PartSource union */
export const PartSourceSchema = Schema.Union([StaticSource, SlotSource])

// ============================================================================
// Rendered Output Types
// ============================================================================

/** A part within a rendered line */
export class RenderedPart extends Schema.Class<RenderedPart>("RenderedPart")({
	content: Schema.String,
	/** For inline components - the variant determines styling */
	inline: Schema.optional(Schema.String),
	/** Where this part came from (static text or a slot) */
	source: Schema.optional(PartSourceSchema),
}) {}

/** A rendered line with ID and parts */
export class RenderedLine extends Schema.Class<RenderedLine>("RenderedLine")({
	id: Schema.NullOr(Schema.String),
	parts: Schema.Array(RenderedPart),
}) {}

/** Complete rendered output */
export class RenderedOutput extends Schema.Class<RenderedOutput>("RenderedOutput")({
	lines: Schema.Array(RenderedLine),
}) {}

// ============================================================================
// Render Context
// ============================================================================

interface RenderContext {
	/** Current section namespace stack */
	readonly sectionPath: readonly string[]
	/** Slot value assignments */
	readonly env: SlotValues
	/** Whether we're inside a Concat (affects Empty behavior) */
	readonly insideConcat: boolean
	/** Current slot we're rendering inside (for source tracking) */
	readonly currentSlot?: { name: string; value: string }
}

// ============================================================================
// Core Render Function
// ============================================================================

/**
 * Render an Animation with the given slot values.
 * Returns lines with IDs and parts.
 */
export function render(animation: Animation, slots: SlotValues): RenderedOutput {
	const ctx: RenderContext = {
		sectionPath: [],
		env: slots,
		insideConcat: false,
	}
	const lines = renderAnimation(animation, ctx)

	return new RenderedOutput({ lines })
}

function renderAnimation(anim: Animation, ctx: RenderContext): RenderedLine[] {
	switch (anim._tag) {
		case "Empty":
			return []

		case "Text": {
			// Text produces a single line with no ID (will inherit from parent Line)
			// Source depends on whether we're inside a slot
			const source: PartSource = ctx.currentSlot
				? new SlotSource({ name: ctx.currentSlot.name, value: ctx.currentSlot.value })
				: new StaticSource({})
			return [new RenderedLine({ id: null, parts: [new RenderedPart({ content: anim.content, source })] })]
		}

		case "Slot": {
			// Resolve slot value from environment
			const valueName = resolveSlotValue(anim, ctx.env[anim.name])
			if (valueName === undefined) return []

			// Special case: "hidden" is a reserved state that always means empty
			// Even if not explicitly defined in the slot's values
			if (valueName === "hidden" && !(valueName in anim.values)) {
				// Behave like empty - but apply concat placeholder logic for stability
				if (ctx.insideConcat) {
					const source = new SlotSource({ name: anim.name, value: "hidden" })
					return [new RenderedLine({ id: null, parts: [new RenderedPart({ content: "", source })] })]
				}
				return []
			}

			const value = anim.values[valueName]
			if (!value) return []

			// Render with slot context for source tracking
			const slotCtx: RenderContext = {
				...ctx,
				currentSlot: { name: anim.name, value: valueName },
			}
			const rendered = renderAnimation(value, slotCtx)

			// Check if we got any content
			const hasContent = rendered.some((line) => line.parts.length > 0 && line.parts.some((p) => p.content.length > 0))

			// If inside concat and no content, create placeholder for stable part structure
			if (!hasContent && ctx.insideConcat) {
				const source = new SlotSource({ name: anim.name, value: valueName })
				return [new RenderedLine({ id: null, parts: [new RenderedPart({ content: "", source })] })]
			}

			// If no content and NOT in concat (stack context), return empty
			if (!hasContent) {
				return []
			}

			return rendered
		}

		case "Concat": {
			// Horizontal composition - merge into single line
			const allParts: RenderedPart[] = []
			const concatCtx: RenderContext = { ...ctx, insideConcat: true }

			for (const part of anim.parts) {
				const rendered = renderAnimation(part, concatCtx)
				// Concat expects each part to produce at most one line
				// Multiple lines in concat is an error, but we handle gracefully
				for (const line of rendered) {
					allParts.push(...line.parts)
				}
			}

			return [new RenderedLine({ id: null, parts: allParts })]
		}

		case "Stack": {
			// Vertical composition - concatenate lines
			const allLines: RenderedLine[] = []

			for (const part of anim.parts) {
				const rendered = renderAnimation(part, ctx)
				allLines.push(...rendered)
			}

			return allLines
		}

		case "Line": {
			// Assign ID to contained content
			const rendered = renderAnimation(anim.content, ctx)

			// Build full ID with section namespace
			const fullId = ctx.sectionPath.length > 0 ? `${ctx.sectionPath.join("/")}/${anim.id}` : anim.id

			// If content produces multiple lines, only first gets the ID
			// (this shouldn't happen with well-formed animations)
			if (rendered.length === 0) {
				return [new RenderedLine({ id: fullId, parts: [] })]
			}

			return [new RenderedLine({ id: fullId, parts: [...rendered[0].parts] }), ...rendered.slice(1)]
		}

		case "Section": {
			// Push section onto namespace stack
			const newCtx: RenderContext = {
				...ctx,
				sectionPath: [...ctx.sectionPath, anim.name],
			}

			return renderAnimation(anim.content, newCtx)
		}

		case "Inline": {
			// Inline component - mark with variant for special styling
			const source: PartSource = ctx.currentSlot
				? new SlotSource({ name: ctx.currentSlot.name, value: ctx.currentSlot.value })
				: new StaticSource({})
			return [
				new RenderedLine({
					id: null,
					parts: [new RenderedPart({ content: anim.content, inline: anim.variant, source })],
				}),
			]
		}
	}
}

// ============================================================================
// Utility: Convert to plain text
// ============================================================================

/** Convert rendered output to plain text string */
export function toPlainText(output: RenderedOutput): string {
	return output.lines.map((line) => line.parts.map((p) => p.content).join("")).join("\n")
}

/** Get all line IDs from rendered output */
export function getLineIds(output: RenderedOutput): string[] {
	return output.lines.map((line) => line.id).filter((id): id is string => id !== null)
}
