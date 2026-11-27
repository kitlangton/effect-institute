import * as Tone from "tone"
import type { LooseSynthOptions } from "./synthOptions"

/**
 * Every Tone.js node the app sound system owns, in build order. Each entry names its constructor, its options,
 * and where its output goes: `"output"` (the system's shared reverb → volume chain) or a node defined earlier in
 * the table. `AppSoundSystem` builds them top to bottom and disposes them bottom to top.
 */

/** Anything the table can build: connectable and disposable */
export type SoundNode = { connect(destination: Tone.InputNode): unknown; dispose(): unknown }

/** `new Tone.PolySynth(Tone.Synth, options)`, the workhorse for every polyphonic cue */
export interface PolyDefinition<D extends string = string> {
	readonly kind: "poly"
	readonly options: LooseSynthOptions
	readonly to: D
}

/** `new ctor(options)` for any other Tone node: mono synths, filters, effects, sources */
export interface NodeDefinition<N extends SoundNode = SoundNode, D extends string = string> {
	readonly kind: "node"
	readonly ctor: new (options: never) => N
	readonly options: unknown
	readonly to: D
	/** A source that runs continuously: started once wired, stopped before disposal */
	readonly runs: boolean
}

export type SynthDefinition<D extends string = string> = PolyDefinition<D> | NodeDefinition<SoundNode, D>

const poly = <const D extends string = "output">(options: LooseSynthOptions, to?: D): PolyDefinition<D> => ({
	kind: "poly",
	options,
	to: (to ?? "output") as D,
})

/** The options are checked against the constructor's options overload */
const node = <C extends new (...args: any[]) => SoundNode, const D extends string = "output">(
	ctor: C,
	options: NonNullable<ConstructorParameters<C>[0]>,
	wiring: { readonly to?: D; readonly runs?: boolean } = {},
): NodeDefinition<InstanceType<C>, D> => ({
	kind: "node",
	ctor: ctor as unknown as new (options: never) => InstanceType<C>,
	options,
	to: (wiring.to ?? "output") as D,
	runs: wiring.runs ?? false,
})

