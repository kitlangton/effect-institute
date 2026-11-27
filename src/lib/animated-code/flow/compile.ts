/**
 * Flow compilation - converts step builders to snapshots.
 *
 * @module
 */

import { Match } from "effect"
import { type Animation, resolveSlotValue, type Snapshot } from "@/lib/animated-code/animation"
import {
	type AnimationSoundName,
	type Annotation,
	Bright,
	Burst,
	Cursor as CursorAnnotation,
	Focus,
	Glow,
	Mark,
	Say,
	Sound,
	Spotlight,
	Squiggle,
	Status,
} from "@/lib/animated-code/annotations"
import { Persistent, PersistentArray } from "./persistence"
import type {
	BrightSpec,
	BurstSpec,
	CursorSpec,
	FocusSpec,
	MarkSpec,
	SpotlightSpec,
	SquiggleSpec,
	StatusSpec,
	StepBuilder,
	StepRef,
	TokenFocusSpec,
} from "./types"
import type { FlowWarning } from "./validate"

// ============================================================================
// Animation Tree Helpers
// ============================================================================

/**
 * Extract line IDs from an Animation tree.
 */
export function extractLineIds(animation: Animation): string[] {
	const ids: string[] = []
	collectLineIds(animation, ids)
	return ids
}

function collectLineIds(node: Animation, ids: string[]): void {
	switch (node._tag) {
		case "Line":
			if (node.id) ids.push(node.id)
			collectLineIds(node.content, ids)
			break
		case "Stack":
		case "Concat":
			for (const part of node.parts) {
				collectLineIds(part, ids)
			}
			break
		case "Slot":
			for (const value of Object.values(node.values)) {
				collectLineIds(value, ids)
			}
			break
		case "Section":
			collectLineIds(node.content, ids)
			break
		case "Text":
		case "Empty":
			break
	}
}

/**
 * Extract slot defaults from an Animation tree.
 * Uses the first key in each slot's values as the default.
 */
export function extractSlotDefaults(animation: Animation): Record<string, string> {
	const defaults: Record<string, string> = {}
	collectSlotDefaults(animation, defaults)
	return defaults
}

function collectSlotDefaults(node: Animation, defaults: Record<string, string>): void {
	switch (node._tag) {
		case "Slot": {
			const defaultValue = resolveSlotValue(node)
			if (defaultValue) defaults[node.name] = defaultValue
			for (const value of Object.values(node.values)) {
				collectSlotDefaults(value, defaults)
			}
			break
		}
		case "Line":
		case "Section":
			collectSlotDefaults(node.content, defaults)
			break
		case "Stack":
		case "Concat":
			for (const part of node.parts) {
				collectSlotDefaults(part, defaults)
			}
			break
		case "Text":
		case "Empty":
			break
	}
}

/**
 * Resolve a FocusSpec to actual line IDs.
 */
export function resolveFocus(focus: FocusSpec, allLineIds: string[]): string[] | undefined {
	return Match.valueTags(focus, {
		FocusLines: ({ ids }) => [...ids],
		FocusRange: ({ from, to }) => {
			const fromIdx = allLineIds.indexOf(from)
			const toIdx = allLineIds.indexOf(to)
			if (fromIdx === -1 || toIdx === -1) {
				// Invalid line IDs - validation happens in validateFlowPatterns()
				return undefined
			}
			const start = Math.min(fromIdx, toIdx)
			const end = Math.max(fromIdx, toIdx)
			return allLineIds.slice(start, end + 1)
		},
		FocusExcept: ({ ids }) => {
			const exceptSet = new Set(ids)
			return allLineIds.filter((id) => !exceptSet.has(id))
		},
		FocusAll: () => undefined,
	})
}

// ============================================================================
// Flow Compilation
// ============================================================================

/**
 * Compile a flow definition to steps and snapshots.
 */
