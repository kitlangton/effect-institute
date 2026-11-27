import { Schema } from "effect"
import { Atom } from "effect/reactivity"
import { frontendKeyValueRuntime } from "./runtime"

export const volumeAtom = Atom.kvs({
	runtime: frontendKeyValueRuntime,
	key: "effect-institute:volume",
	schema: Schema.Number,
	defaultValue: () => 1,
})