const table = {
	/* UI ticks, clicks and toggles */
	linkHoverSynth: poly({
		oscillator: { type: "sine" },
		envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
	}),
	exampleAdvanceSynth: poly({
		oscillator: { type: "sine" },
		envelope: { attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.3 },
	}),
	toggleSynth: poly({
		oscillator: { type: "triangle" },
		envelope: { attack: 0.002, decay: 0.1, sustain: 0.05, release: 0.2 },
	}),
	completionSynth: poly({
		oscillator: { type: "sine" },
		envelope: { attack: 0.05, decay: 0.4, sustain: 0.2, release: 0.8 },
	}),

	/* Doom: horn swell through a sweeping lowpass, heartbeat, shatter, void */
	doomSwellFilter: node(Tone.Filter, { frequency: 400, type: "lowpass", rolloff: -24 }),
	doomSwellSynth: node(
		Tone.Synth,
		{
			oscillator: { type: "sawtooth" },
			envelope: { attack: 0.3, decay: 0.1, sustain: 0.8, release: 0.5 },
		},
		{ to: "doomSwellFilter" },
	),
	doomHeartSynth: node(Tone.MembraneSynth, {
		pitchDecay: 0.08,
		octaves: 4,
		oscillator: { type: "sine" },
		envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.4 },
	}),
	doomShatterSynth: poly({
		oscillator: { type: "triangle" },
		envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.3 },
	}),
	doomVoidFilter: node(Tone.Filter, { frequency: 2000, type: "lowpass", rolloff: -24 }),
	doomVoidSynth: node(
		Tone.FMSynth,
		{
			harmonicity: 2,
			modulationIndex: 4,
			oscillator: { type: "sine" },
			envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.8 },
			modulation: { type: "sine" },
			modulationEnvelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.5 },
		},
		{ to: "doomVoidFilter" },
	),

	/* Spooky: giggle, chorused strings, wind (pink noise → gain → bandpass), AM radio */
	spookyGiggleSynth: node(Tone.Synth, {
		oscillator: { type: "sine" },
		envelope: { attack: 0.005, decay: 0.05, sustain: 0.1, release: 0.1 },
	}),
	spookyStringsChorus: node(Tone.Chorus, { frequency: 4, delayTime: 2.5, depth: 0.7, spread: 180 }),
	spookyStringsSynth: poly(
		{
			oscillator: { type: "sawtooth" },
			envelope: { attack: 0.1, decay: 0.3, sustain: 0.7, release: 0.5 },
		},
		"spookyStringsChorus",
	),
	spookyWindFilter: node(Tone.Filter, { frequency: 300, type: "bandpass", Q: 2 }),
	spookyWindGain: node(Tone.Gain, { gain: 0 }, { to: "spookyWindFilter" }),
	spookyWindNoise: node(Tone.Noise, { type: "pink" }, { to: "spookyWindGain", runs: true }),
	spookyRadioFilter: node(Tone.Filter, { frequency: 1200, type: "bandpass", Q: 5 }),
	spookyRadioSynth: node(
		Tone.AMSynth,
		{
			harmonicity: 1.5,
			oscillator: { type: "sine" },
			envelope: { attack: 0.05, decay: 0.2, sustain: 0.4, release: 0.6 },
			modulation: { type: "square" },
			modulationEnvelope: { attack: 0.2, decay: 0.1, sustain: 0.8, release: 0.3 },
		},
		{ to: "spookyRadioFilter" },
	),

	/* Orchestral strings: synth → chorus → vibrato → lowpass */
	orchestralFilter: node(Tone.Filter, { frequency: 800, type: "lowpass", rolloff: -12 }),
	orchestralVibrato: node(Tone.Vibrato, { frequency: 5, depth: 0.1, type: "sine" }, { to: "orchestralFilter" }),
	orchestralChorus: node(
		Tone.Chorus,
		{ frequency: 2, delayTime: 3.5, depth: 0.4, spread: 180 },
		{ to: "orchestralVibrato" },
	),
	orchestralSynth: poly(
		{
			oscillator: { type: "sawtooth" },
			envelope: { attack: 0.15, decay: 0.1, sustain: 0.6, release: 0.4 },
		},
		"orchestralChorus",
	),

	/* Celebration swell: synth → lowpass → long reverb */
	celebrationReverb: node(Tone.Reverb, { decay: 3.5, wet: 0.6, preDelay: 0.01 }),
	celebrationFilter: node(Tone.Filter, { frequency: 2000, type: "lowpass", rolloff: -12 }, { to: "celebrationReverb" }),
	celebrationSwellSynth: poly(
		{
			oscillator: { type: "sine" },
			envelope: { attack: 0.08, decay: 0.3, sustain: 0.4, release: 1.5 },
		},
		"celebrationFilter",
	),

	/* Chiptune two-note completions */
	chipSquareSynth: poly({
		oscillator: { type: "square" },
		envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.15 },
	}),
	chipTriangleSynth: poly({
		oscillator: { type: "triangle" },
		envelope: { attack: 0.01, decay: 0.15, sustain: 0.4, release: 0.2 },
	}),
	chipPulseSynth: poly({
		oscillator: { type: "pulse", width: 0.25 },
		envelope: { attack: 0.005, decay: 0.12, sustain: 0.25, release: 0.12 },
	}),
	chipSineSynth: poly({
		oscillator: { type: "sine" },
		envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.25 },
	}),

	/* Single-note completion dings */
	dingBellSynth: poly({
		oscillator: { type: "sine" },
		envelope: { attack: 0.005, decay: 0.6, sustain: 0, release: 0.3 },
	}),
	dingCrystalSynth: poly({
		oscillator: { type: "triangle" },
		envelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.2 },
	}),
	dingSoftFilter: node(Tone.Filter, { frequency: 1200, type: "lowpass", rolloff: -24 }),
	dingSoftSynth: poly(
		{
			oscillator: { type: "sine" },
			envelope: { attack: 0.02, decay: 0.5, sustain: 0.1, release: 0.4 },
		},
		"dingSoftFilter",
	),
	dingPluckSynth: poly({
		oscillator: { type: "triangle" },
		envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
	}),
	dingShimmerReverb: node(Tone.Reverb, { decay: 2.5, wet: 0.7 }),
	dingShimmerSynth: poly(
		{
			oscillator: { type: "sine" },
			envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.8 },
		},
		"dingShimmerReverb",
	),
	dingChipSynth: poly({
		oscillator: { type: "square" },
		envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
	}),

	/* Status changes */
	failBassSynth: poly({
		oscillator: { type: "sawtooth" },
		envelope: { attack: 0.02, decay: 0.4, sustain: 0.1, release: 0.8 },
	}),
	winSynth: poly({
		oscillator: { type: "triangle" },
		envelope: { attack: 0.02, decay: 0.3, sustain: 0.1, release: 1.2 },
	}),

	/* Silly trombone for mocking quotes: sawtooth through a dopey lowpass */
	derpTromboneFilter: node(Tone.Filter, { frequency: 600, type: "lowpass", rolloff: -24 }),
	derpTromboneSynth: node(
		Tone.Synth,
		{
			oscillator: { type: "sawtooth" },
			envelope: { attack: 0.03, decay: 0.15, sustain: 0.3, release: 0.2 },
		},
		{ to: "derpTromboneFilter" },
	),
}

export type SynthKey = keyof typeof table

/** Where a node sends its output: the shared chain, or another key in the table */
export type Destination = "output" | SynthKey

type BuiltNode<D> = D extends NodeDefinition<infer N> ? N : Tone.PolySynth

/** The built nodes, typed per entry (`doomVoidSynth: Tone.FMSynth`, `linkHoverSynth: Tone.PolySynth`, ...) */
export type SynthNodes = { readonly [K in SynthKey]: BuiltNode<(typeof table)[K]> }

/** The table, checked so every `to` names a key in it (a typo fails typecheck) */
export const SYNTH_DEFINITIONS: { readonly [K in SynthKey]: SynthDefinition<Destination> } = table
