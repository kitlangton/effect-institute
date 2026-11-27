import * as Tone from "tone"
import type { LooseSynthOptions } from "@/sounds/synthOptions"
import { ToneSoundSystem } from "@/sounds/ToneSoundSystem"

const PENTATONIC_SCALE = ["C", "D", "E", "G", "A"] as const
const BASE_OCTAVE = 3

// Time (in ms) within which multiple notes are voiced as adjacent scale degrees in the same octave.
const CHORD_WINDOW_MS = 100

class TaskSoundSystem extends ToneSoundSystem {
	private synthSuccess: Tone.PolySynth | null = null
	private synthRunning: Tone.PolySynth | null = null
	private synthBass: Tone.PolySynth | null = null
	private interruptSynth: Tone.PolySynth | null = null
	private synthDeath: Tone.PolySynth | null = null
	private synthNotification: Tone.PolySynth | null = null
	private distortion: Tone.Distortion | null = null

	private currentNoteIndex = 0
	private chordWindowStart: number | null = null
	private chordStep = 0
	private chordBaseIndex = 0
	private chordBaseOctave = BASE_OCTAVE
	private isPlayingFailure = false
	private isPlayingInterrupt = false

	private inChordWindow(now = Date.now()): boolean {
		return this.chordWindowStart !== null && now - this.chordWindowStart <= CHORD_WINDOW_MS
	}

	private disposeNode<T extends { dispose(): void }>(node: T | null): null {
		node?.dispose()
		return null
	}

	private scheduleOnce(cb: () => void, time: string | number) {
		const t = this.transport ?? Tone.getTransport()
		t.scheduleOnce(cb, time)
	}

	protected setupSynths(): void {
		const reverbNode = this.reverbNode!
		this.distortion = new Tone.Distortion({ distortion: 0.8, wet: 1.0 }).connect(this.volumeNode!)
		const createSynth = (options: LooseSynthOptions, destination: Tone.ToneAudioNode = reverbNode) =>
			this.createPolySynth(options, destination)

		this.synthSuccess = createSynth({
			oscillator: { type: "triangle" },
			envelope: { attack: 0.02, decay: 0.3, sustain: 0.1, release: 1.2 },
		})
		this.synthRunning = createSynth({
			oscillator: { type: "sine" },
			envelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.1 },
		})
		this.synthBass = createSynth({
			oscillator: { type: "sawtooth" },
			envelope: { attack: 0.02, decay: 0.4, sustain: 0.1, release: 0.8 },
		})
		this.interruptSynth = createSynth({
			oscillator: { type: "triangle" },
			envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 },
		})
		this.synthDeath = createSynth(
			{
				oscillator: { type: "fatsawtooth10" },
				envelope: { attack: 0.01, decay: 0.5, sustain: 0.3, release: 1.5 },
			},
			this.distortion,
		)
		this.synthNotification = createSynth({
			oscillator: { type: "triangle" },
			envelope: { attack: 0.005, decay: 0.25, sustain: 0.1, release: 0.4 },
		})
	}

	protected disposeSynths(): void {
		this.synthSuccess = this.disposeNode(this.synthSuccess)
		this.synthRunning = this.disposeNode(this.synthRunning)
		this.synthBass = this.disposeNode(this.synthBass)
		this.interruptSynth = this.disposeNode(this.interruptSynth)
		this.synthDeath = this.disposeNode(this.synthDeath)
		this.synthNotification = this.disposeNode(this.synthNotification)
		this.distortion = this.disposeNode(this.distortion)
	}

	private getNextNote(octaveOffset: number = 0): string {
		const now = Date.now()
		if (!this.inChordWindow(now)) {
			this.chordWindowStart = now
			this.chordStep = 0
			this.chordBaseIndex = this.currentNoteIndex % PENTATONIC_SCALE.length
			this.chordBaseOctave = BASE_OCTAVE + octaveOffset
		}

		const scaleIndex = (this.chordBaseIndex + this.chordStep) % PENTATONIC_SCALE.length
		const note = PENTATONIC_SCALE[scaleIndex]
		const octave = this.chordBaseOctave

		this.chordStep++
		this.currentNoteIndex = (this.currentNoteIndex + 1) % (PENTATONIC_SCALE.length * 2)

		return `${note}${octave}`
	}

	async playSuccess() {
		if (!(await this.ready())) return

		const now = Date.now()
		if (!this.inChordWindow(now)) {
			this.chordWindowStart = now
			this.chordStep = 0
			this.chordBaseIndex = this.currentNoteIndex % PENTATONIC_SCALE.length
			this.chordBaseOctave = BASE_OCTAVE + 1
		}

		const rootNoteStr = `${PENTATONIC_SCALE[this.chordBaseIndex]}${this.chordBaseOctave}`
		const TRIAD_SEMITONES = [0, 4, 7] as const
		const semitoneOffset = TRIAD_SEMITONES[this.chordStep % TRIAD_SEMITONES.length] ?? 0
		const note = Tone.Frequency(rootNoteStr).transpose(semitoneOffset).toNote()

		this.chordStep++
		this.currentNoteIndex = (this.currentNoteIndex + 1) % (PENTATONIC_SCALE.length * 2)

		this.synthSuccess?.triggerAttackRelease(note, "4n")
	}

	async playFailure() {
		if (this.muted || this.isPlayingFailure) return
		this.isPlayingFailure = true

		await this.ready()

		const note = `${PENTATONIC_SCALE[this.currentNoteIndex % PENTATONIC_SCALE.length]}${BASE_OCTAVE - 1}`
		this.currentNoteIndex = (this.currentNoteIndex + 1) % PENTATONIC_SCALE.length

		const now = Tone.now()
		this.synthBass?.triggerAttackRelease(note, "4n", now, 0.65)

		this.scheduleOnce(() => {
			this.isPlayingFailure = false
		}, "+0.2")
	}

	async playInterrupted() {
		if (this.muted || this.isPlayingInterrupt) return
		this.isPlayingInterrupt = true

		await this.ready()

		const now = Tone.now()
		this.interruptSynth?.triggerAttackRelease("C5", "32n", now, 0.6)
		this.interruptSynth?.triggerAttackRelease("E5", "32n", now + 0.07, 0.6)

		this.scheduleOnce(() => {
			this.isPlayingInterrupt = false
		}, "+0.2")
	}

	async playRunning() {
		if (!(await this.ready())) return
		const note = this.getNextNote(0.5)
		this.synthRunning?.triggerAttackRelease(note, "32n", undefined, 0.25)
	}

	async playDeath() {
		if (!(await this.ready())) return

		const now = Tone.now()
		this.synthDeath?.triggerAttackRelease(`D#${BASE_OCTAVE}`, "32n", now, 0.45)
		this.synthDeath?.triggerAttackRelease(`C${BASE_OCTAVE - 2}`, "1n", now + 0.1, 0.55)
	}

	async playNotificationChime() {
		if (!(await this.ready())) return

		const now = Tone.now()
		this.synthNotification?.triggerAttackRelease("C5", "16n", now, 0.4)
		this.synthNotification?.triggerAttackRelease("E5", "16n", now + 0.12, 0.4)
	}
}

export const taskSounds = new TaskSoundSystem()