export function compileFlow(
	base: Record<string, string> | undefined,
	flow: StepBuilder[],
	animation: Animation,
): { steps: StepRef[]; snapshots: Snapshot[]; warnings: FlowWarning[] } {
	const lineIds = extractLineIds(animation)
	const slotDefaults = extractSlotDefaults(animation)
	const validSlotNames = new Set(Object.keys(slotDefaults))
	const steps: StepRef[] = []
	const snapshots: Snapshot[] = []
	const warnings: FlowWarning[] = []

	const effectiveBase = { ...slotDefaults, ...base }
	let currentSlots = { ...effectiveBase }

	// Persistent annotation trackers
	// Unified focus has separate persistence for lines and tokens
	const focusLines = new Persistent<FocusSpec>((f) => "persist" in f && !!f.persist)
	const focusTokens = new PersistentArray<TokenFocusSpec>()
	const spotlight = new PersistentArray<SpotlightSpec>() // Legacy, kept for backward compat
	const cursor = new Persistent<CursorSpec>()
	const burst = new Persistent<BurstSpec>()
	const bright = new PersistentArray<BrightSpec>()
	const squiggle = new PersistentArray<SquiggleSpec>()
	const mark = new PersistentArray<MarkSpec>()
	// Key status by text+nth so updating the same target replaces rather than accumulates
	const status = new PersistentArray<StatusSpec>((s) => `${s.text}:${s.nth ?? 1}`)

	// Initial snapshot
	steps.push({ name: "start", at: "start" })
	snapshots.push({ slots: { ...effectiveBase }, annotations: [] })

	for (const builder of flow) {
		const step = builder._build()
		const stepName = step.name ?? step.word
		const ann = step.annotations

		steps.push({
			name: stepName,
			at: step.word,
			...(step.after && { after: step.after }),
			...(step.nth && { nth: step.nth }),
			...(step.offset && { offset: step.offset }),
		})

		// Validate slot names
		for (const slotName of Object.keys(step.slotsDelta)) {
			if (!validSlotNames.has(slotName)) {
				warnings.push({
					type: "slot-not-found",
					slotName,
					stepName,
					availableSlots: [...validSlotNames],
				})
			}
		}

		currentSlots = { ...currentSlots, ...step.slotsDelta }

		// Process annotations with persistence
		// Unified focus - separate trackers for lines and tokens
		const effectiveFocusLines = focusLines.update(ann.focus?.lines, ann.focusClear)
		const effectiveFocusTokens = focusTokens.update(ann.focus?.tokens, ann.focusClear)
		// Legacy spotlight support (deprecated, but still works)
		const effectiveLegacySpotlight = spotlight.update(ann.spotlight, ann.spotlightClear)
		const effectiveCursor = cursor.update(ann.cursor, ann.cursorClear)
		const effectiveBurst = burst.update(ann.burst, ann.burstClear)
		const effectiveBright = bright.update(ann.bright, ann.brightClear)
		const effectiveSquiggle = squiggle.update(ann.squiggle, ann.squiggleClear)
		const effectiveMark = mark.update(ann.mark, ann.markClear)
		const effectiveStatus = status.update(ann.status, ann.statusClear)

		const resolvedFocus = effectiveFocusLines ? resolveFocus(effectiveFocusLines, lineIds) : undefined

		// Build annotations array
		const annotations: Annotation[] = []

		if (resolvedFocus && resolvedFocus.length > 0) {
			annotations.push(new Focus({ lines: resolvedFocus }))
		}

		// Merge unified token focus and legacy spotlight into one annotation
		const allTokenSpecs: TokenFocusSpec[] = [
			...(effectiveFocusTokens ?? []),
			// Convert legacy SpotlightSpec to TokenFocusSpec
			...(effectiveLegacySpotlight ?? []).map((s): TokenFocusSpec => {
				const spec: TokenFocusSpec = {
					text: typeof s.pattern === "string" ? s.pattern : (s.pattern.text ?? ""),
				}
				if (typeof s.pattern === "object" && s.pattern.line) {
					spec.line = s.pattern.line
				}
				if (s.dim !== undefined) spec.dim = s.dim
				if (s.glow !== undefined) spec.glow = s.glow
				if (s.persist !== undefined) spec.persist = s.persist
				return spec
			}),
		]

		if (allTokenSpecs.length > 0) {
			const patterns = allTokenSpecs.map((t): string | { line: string; text?: string } =>
				t.line ? { line: t.line, text: t.text } : t.text,
			)
			const first = allTokenSpecs[0]
			annotations.push(
				new Spotlight({
					patterns,
					dim: first.dim ?? 0.4,
					glow: first.glow ?? false,
				}),
			)
		}

		if (effectiveCursor) {
			annotations.push(
				new CursorAnnotation({
					text: effectiveCursor.text,
					nth: effectiveCursor.nth ?? 1,
					type: effectiveCursor.type ?? "hand",
					after: effectiveCursor.after,
					substring: effectiveCursor.substring ?? false,
				}),
			)
		}

		if (ann.glow && ann.glow.length > 0) {
			for (const g of ann.glow) {
				annotations.push(
					new Glow({
						text: g.text,
						nth: g.nth ?? 1,
						color: g.color,
						after: g.after,
						substring: g.substring ?? false,
					}),
				)
			}
		}

		if (effectiveSquiggle && effectiveSquiggle.length > 0) {
			for (const s of effectiveSquiggle) {
				annotations.push(
					new Squiggle({
						text: s.text,
						nth: s.nth ?? 1,
						color: s.color,
						after: s.after,
						substring: s.substring ?? false,
					}),
				)
			}
		}

		if (effectiveMark && effectiveMark.length > 0) {
			for (const m of effectiveMark) {
				annotations.push(
					new Mark({
						text: m.text,
						nth: m.nth ?? 1,
						color: m.color,
						after: m.after,
						substring: m.substring ?? false,
					}),
				)
			}
		}

		if (ann.say) {
			annotations.push(new Say({ text: ann.say }))
		}

		if (effectiveBurst) {
			annotations.push(
				new Burst({
					text: effectiveBurst.text,
					emoji: effectiveBurst.emoji,
					count: effectiveBurst.count ?? 5,
					nth: effectiveBurst.nth ?? 1,
					after: effectiveBurst.after,
					substring: effectiveBurst.substring ?? false,
				}),
			)
		}

		if (effectiveBright && effectiveBright.length > 0) {
			for (const b of effectiveBright) {
				annotations.push(
					new Bright({
						text: b.text,
						nth: b.nth ?? 1,
						color: b.color,
						after: b.after,
						substring: b.substring ?? false,
					}),
				)
			}
		}

		if (effectiveStatus && effectiveStatus.length > 0) {
			for (const s of effectiveStatus) {
				annotations.push(
					new Status({
						text: s.text,
						status: s.status,
						nth: s.nth ?? 1,
						after: s.after,
						substring: s.substring ?? false,
					}),
				)
			}
		}

		if (ann.sound) {
			annotations.push(new Sound({ name: ann.sound }))
		}

		snapshots.push({ slots: { ...currentSlots }, annotations })
	}

	return { steps, snapshots, warnings }
}

