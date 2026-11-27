/**
 * Annotation resolution - the one place annotation targets are matched against code.
 *
 * Given the lines a snapshot shows and its annotations, decides what each annotation lands on:
 * character ranges, the cursor and burst points, focused lines and line backgrounds, plus the
 * targets that match nothing. The compiler, the `narrate steps` preview and build validation all
 * read this result.
 *
 * @module
 */

import type {
	AnimationSoundName,
	Annotation,
	Bright,
	Glow,
	Mark,
	SpotlightPattern,
	Squiggle,
} from "@/lib/animated-code/annotations"
import type { CharRange, CursorType, StatusKind } from "@/lib/animated-code/slideshow"
import type { LineBgStyle } from "../animation"
import type { EvaluatedLine } from "./evaluate"
import { collectSimpleRanges, findPatternGlobally, indexLines, resolveFocusedLines } from "./pattern-matching"

/** How an annotation finds its text */
export interface TextTarget {
	readonly text: string
	/** Which match, 1-based (default 1) */
	readonly nth?: number
	/** Only search after this pattern */
	readonly after?: string
	/** Match anywhere instead of at smart word boundaries */
	readonly substring?: boolean
}

/** A character range on one line */
export interface ResolvedRange extends CharRange {
	readonly lineId: string
	readonly color?: string
}

/** A point target (cursor, burst): where the matched text starts and how long it is */
export interface ResolvedPoint {
	readonly lineId: string
	readonly charOffset: number
	readonly textLength: number
}

/** Annotation kinds that land on characters */
export type TargetKind = "cursor" | "burst" | "bright" | "glow" | "squiggle" | "mark" | "status" | "spotlight"

/** An annotation target that matches nothing in the snapshot's code */
export interface AnnotationMiss {
	readonly kind: TargetKind
	readonly target: TextTarget | SpotlightPattern
}

export interface ResolvedSnapshot {
	/** Lines kept bright by line focus; undefined when nothing is focused */
	readonly focusedLineIds: ReadonlySet<string> | undefined
	readonly backgrounds: ReadonlyMap<string, LineBgStyle>
	readonly marks: readonly ResolvedRange[]
	readonly glows: readonly ResolvedRange[]
	readonly squiggles: readonly ResolvedRange[]
	readonly brights: readonly ResolvedRange[]
	/** Token focus: spotlit ranges by line ID (a line-constrained pattern may leave an empty list) */
	readonly spotlight?: {
		readonly ranges: Readonly<Record<string, readonly CharRange[]>>
		readonly dim: number
		readonly glow: boolean
	}
	readonly status: ReadonlyArray<ResolvedRange & { readonly status: StatusKind }>
	readonly cursor?: ResolvedPoint & { readonly type?: CursorType }
	readonly bursts: ReadonlyArray<ResolvedPoint & { readonly emoji: readonly string[]; readonly count: number }>
	readonly say?: string
	readonly sound?: AnimationSoundName
	/** Targets that match nothing, in annotation order */
	readonly missing: readonly AnnotationMiss[]
}

/** The targeting options an annotation set, without the ones left undefined */
const textTarget = (ann: {
	readonly text: string
	readonly nth?: number | undefined
	readonly after?: string | undefined
	readonly substring?: boolean | undefined
}): TextTarget => ({
	text: ann.text,
	...(ann.nth !== undefined && { nth: ann.nth }),
	...(ann.after !== undefined && { after: ann.after }),
	...(ann.substring !== undefined && { substring: ann.substring }),
})

/**
 * Resolve a snapshot's annotations against the lines it shows. Later Focus, Spotlight, Cursor,
 * Say and Sound annotations replace earlier ones; the rest accumulate.
 */
export function resolveAnnotations(
	lines: readonly EvaluatedLine[],
	annotations: readonly Annotation[],
): ResolvedSnapshot {
	const indexed = indexLines(lines)
	const missing: AnnotationMiss[] = []
	const marks: ResolvedRange[] = []
	const glows: ResolvedRange[] = []
	const squiggles: ResolvedRange[] = []
	const brights: ResolvedRange[] = []
	const status: Array<ResolvedRange & { status: StatusKind }> = []
	const bursts: Array<ResolvedPoint & { emoji: readonly string[]; count: number }> = []
	const backgrounds = new Map<string, LineBgStyle>()
	let focusedLineIds: ReadonlySet<string> | undefined
	let spotlight: ResolvedSnapshot["spotlight"]
	let cursor: ResolvedSnapshot["cursor"]
	let say: string | undefined
	let sound: AnimationSoundName | undefined

	const find = (kind: TargetKind, target: TextTarget) => {
		const match = findPatternGlobally(indexed, target.text, {
			nth: target.nth ?? 1,
			after: target.after,
			substring: target.substring,
		})
		if (!match) missing.push({ kind, target })
		return match
	}
	const range = (kind: TargetKind, ann: Mark | Glow | Squiggle | Bright, into: ResolvedRange[]) => {
		const match = find(kind, textTarget(ann))
		if (match)
			into.push({ lineId: match.lineId, start: match.start, end: match.end, ...(ann.color && { color: ann.color }) })
	}

	for (const ann of annotations) {
		switch (ann._tag) {
			case "Focus": {
				const focused = resolveFocusedLines(indexed, [...ann.lines])
				focusedLineIds = focused.length > 0 ? new Set(focused) : undefined
				break
			}
			case "Spotlight": {
				for (const pattern of ann.patterns) {
					const hits = collectSimpleRanges(indexed, [pattern])
					if (!Object.values(hits).some((r) => r.length > 0)) missing.push({ kind: "spotlight", target: pattern })
				}
				spotlight = {
					ranges: collectSimpleRanges(indexed, [...ann.patterns]),
					dim: ann.dim ?? 0.4,
					glow: ann.glow ?? false,
				}
				break
			}
			case "Background":
				backgrounds.set(ann.lineId, ann.style)
				break
			case "Sound":
				sound = ann.name
				break
			case "Say":
				say = ann.text
				break
			case "Mark":
				range("mark", ann, marks)
				break
			case "Glow":
				range("glow", ann, glows)
				break
			case "Squiggle":
				range("squiggle", ann, squiggles)
				break
			case "Bright":
				range("bright", ann, brights)
				break
			case "Status": {
				const match = find("status", textTarget(ann))
				if (match) status.push({ lineId: match.lineId, start: match.start, end: match.end, status: ann.status })
				break
			}
			case "Cursor": {
				const match = find("cursor", textTarget(ann))
				if (match) {
					cursor = {
						lineId: match.lineId,
						charOffset: match.start,
						textLength: ann.text.length,
						...(ann.type !== undefined && { type: ann.type }),
					}
				}
				break
			}
			case "Burst": {
				const match = find("burst", textTarget(ann))
				if (match) {
					bursts.push({
						lineId: match.lineId,
						charOffset: match.start,
						textLength: ann.text.length,
						emoji: typeof ann.emoji === "string" ? [ann.emoji] : ann.emoji,
						count: ann.count ?? 5,
					})
				}
				break
			}
		}
	}

	return {
		focusedLineIds,
		backgrounds,
		marks,
		glows,
		squiggles,
		brights,
		...(spotlight && { spotlight }),
		status,
		...(cursor && { cursor }),
		bursts,
		...(say !== undefined && { say }),
		...(sound && { sound }),
		missing,
	}
}
