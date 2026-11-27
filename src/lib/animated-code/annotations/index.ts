/**
 * # Annotations Module
 *
 * Type-safe annotations for code animations using Effect Schema.
 *
 * @example
 * ```typescript
 * import { Mark, Status, Spotlight } from "@/lib/animated-code/annotations"
 *
 * const annotations = [
 *   new Mark({ text: "Promise", color: "yellow" }),
 *   new Status({ text: "fetchUser", status: "running" }),
 * ]
 * ```
 */

// Schema exports (annotation classes and types)
export {
	// Union type
	Annotation,
	type Annotation as AnnotationType,
	Background,
	Bright,
	Burst,
	// Point annotations
	Cursor,
	// Line-level annotations
	Focus,
	Glow,
	// Type guards
	hasTextTarget,
	isCharRangeAnnotation,
	isPointAnnotation,
	// Character-level annotations
	Mark,
	Say,
	Sound,
	Spotlight,
	type SpotlightPattern,
	Squiggle,
	Status,
} from "./schema"
