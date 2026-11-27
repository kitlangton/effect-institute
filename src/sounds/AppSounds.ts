import * as Tone from "tone"
import { COMPLETION_VARIANTS, type CompletionVariant } from "./SoundPresets"

export { COMPLETION_VARIANTS, type CompletionVariant }

import {
	type Destination,
	type SoundNode,
	SYNTH_DEFINITIONS,
	type SynthDefinition,
	type SynthKey,
	type SynthNodes,
} from "./synthDefinitions"
import { ToneSoundSystem } from "./ToneSoundSystem"

// Pentatonic scale
const PENTATONIC_NOTES = ["C", "D", "E", "G", "A"] as const
// Celebration scale - major scale for ascending celebration sounds
const CELEBRATION_SCALE = ["C", "D", "E", "F", "G", "A", "B"] as const

const EXAMPLE_ADVANCE_OCTAVE_MIN = 4
const EXAMPLE_ADVANCE_OCTAVE_MAX = 6

/** The table in build order: destinations before the nodes that feed them */
const SYNTH_ENTRIES = Object.entries(SYNTH_DEFINITIONS) as ReadonlyArray<[SynthKey, SynthDefinition<Destination>]>

/** A node with `runs: true` (the wind noise) */
type RunningSource = SoundNode & { start(): unknown; stop(): unknown }

class AppSoundSystem extends ToneSoundSystem {
	/** Every synth and effect, built from `SYNTH_DEFINITIONS` once audio starts */
	private nodes: SynthNodes | null = null
	private lastNoteIndex: number | null = null
	private lastOctave: number | null = null

	constructor() {
		super(-12)
	}

	/** Build every node in table order and wire it to its destination */
	protected setupSynths(): void {
		const built = new Map<Destination, SoundNode>()
		for (const [key, def] of SYNTH_ENTRIES) {
			const destination = def.to === "output" ? this.outputNode : built.get(def.to)
			if (!destination) throw new Error(`Sound node "${key}" routes to "${def.to}", which isn't built yet`)
			if (def.kind === "poly") {
				built.set(key, this.createPolySynth(def.options, destination as Tone.ToneAudioNode))
				continue
			}
			const node = new def.ctor(def.options as never)
			node.connect(destination as Tone.InputNode)
			if (def.runs) (node as RunningSource).start()
			built.set(key, node)
		}
		this.nodes = Object.fromEntries(built) as unknown as SynthNodes
	}

	/** Tear down bottom to top: sources first, then the effects they fed */
	protected disposeSynths(): void {
		const nodes = this.nodes
		this.nodes = null
		if (!nodes) return
		for (const [key, def] of [...SYNTH_ENTRIES].reverse()) {
			const node: SoundNode = nodes[key]
			if (def.kind === "node" && def.runs) (node as RunningSource).stop()
			node.dispose()
		}
	}

	/** Get a pentatonic note within range of the last note. */
	private getNextPentatonicNote(): string {
		const maxStep = 2 // Maximum steps in the pentatonic scale (e.g., C -> E is 2 steps)
		const maxOctaveChange = 1 // Maximum octave change

		let noteIndex: number
		let octave: number

		if (this.lastNoteIndex === null || this.lastOctave === null) {
			// First note - pick randomly
			noteIndex = Math.floor(Math.random() * PENTATONIC_NOTES.length)
			octave =
				Math.floor(Math.random() * (EXAMPLE_ADVANCE_OCTAVE_MAX - EXAMPLE_ADVANCE_OCTAVE_MIN + 1)) +
				EXAMPLE_ADVANCE_OCTAVE_MIN
		} else {
			// Pick a note within range of the last note
			const stepOffset = Math.floor(Math.random() * (maxStep * 2 + 1) - maxStep)
			noteIndex = (this.lastNoteIndex + stepOffset + PENTATONIC_NOTES.length) % PENTATONIC_NOTES.length

			// Pick an octave within range
			const octaveOffset = Math.floor(Math.random() * (maxOctaveChange * 2 + 1) - maxOctaveChange)
			octave = Math.max(
				EXAMPLE_ADVANCE_OCTAVE_MIN,
				Math.min(EXAMPLE_ADVANCE_OCTAVE_MAX, this.lastOctave + octaveOffset),
			)
		}

		// Store for next time
		this.lastNoteIndex = noteIndex
		this.lastOctave = octave

		const note = PENTATONIC_NOTES[noteIndex]
		return `${note}${octave}`
	}

