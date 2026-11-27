import { Schema } from "effect"
import { Atom } from "effect/reactivity"
import { defaultKeymap, hotkeyActionIds } from "@/lib/hotkeys/registry"
import type { HotkeyMap, KeySequence } from "@/lib/hotkeys/types"
import { frontendKeyValueRuntime } from "./runtime"

const KeyComboSchema = Schema.Struct({
	key: Schema.String,
	ctrl: Schema.optional(Schema.Boolean),
	shift: Schema.optional(Schema.Boolean),
	alt: Schema.optional(Schema.Boolean),
	meta: Schema.optional(Schema.Boolean),
})

const KeySequenceSchema = Schema.Array(KeyComboSchema)

const HotkeyOverridesSchema = Schema.Record(Schema.String, Schema.Array(KeySequenceSchema))

export type HotkeyOverrides = Partial<Record<keyof HotkeyMap, KeySequence[]>>

export const hotkeyOverridesAtom = Atom.kvs({
	runtime: frontendKeyValueRuntime,
	key: "effect-institute:hotkeys",
	schema: HotkeyOverridesSchema,
	defaultValue: () => ({}),
})

export const hotkeyMapAtom = Atom.map(hotkeyOverridesAtom, (overrides) => {
	const merged: HotkeyMap = { ...defaultKeymap }
	for (const actionId of hotkeyActionIds) {
		const override = (overrides as HotkeyOverrides)[actionId]
		if (override) merged[actionId] = override
	}
	return merged
})
