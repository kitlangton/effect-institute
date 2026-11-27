import type * as Tone from "tone"

type LooseOscillatorType = Tone.ToneOscillatorType | "pulse" | "fatsawtooth10"

type LooseOscillatorOptions = {
	type?: LooseOscillatorType
	width?: number
	[key: string]: unknown
}

type LooseEnvelopeOptions = Partial<Tone.EnvelopeOptions>

export type LooseSynthOptions = Partial<Omit<Tone.SynthOptions, "oscillator" | "envelope" | "modulationEnvelope">> & {
	oscillator?: LooseOscillatorOptions
	envelope?: LooseEnvelopeOptions
	modulationEnvelope?: LooseEnvelopeOptions
}

export const asSynthOptions = (options: LooseSynthOptions): Tone.SynthOptions => options as Tone.SynthOptions
