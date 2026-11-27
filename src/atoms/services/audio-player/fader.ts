/**
 * Web Audio gain fader for click-free play, pause, and seek transitions.
 *
 * Skips Web Audio routing on Safari due to createMediaElementSource + playbackRate
 * glitches (WebKit bugs 240405, 221334).
 */
import { Effect } from "effect"

const SEEK_FADE_OUT_SEC = 0.01
const SEEK_FADE_IN_SEC = 0.015
const PLAY_FADE_IN_SEC = 0.015
const PAUSE_FADE_OUT_SEC = 0.02

const isSafari = () => {
	if (typeof navigator === "undefined") return false
	return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}

export class WebAudioFader {
	private audioContext: AudioContext | null = null
	private gainNode: GainNode | null = null
	private mediaSourceNode: MediaElementAudioSourceNode | null = null
	private baseGain = 1
	private seekSequence = 0
	private transportSequence = 0
	private seekTimerId: ReturnType<typeof setTimeout> | null = null
	private pauseTimerId: ReturnType<typeof setTimeout> | null = null
	private disposed = false

	attach(element: HTMLAudioElement): void {
		if (this.disposed || isSafari() || typeof AudioContext === "undefined") return

		if (!this.audioContext) {
			this.audioContext = new AudioContext()
			this.gainNode = this.audioContext.createGain()
			this.gainNode.gain.value = this.baseGain
			this.gainNode.connect(this.audioContext.destination)
		}

		if (!this.mediaSourceNode && this.audioContext && this.gainNode) {
			this.mediaSourceNode = this.audioContext.createMediaElementSource(element)
			this.mediaSourceNode.connect(this.gainNode)
		}
	}

	resumeIfSuspended(): Effect.Effect<void> {
		const ctx = this.audioContext
		if (ctx?.state !== "suspended") return Effect.void
		return Effect.tryPromise(() => ctx.resume()).pipe(Effect.catch(() => Effect.void))
	}

	private canFadeTransport(): boolean {
		if (!this.audioContext || !this.gainNode) return false
		if (this.audioContext.state === "suspended") return false
		return true
	}

	private canFadeSeek(element: HTMLAudioElement): boolean {
		if (!this.canFadeTransport()) return false
		if (element.paused) return false
		return true
	}

	private nextTransportToken(): number {
		return ++this.transportSequence
	}

	private rampGain(from: number, to: number, durationSec: number, token: number): void {
		if (!this.audioContext || !this.gainNode) return
		if (token !== this.transportSequence) return
		const now = this.audioContext.currentTime
		const gain = this.gainNode.gain
		gain.cancelScheduledValues(now)
		gain.setValueAtTime(from, now)
		if (durationSec <= 0) {
			gain.setValueAtTime(to, now)
		} else {
			gain.linearRampToValueAtTime(to, now + durationSec)
		}
	}

	private resetGain(token?: number): void {
		const nextToken = token ?? this.nextTransportToken()
		this.rampGain(this.baseGain, this.baseGain, 0, nextToken)
	}

	private clearPauseTimer(): void {
		if (this.pauseTimerId !== null) {
			clearTimeout(this.pauseTimerId)
			this.pauseTimerId = null
		}
	}

	private clearSeekTimer(): void {
		if (this.seekTimerId !== null) {
			clearTimeout(this.seekTimerId)
			this.seekTimerId = null
		}
	}

	preparePlay(): number | null {
		this.clearPauseTimer()
		if (!this.canFadeTransport()) return null
		const token = this.nextTransportToken()
		this.rampGain(0, 0, 0, token)
		return token
	}

	fadeInPlay(token: number | null): void {
		if (token !== null) {
			this.rampGain(0, this.baseGain, PLAY_FADE_IN_SEC, token)
		}
	}

	cancelPlayFade(token: number | null): void {
		if (token !== null) {
			this.resetGain(token)
		}
	}

	fadePause(element: HTMLAudioElement): void {
		this.clearPauseTimer()
		if (this.canFadeTransport() && !element.paused) {
			const token = this.nextTransportToken()
			const startGain = this.gainNode?.gain.value ?? this.baseGain
			this.rampGain(startGain, 0, PAUSE_FADE_OUT_SEC, token)

			this.pauseTimerId = setTimeout(
				() => {
					this.pauseTimerId = null
					if (this.disposed || token !== this.transportSequence) return
					element.pause()
					this.rampGain(0, this.baseGain, PLAY_FADE_IN_SEC, token)
				},
				Math.max(0, PAUSE_FADE_OUT_SEC * 1000),
			)
		} else {
			element.pause()
			this.resetGain()
		}
	}

	fadeSeek(element: HTMLAudioElement, targetTime: number, onError: () => void): void {
		this.clearSeekTimer()
		if (!this.canFadeSeek(element)) {
			element.currentTime = targetTime
			return
		}

		const ctx = this.audioContext!
		const gain = this.gainNode!.gain
		const now = ctx.currentTime
		const currentGain = gain.value
		const token = ++this.seekSequence

		gain.cancelScheduledValues(now)
		gain.setValueAtTime(currentGain, now)
		gain.linearRampToValueAtTime(0, now + SEEK_FADE_OUT_SEC)

		this.seekTimerId = setTimeout(
			() => {
				this.seekTimerId = null
				if (this.disposed || token !== this.seekSequence) return

				try {
					element.currentTime = targetTime
				} catch {
					onError()
				}

				const resumeAt = ctx.currentTime
				gain.cancelScheduledValues(resumeAt)
				gain.setValueAtTime(0, resumeAt)
				gain.linearRampToValueAtTime(currentGain, resumeAt + SEEK_FADE_IN_SEC)
			},
			Math.max(0, SEEK_FADE_OUT_SEC * 1000),
		)
	}

	setVolume(volume: number, element: HTMLAudioElement | null): void {
		const clamped = Math.max(0, Math.min(1, volume))
		this.baseGain = clamped

		if (this.gainNode) {
			this.gainNode.gain.value = clamped
		}

		if (element) {
			element.volume = clamped
		}
	}

	dispose(): void {
		this.disposed = true
		this.seekSequence += 1
		this.transportSequence += 1
		this.clearSeekTimer()
		this.clearPauseTimer()

		try {
			this.mediaSourceNode?.disconnect()
		} catch {
			// Ignore disconnect errors during teardown
		}
		try {
			this.gainNode?.disconnect()
		} catch {
			// Ignore disconnect errors during teardown
		}
		this.mediaSourceNode = null
		this.gainNode = null

		if (this.audioContext) {
			void this.audioContext.close().catch(() => {})
			this.audioContext = null
		}
	}
}