	private lastClickTime = 0

	/** Subtle click sound for buttons and sections. */
	async playClick() {
		const now = Date.now()
		// Prevent double-firing within 150ms
		if (now - this.lastClickTime < 150) return
		this.lastClickTime = now
		if (!(await this.ready())) return
		this.nodes?.linkHoverSynth.triggerAttackRelease("G5", "32n", undefined, 0.25)
	}

	/** Clicky mechanical keyboard key press sound. */
	async playKeyPress() {
		if (!(await this.ready())) return
		this.nodes?.toggleSynth.triggerAttackRelease("E5", "32n", undefined, 0.85)
	}

	/** Subtle key release sound. */
	async playKeyRelease() {
		if (!(await this.ready())) return
		// Softer, lower pitch for release
		this.nodes?.linkHoverSynth.triggerAttackRelease("G5", "32n", undefined, 0.65)
	}

	/** Pentatonic sound when advancing steps (stays within range of previous note). */
	async playExampleAdvance() {
		if (!(await this.ready())) return
		const note = this.getNextPentatonicNote()
		this.nodes?.exampleAdvanceSynth.triggerAttackRelease(note, "16n", undefined, 0.3)
	}

	/** Sound when toggling mute (plays even when muted). */
	async playToggleSound(isMuted: boolean) {
		// Use force: true to play even when muted
		if (!(await this.ready(true))) return

		const now = Tone.now()

		if (isMuted) {
			// Descending notes when muting (disabling) - going down, legato
			this.nodes?.toggleSynth.triggerAttackRelease("E5", "8n", now, 0.5)
			// Start second note before first ends for legato effect
			this.nodes?.toggleSynth.triggerAttackRelease("C5", "8n", now + 0.15, 0.5)
		} else {
			// Ascending notes when unmuting (enabling) - going up, legato
			this.nodes?.toggleSynth.triggerAttackRelease("C5", "8n", now, 0.5)
			// Start second note before first ends for legato effect
			this.nodes?.toggleSynth.triggerAttackRelease("E5", "8n", now + 0.15, 0.5)
		}
	}

	/** Subtle tick when navigating between sections. */
	async playNavigationTick() {
		if (!(await this.ready())) return
		this.nodes?.linkHoverSynth.triggerAttackRelease("E6", "32n", undefined, 0.4)
	}

	/** Very subtle tick for skipping forward/back any amount. */
	async playSkipTick() {
		if (!(await this.ready())) return
		this.nodes?.linkHoverSynth.triggerAttackRelease("C6", "64n", undefined, 0.09)
	}

	/** Happy success sound - bright ascending sparkle. */
	async playSentSound() {
		if (!(await this.ready())) return
		const now = Tone.now()
		// Bright ascending arpeggio - cheerful success feel
		this.nodes?.linkHoverSynth.triggerAttackRelease("E5", "16n", now, 0.3)
		this.nodes?.linkHoverSynth.triggerAttackRelease("G5", "16n", now + 0.07, 0.3)
		this.nodes?.linkHoverSynth.triggerAttackRelease("C6", "16n", now + 0.14, 0.35)
	}

	/** Gentle completion sound when a section is finished. */
	async playCompletionSound() {
		await this.playCompletionVariant("ding-soft")
	}

