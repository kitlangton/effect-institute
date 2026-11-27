// Barrel export for content authoring
// Import everything needed to define sections from "@/lib/content"

// Animation primitives used in content files
export {
	code,
	concat,
	empty,
	inline,
	line,
	output,
	slot,
	stack,
	text,
} from "@/lib/animated-code/animation"
// Compilation (for build script)
export * from "./compile"
// DSL primitives
export * from "./dsl"
