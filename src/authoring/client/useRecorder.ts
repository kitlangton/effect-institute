/**
 * Microphone recording with MediaRecorder, plus a live level meter.
 *
 * The microphone is only requested when a take starts, never on page load.
 *
 * @module
 */
import { useCallback, useEffect, useRef, useState } from "react"

export type RecorderState = "idle" | "recording" | "recorded"

export interface AudioDevice {
	readonly deviceId: string
	readonly label: string
}

const DEVICE_KEY = "effect-institute:recorder-device-id"

// Raw input: the processing chain does its own clean-up, and browser DSP colours the voice.
const RAW_AUDIO: MediaTrackConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false }

const pickMimeType = () =>
	["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type)) ?? ""

export function useRecorder() {
	const [state, setState] = useState<RecorderState>("idle")
	const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
	const [duration, setDuration] = useState(0)
	const [error, setError] = useState<string | null>(null)
	const [devices, setDevices] = useState<AudioDevice[]>([])
	const [level, setLevel] = useState(0)
	const [levelDb, setLevelDb] = useState(Number.NEGATIVE_INFINITY)
	const [deviceId, setDeviceIdState] = useState<string | null>(() =>
		typeof localStorage === "undefined" ? null : localStorage.getItem(DEVICE_KEY),
	)

	const recorderRef = useRef<MediaRecorder | null>(null)
	const chunksRef = useRef<Blob[]>([])
	const discardRef = useRef(false)
	const meterRef = useRef<{ context: AudioContext; frame: number } | null>(null)

	const setDeviceId = useCallback((id: string) => {
		setDeviceIdState(id)
		localStorage.setItem(DEVICE_KEY, id)
	}, [])

	const refreshDevices = useCallback(async () => {
		const inputs = (await navigator.mediaDevices.enumerateDevices())
			.filter((d) => d.kind === "audioinput")
			.map((d) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}` }))
		setDevices(inputs)
	}, [])

	useEffect(() => {
		const handler = () => void refreshDevices()
		navigator.mediaDevices?.addEventListener("devicechange", handler)
		return () => navigator.mediaDevices?.removeEventListener("devicechange", handler)
	}, [refreshDevices])

	const stopMeter = useCallback(() => {
		if (!meterRef.current) return
		cancelAnimationFrame(meterRef.current.frame)
		void meterRef.current.context.close()
		meterRef.current = null
		setLevel(0)
		setLevelDb(Number.NEGATIVE_INFINITY)
	}, [])

	const startMeter = useCallback((stream: MediaStream, startedAt: number) => {
		const context = new AudioContext()
		const analyser = context.createAnalyser()
		analyser.fftSize = 256
		analyser.smoothingTimeConstant = 0.5
		context.createMediaStreamSource(stream).connect(analyser)
		const samples = new Float32Array(analyser.fftSize)
		const tick = () => {
			analyser.getFloatTimeDomainData(samples)
			let sum = 0
			for (const v of samples) sum += v * v
			const rms = Math.sqrt(sum / samples.length)
			setLevel(Math.min(1, rms * 4))
			setLevelDb(20 * Math.log10(Math.max(rms, 1e-8)))
			setDuration((Date.now() - startedAt) / 1000)
			if (meterRef.current) meterRef.current.frame = requestAnimationFrame(tick)
		}
		meterRef.current = { context, frame: requestAnimationFrame(tick) }
	}, [])

	const releaseRecorder = useCallback(() => {
		const recorder = recorderRef.current
		recorderRef.current = null
		if (!recorder) return
		discardRef.current = true
		if (recorder.state === "recording") recorder.stop()
		for (const track of recorder.stream.getTracks()) track.stop()
	}, [])

	const startRecording = useCallback(async () => {
		releaseRecorder()
		stopMeter()
		setError(null)
		setAudioBlob(null)
		setDuration(0)
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: deviceId ? { ...RAW_AUDIO, deviceId: { exact: deviceId } } : RAW_AUDIO,
			})
			void refreshDevices()
			const mimeType = pickMimeType()
			const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
			const startedAt = Date.now()
			chunksRef.current = []
			discardRef.current = false
			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) chunksRef.current.push(e.data)
			}
			recorder.onstop = () => {
				for (const track of stream.getTracks()) track.stop()
				stopMeter()
				if (discardRef.current) return
				setAudioBlob(new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" }))
				setDuration((Date.now() - startedAt) / 1000)
				setState("recorded")
			}
			recorderRef.current = recorder
			startMeter(stream, startedAt)
			recorder.start(100)
			setState("recording")
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not access the microphone")
			setState("idle")
		}
	}, [deviceId, refreshDevices, releaseRecorder, startMeter, stopMeter])

	const stopRecording = useCallback(() => {
		if (recorderRef.current?.state === "recording") recorderRef.current.stop()
		recorderRef.current = null
	}, [])

	const discardRecording = useCallback(() => {
		releaseRecorder()
		stopMeter()
		setAudioBlob(null)
		setDuration(0)
		setState("idle")
	}, [releaseRecorder, stopMeter])

	useEffect(() => () => discardRecording(), [discardRecording])

	return {
		state,
		audioBlob,
		duration,
		error,
		devices,
		deviceId,
		level,
		levelDb,
		setDeviceId,
		startRecording,
		stopRecording,
		discardRecording,
	}
}