	/** Play a specific completion sound variant */
	async playCompletionVariant(variant: CompletionVariant) {
		if (!(await this.ready())) return
		const now = Tone.now()
		const vol = 0.4
		const gap = 0.07 // Time between notes

		switch (variant) {
			// === SINGLE NOTE DINGS ===
			case "ding-bell":
				// Pure sine bell - classic XP sound (E5)
				this.nodes?.dingBellSynth.triggerAttackRelease("E5", "4n", now, vol)
				break
			case "ding-crystal":
				// Bright triangle - airy chime (G5)
				this.nodes?.dingCrystalSynth.triggerAttackRelease("G5", "4n", now, vol)
				break
			case "ding-soft":
				// Warm filtered sine - muted tone (C5)
				this.nodes?.dingSoftSynth.triggerAttackRelease("C5", "4n", now, vol)
				break
			case "ding-pluck":
				// Quick marimba-like hit (A5)
				this.nodes?.dingPluckSynth.triggerAttackRelease("A5", "8n", now, vol * 1.2)
				break
			case "ding-shimmer":
				// Reverb tail sparkle (D5)
				this.nodes?.dingShimmerSynth.triggerAttackRelease("D5", "4n", now, vol * 0.9)
				break
			case "ding-chip":
				// 8-bit coin sound (B5)
				this.nodes?.dingChipSynth.triggerAttackRelease("B5", "16n", now, vol)
				break

			// Square wave (NES style)
			case "square-fourth":
				this.nodes?.chipSquareSynth.triggerAttackRelease("G4", "16n", now, vol)
				this.nodes?.chipSquareSynth.triggerAttackRelease("C5", "8n", now + gap, vol)
				break
			case "square-fifth":
				this.nodes?.chipSquareSynth.triggerAttackRelease("G4", "16n", now, vol)
				this.nodes?.chipSquareSynth.triggerAttackRelease("D5", "8n", now + gap, vol)
				break
			case "square-octave":
				this.nodes?.chipSquareSynth.triggerAttackRelease("C4", "16n", now, vol)
				this.nodes?.chipSquareSynth.triggerAttackRelease("C5", "8n", now + gap, vol)
				break

			// Triangle wave (SNES style - softer)
			case "tri-fourth":
				this.nodes?.chipTriangleSynth.triggerAttackRelease("G4", "16n", now, vol)
				this.nodes?.chipTriangleSynth.triggerAttackRelease("C5", "8n", now + gap, vol)
				break
			case "tri-fifth":
				this.nodes?.chipTriangleSynth.triggerAttackRelease("G4", "16n", now, vol)
				this.nodes?.chipTriangleSynth.triggerAttackRelease("D5", "8n", now + gap, vol)
				break
			case "tri-major":
				this.nodes?.chipTriangleSynth.triggerAttackRelease("C5", "16n", now, vol)
				this.nodes?.chipTriangleSynth.triggerAttackRelease("E5", "8n", now + gap, vol)
				break

			// Pulse wave (Game Boy style)
			case "pulse-fourth":
				this.nodes?.chipPulseSynth.triggerAttackRelease("G4", "16n", now, vol)
				this.nodes?.chipPulseSynth.triggerAttackRelease("C5", "8n", now + gap, vol)
				break
			case "pulse-fifth":
				this.nodes?.chipPulseSynth.triggerAttackRelease("G4", "16n", now, vol)
				this.nodes?.chipPulseSynth.triggerAttackRelease("D5", "8n", now + gap, vol)
				break

			// Pure sine (clean)
			case "sine-fourth":
				this.nodes?.chipSineSynth.triggerAttackRelease("G4", "16n", now, vol)
				this.nodes?.chipSineSynth.triggerAttackRelease("C5", "8n", now + gap, vol)
				break
			case "sine-fifth":
				this.nodes?.chipSineSynth.triggerAttackRelease("G4", "16n", now, vol)
				this.nodes?.chipSineSynth.triggerAttackRelease("D5", "8n", now + gap, vol)
				break

			// With reverb (spacious)
			case "reverb-fourth":
				this.nodes?.celebrationSwellSynth.triggerAttackRelease("G4", "8n", now, vol * 0.8)
				this.nodes?.celebrationSwellSynth.triggerAttackRelease("C5", "4n", now + gap, vol * 0.9)
				break
			case "reverb-fifth":
				this.nodes?.celebrationSwellSynth.triggerAttackRelease("G4", "8n", now, vol * 0.8)
				this.nodes?.celebrationSwellSynth.triggerAttackRelease("D5", "4n", now + gap, vol * 0.9)
				break
		}
	}