// ============================================================================
// Component Flow Compilation
// ============================================================================

/** One component step: the component's state, and the sound the step plays */
export interface ComponentSnapshot {
	readonly state: Record<string, unknown>
	readonly sound?: AnimationSoundName
}

/** Compiled component flow */
export interface CompiledComponentFlow {
	readonly name: string
	readonly steps: StepRef[]
	readonly snapshots: ComponentSnapshot[]
}

/**
 * Compile a component flow definition to steps and state snapshots.
 */
export function compileComponentFlow(componentFlow: {
	name: string
	base: Record<string, unknown> | undefined
	flow: readonly {
		_build(): {
			word: string
			name?: string
			after?: string
			nth?: number
			offset?: number
			stateDelta?: Record<string, unknown>
			annotations?: { sound?: AnimationSoundName }
		}
	}[]
}): CompiledComponentFlow {
	const steps: StepRef[] = []
	const snapshots: ComponentSnapshot[] = []
	let currentState: Record<string, unknown> = { ...componentFlow.base }

	steps.push({ name: "start", at: "start" })
	snapshots.push({ state: { ...currentState } })

	for (const builder of componentFlow.flow) {
		const step = builder._build()
		const stepName = step.name ?? step.word

		steps.push({
			name: stepName,
			at: step.word,
			...(step.after && { after: step.after }),
			...(step.nth && { nth: step.nth }),
			...(step.offset && { offset: step.offset }),
		})

		if (step.stateDelta) {
			currentState = { ...currentState, ...step.stateDelta }
		}

		const sound = step.annotations?.sound
		snapshots.push({ state: { ...currentState }, ...(sound && { sound }) })
	}

	return { name: componentFlow.name, steps, snapshots }
}
