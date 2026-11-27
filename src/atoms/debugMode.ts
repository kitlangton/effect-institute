import { Schema } from "effect"
import { Atom } from "effect/reactivity"
import { frontendKeyValueRuntime } from "./runtime"

/**
 * Debug mode: show section badges and debug controls.
 * Toggle with Ctrl+D (dev only).
 */
export const debugModeAtom = Atom.kvs({
	runtime: frontendKeyValueRuntime,
	key: "debug-mode",
	schema: Schema.Boolean,
	defaultValue: () => false,
})