	/**
	 * Celebratory major third dyads for group completion sequences.
	 * Each call plays a random major third (root + third) from the scale.
	 */
	async playCelebrationNote(_index: number) {
		if (!(await this.ready())) return
		// Random major third dyads from the scale
		const baseOctave = 5
		// Pick a random root note from the scale
		const scaleIndex = Math.floor(Math.random() * CELEBRATION_SCALE.length)
		// Occasionally bump up an octave for variety
		const octaveOffset = Math.random() < 0.3 ? 1 : 0
		const octave = baseOctave + octaveOffset
		const root = `${CELEBRATION_SCALE[scaleIndex]}${octave}`
		// Major third (+2 scale steps)
		const thirdIndex = (scaleIndex + 2) % CELEBRATION_SCALE.length
		const thirdOctave = octave + (scaleIndex + 2 >= CELEBRATION_SCALE.length ? 1 : 0)
		const third = `${CELEBRATION_SCALE[thirdIndex]}${thirdOctave}`

		const now = Tone.now()
		this.nodes?.completionSynth.triggerAttackRelease(root, "4n", now, 0.35)
		this.nodes?.completionSynth.triggerAttackRelease(third, "4n", now, 0.3)
	}

	/** Alarm sound alternating between two notes, like a pager alert. */
	async playAlarmSound() {
		if (!(await this.ready())) return

		const now = Tone.now()
		// Alternating between B4 and E5 (perfect fourth) for that classic pager feel
		// Quick alternation creates urgency
		this.nodes?.toggleSynth.triggerAttackRelease("B4", "16n", now, 0.6)
		this.nodes?.toggleSynth.triggerAttackRelease("E5", "16n", now + 0.12, 0.6)
		this.nodes?.toggleSynth.triggerAttackRelease("B4", "16n", now + 0.24, 0.6)
		this.nodes?.toggleSynth.triggerAttackRelease("E5", "16n", now + 0.36, 0.5)
	}

	// === DOOM SOUNDS ===

	/** Inception horn - dramatic low swell that opens up. */
	async playDoomSound() {
		if (!(await this.ready())) return

		const now = Tone.now()
		// Filter sweep from closed to open for the "BWAAAH" effect
		this.nodes?.doomSwellFilter.frequency.setValueAtTime(200, now)
		this.nodes?.doomSwellFilter.frequency.exponentialRampToValueAtTime(1500, now + 0.4)

		this.nodes?.doomSwellSynth.triggerAttack("D2", now, 0.8)
		this.nodes?.doomSwellSynth.triggerRelease(now + 0.6)
	}

	/** Slowing heartbeat - thump... thump...... (dies). */
	async playDoomHeartbeat() {
		if (!(await this.ready())) return

		const now = Tone.now()
		// Heartbeat that slows down and fades - like life draining away
		const beats = [
			{ time: 0, vel: 0.9 },
			{ time: 0.25, vel: 0.7 },
			{ time: 0.55, vel: 0.5 },
			{ time: 0.95, vel: 0.25 },
		]

		beats.forEach(({ time, vel }) => {
			this.nodes?.doomHeartSynth.triggerAttackRelease("C1", "8n", now + time, vel)
		})
	}

	/** Glass shatter - cascading crystalline notes falling apart. */
	async playDoomShatter() {
		if (!(await this.ready())) return

		const now = Tone.now()
		// High notes cascade down chaotically like breaking glass
		const shards = ["C7", "E7", "G6", "B6", "D6", "F6", "A5", "C6", "E5", "G5", "B4", "D5"]

		shards.forEach((note, i) => {
			const time = i * 0.025 + Math.random() * 0.015
			const vel = 0.6 - i * 0.04
			this.nodes?.doomShatterSynth.triggerAttackRelease(note, "32n", now + time, Math.max(0.1, vel))
		})
	}

