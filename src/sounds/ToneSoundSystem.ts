import * as Tone from "tone"
import { asSynthOptions, type LooseSynthOptions } from "./synthOptions"

/**
 * Shared lifecycle wrapper for Tone.js powered sound systems. Handles
 * initializing the audio context, effect chain, transport, and mute/volume
 * state so individual sound systems only focus on their unique cues.
 */
export abstract class ToneSoundSystem {
	private initialized = false
	private initializing: Promise<void> | null = null
	private synthsReady = false
	private userGestureReceived = false
	protected muted = false
	private userLevel = 1
	private pendingVolume: number | null = null

	protected volumeNode: Tone.Volume | null = null
	protected reverbNode: Tone.Reverb | null = null
	protected transport: ReturnType<typeof Tone.getTransport> | null = null

	constructor(private readonly volume: number = -12) {}

	protected abstract setupSynths(): void
	protected abstract disposeSynths(): void

	protected get outputNode(): Tone.ToneAudioNode {
		return (this.reverbNode ?? this.volumeNode ?? Tone.getDestination()) as Tone.ToneAudioNode
	}

	protected createPolySynth(options: LooseSynthOptions, destination?: Tone.ToneAudioNode | null): Tone.PolySynth {
		const synth = new Tone.PolySynth(Tone.Synth, asSynthOptions(options))
		synth.connect(destination ?? this.outputNode)
		return synth
	}

	private ensureSynths() {
		if (!this.synthsReady) {
			this.setupSynths()
			this.synthsReady = true
		}
	}

	private canStartAudioContext(): boolean {
		return this.userGestureReceived || Tone.context.state === "running"
	}

	async unlockFromUserGesture(): Promise<boolean> {
		this.userGestureReceived = true
		try {
			await this.initialize()
			return this.initialized
		} catch {
			if (Tone.context.state !== "running") {
				this.userGestureReceived = false
			}
			return false
		}
	}

	private async initialize(): Promise<void> {
		if (this.initialized) return
		if (this.initializing) return this.initializing

		this.initializing = (async () => {
			if (Tone.context.state === "suspended") {
				if (!this.canStartAudioContext()) {
					return
				}

				await Tone.start()
			}

			this.volumeNode = new Tone.Volume(this.volume).toDestination()
			this.reverbNode = new Tone.Reverb({
				decay: 2.5,
				wet: 0.3,
			}).connect(this.volumeNode)

			this.ensureSynths()

			this.transport = Tone.getTransport()
			if (this.transport.state !== "started") {
				this.transport.start()
			}

			this.initialized = true

			// Apply any volume that was set before initialization
			if (this.pendingVolume !== null) {
				this.setVolume(this.pendingVolume)
				this.pendingVolume = null
			}
		})()

		try {
			await this.initializing
		} finally {
			this.initializing = null
		}
	}

	protected async ready(force = false): Promise<boolean> {
		if (!force && this.muted) {
			return false
		}

		try {
			await this.initialize()
			return this.initialized
		} catch {
			// Audio blocked by browser autoplay policy
			return false
		}
	}

	setMuted(muted: boolean) {
		this.muted = muted
	}

	get isMuted(): boolean {
		return this.muted
	}

	/** Effects volume from 0 to 1, as last set by the user. */
	get level(): number {
		return this.userLevel
	}

	setVolume(volume: number) {
		this.userLevel = volume
		if (!this.volumeNode) {
			// Store for later application after initialization
			this.pendingVolume = volume
			return
		}
		const decibels = volume === 0 ? -Infinity : -40 + volume * 40
		this.volumeNode.volume.value = decibels
	}

	async dispose() {
		this.disposeSynths()

		this.reverbNode?.dispose()
		this.reverbNode = null
		this.volumeNode?.dispose()
		this.volumeNode = null

		this.transport = null
		this.initialized = false
		this.synthsReady = false
	}
}