	/** Void suck - sound being pulled into a black hole. */
	async playDoomVoid() {
		if (!(await this.ready())) return

		const now = Tone.now()
		// Filter closes down as pitch drops - like being sucked into void
		this.nodes?.doomVoidFilter.frequency.setValueAtTime(3000, now)
		this.nodes?.doomVoidFilter.frequency.exponentialRampToValueAtTime(100, now + 0.5)

		this.nodes?.doomVoidSynth.triggerAttack("A3", now, 0.7)
		this.nodes?.doomVoidSynth.frequency.exponentialRampTo("A1", 0.5, now)
		this.nodes?.doomVoidSynth.triggerRelease(now + 0.5)
	}

	// === SPOOKY SOUNDS ===

	/** Creepy giggle - rapid high notes like eerie laughter. */
	async playSpookySound() {
		if (!(await this.ready())) return

		const now = Tone.now()
		// Ha-ha-ha-ha pattern with pitch variation
		const giggles = [
			{ note: "E6", time: 0 },
			{ note: "G6", time: 0.07 },
			{ note: "E6", time: 0.12 },
			{ note: "C6", time: 0.18 },
			{ note: "E6", time: 0.25 },
			{ note: "G6", time: 0.32 },
		]

		giggles.forEach(({ note, time }) => {
			this.nodes?.spookyGiggleSynth.triggerAttackRelease(note, "64n", now + time, 0.4)
		})
	}

	/** Horror strings - dissonant tremolo cluster. */
	async playSpookyStrings() {
		if (!(await this.ready())) return

		const now = Tone.now()
		// Cluster of dissonant notes with chorus for that horror movie string section
		const cluster = ["E4", "F4", "B4", "C5"] // Minor 2nds and tritones

		cluster.forEach((note, i) => {
			this.nodes?.spookyStringsSynth.triggerAttackRelease(note, "4n", now + i * 0.02, 0.25)
		})
	}

	/** Haunted wind - filtered noise sweep like wind through ruins. */
	async playSpookyWind() {
		if (!(await this.ready())) return

		const now = Tone.now()
		// Sweep the filter and gain to create wind effect
		this.nodes?.spookyWindGain.gain.setValueAtTime(0, now)
		this.nodes?.spookyWindGain.gain.linearRampToValueAtTime(0.4, now + 0.15)
		this.nodes?.spookyWindGain.gain.linearRampToValueAtTime(0.2, now + 0.3)
		this.nodes?.spookyWindGain.gain.linearRampToValueAtTime(0.5, now + 0.4)
		this.nodes?.spookyWindGain.gain.linearRampToValueAtTime(0, now + 0.7)

		// Filter sweep for "whooo" quality
		this.nodes?.spookyWindFilter.frequency.setValueAtTime(200, now)
		this.nodes?.spookyWindFilter.frequency.exponentialRampToValueAtTime(600, now + 0.2)
		this.nodes?.spookyWindFilter.frequency.exponentialRampToValueAtTime(300, now + 0.5)
		this.nodes?.spookyWindFilter.frequency.exponentialRampToValueAtTime(150, now + 0.7)
	}

	/** Ghost radio - lo-fi transmission with eerie tone cutting through. */
	async playSpookyRadio() {
		if (!(await this.ready())) return

		const now = Tone.now()
		// Warbling AM tone through bandpass = old radio ghost voice
		this.nodes?.spookyRadioSynth.triggerAttack("G4", now, 0.4)
		this.nodes?.spookyRadioSynth.frequency.exponentialRampTo("E4", 0.2, now)
		this.nodes?.spookyRadioSynth.frequency.exponentialRampTo("C4", 0.15, now + 0.2)
		this.nodes?.spookyRadioSynth.triggerRelease(now + 0.4)
	}

	// === ORCHESTRAL SOUNDS ===

	/** Violin swell - subtle mid-range string. */
	async playViolinSwell() {
		if (!(await this.ready())) return

		const now = Tone.now()
		// Gentle filter opening
		this.nodes?.orchestralFilter.frequency.setValueAtTime(500, now)
		this.nodes?.orchestralFilter.frequency.exponentialRampToValueAtTime(1500, now + 0.25)

		this.nodes?.orchestralSynth.triggerAttack("A3", now, 0.25)
		this.nodes?.orchestralSynth.triggerRelease(now + 0.4)
	}

	/** Cello swell - deep warm string. */
	async playCelloSwell() {
		if (!(await this.ready())) return

		const now = Tone.now()
		// Warm, subtle filter
		this.nodes?.orchestralFilter.frequency.setValueAtTime(300, now)
		this.nodes?.orchestralFilter.frequency.exponentialRampToValueAtTime(900, now + 0.3)

		this.nodes?.orchestralSynth.triggerAttack("C2", now, 0.3)
		this.nodes?.orchestralSynth.triggerRelease(now + 0.45)
	}

	/** Full strings swell - subtle chord for "behold" moments. */
	async playStringsSwell() {
		if (!(await this.ready())) return

		const now = Tone.now()
		// Gentle filter sweep
		this.nodes?.orchestralFilter.frequency.setValueAtTime(400, now)
		this.nodes?.orchestralFilter.frequency.exponentialRampToValueAtTime(1200, now + 0.35)

		// Low chord - darker voicing
		const chord = ["C2", "G2", "E3"]
		chord.forEach((note, i) => {
			this.nodes?.orchestralSynth.triggerAttack(note, now + i * 0.015, 0.2)
		})

		this.nodes?.orchestralSynth.releaseAll(now + 0.5)
	}

	/** Rising strings - subtle upward motion. */
	async playRisingStrings() {
		if (!(await this.ready())) return

		const now = Tone.now()
		// Gentle filter opening
		this.nodes?.orchestralFilter.frequency.setValueAtTime(350, now)
		this.nodes?.orchestralFilter.frequency.exponentialRampToValueAtTime(1400, now + 0.4)

		// Three-note rise, lower register
		this.nodes?.orchestralSynth.triggerAttack("G2", now, 0.2)
		this.nodes?.orchestralSynth.triggerAttack("D3", now + 0.1, 0.25)
		this.nodes?.orchestralSynth.triggerAttack("G3", now + 0.2, 0.3)

		this.nodes?.orchestralSynth.releaseAll(now + 0.5)
	}

	// === STATUS CHANGE SOUNDS (from visual-effect) ===

	/** Deep bass failure sound - matches visual-effect's playFailure */
	async playFail() {
		if (!(await this.ready())) return
		// Deep bass tone at C2 (fixed pitch, no cycling)
		this.nodes?.failBassSynth.triggerAttackRelease("C2", "4n", undefined, 0.65)
	}

	/** Success chime - fixed pitch triangle note */
	async playWin() {
		if (!(await this.ready())) return
		// Single bright note at E5 (fixed pitch, no cycling)
		this.nodes?.winSynth.triggerAttackRelease("E5", "4n", undefined, 0.5)
	}

	/** Silly trombone - random deep note with slight pitch bend for dopey effect */
	async playDerpTrombone() {
		if (!(await this.ready())) return
		// Random low notes for that dopey trombone sound
		const notes = ["G2", "A2", "Bb2", "C3", "D3", "Eb3", "F3", "G3"]
		const note = notes[Math.floor(Math.random() * notes.length)]
		const now = Tone.now()

		// Quick pitch bend down for the "derp" effect
		this.nodes?.derpTromboneSynth.frequency.setValueAtTime(Tone.Frequency(note).toFrequency() * 1.05, now)
		this.nodes?.derpTromboneSynth.frequency.exponentialRampToValueAtTime(
			Tone.Frequency(note).toFrequency() * 0.97,
			now + 0.08,
		)
		this.nodes?.derpTromboneSynth.triggerAttackRelease(note, "8n", now, 0.5)
	}
}

// Singleton instance
export const appSounds = new AppSoundSystem()
