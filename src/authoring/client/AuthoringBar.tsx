/**
 * Dev-only recording bar, shown in the bottom bar of the chapter page.
 *
 * Ctrl+R records (again to restart), Enter stops and saves, Esc discards. With debug mode on (Ctrl+D)
 * it also lists earlier takes for the section so one can be reprocessed.
 *
 * @module
 */
import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { MicrophoneIcon } from "@phosphor-icons/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { debugModeAtom } from "@/atoms/debugMode"
import { isEditableTarget } from "@/lib/hotkeys/shouldIgnore"
import { type AuthoringStatus, authoringApi, type Take } from "./api"
import { formatDuration, formatTakeLabel, levelColor, recordingKeyAction } from "./logic"
import { activityAtom, describeOutcome, takesVersionAtom } from "./status"
import { useRecorder } from "./useRecorder"

export interface AuthoringBarProps {
	readonly chapter: string
	readonly sectionId: string
}

export function AuthoringBar({ chapter, sectionId }: AuthoringBarProps) {
	const recorder = useRecorder()
	const activity = useAtomValue(activityAtom)
	const setActivity = useAtomSet(activityAtom)
	const takesVersion = useAtomValue(takesVersionAtom)
	const bumpTakes = useAtomSet(takesVersionAtom)
	const debugMode = useAtomValue(debugModeAtom)
	const [status, setStatus] = useState<AuthoringStatus | null>(null)
	const [takes, setTakes] = useState<Take[]>([])
	const [selectedTake, setSelectedTake] = useState("")
	const pendingSave = useRef(false)

	useEffect(() => {
		void authoringApi.status().then(setStatus)
	}, [])

	useEffect(() => {
		let ignore = false
		void authoringApi.takes(chapter, sectionId).then((list) => {
			if (ignore) return
			setTakes(list)
			setSelectedTake(list[0]?.id ?? "")
		})
		return () => {
			ignore = true
		}
	}, [chapter, sectionId, takesVersion])

	// Clear a finished message after a while; keep failures up longer.
	useEffect(() => {
		if (activity.type !== "done" && activity.type !== "failed") return
		const timer = setTimeout(() => setActivity({ type: "idle" }), activity.type === "done" ? 8000 : 15000)
		return () => clearTimeout(timer)
	}, [activity, setActivity])

	const busy = activity.type === "busy"

	const save = useCallback(
		async (audio: Blob) => {
			setActivity({ type: "busy", label: "Processing take" })
			const outcome = await authoringApi.record(chapter, sectionId, audio)
			setActivity(describeOutcome(outcome))
			bumpTakes((v) => v + 1)
			recorder.discardRecording()
		},
		[chapter, sectionId, setActivity, bumpTakes, recorder.discardRecording],
	)

	// Enter stops the recorder; the blob arrives a moment later, then it is uploaded.
	useEffect(() => {
		if (pendingSave.current && recorder.state === "recorded" && recorder.audioBlob) {
			pendingSave.current = false
			void save(recorder.audioBlob)
		}
	}, [recorder.state, recorder.audioBlob, save])

	const onKeyDown = useRef<(event: KeyboardEvent) => void>(() => {})
	onKeyDown.current = (event) => {
		const action = recordingKeyAction(event, recorder.state === "recording", isEditableTarget(event.target))
		if (!action || (busy && action === "start")) return
		event.preventDefault()
		event.stopPropagation()
		if (action === "start") void recorder.startRecording()
		else if (action === "stop") {
			pendingSave.current = true
			recorder.stopRecording()
		} else recorder.discardRecording()
	}
	useEffect(() => {
		const listener = (event: KeyboardEvent) => onKeyDown.current(event)
		window.addEventListener("keydown", listener, { capture: true })
		return () => window.removeEventListener("keydown", listener, { capture: true })
	}, [])

	// Changing section abandons an unsaved take.
	useEffect(() => {
		pendingSave.current = false
		recorder.discardRecording()
	}, [chapter, sectionId, recorder.discardRecording])

	const reprocessTake = async () => {
		if (!selectedTake) return
		setActivity({ type: "busy", label: "Reprocessing take" })
		setActivity(describeOutcome(await authoringApi.reprocessTake(chapter, sectionId, selectedTake)))
		bumpTakes((v) => v + 1)
	}

	return (
		<div className="mr-auto flex h-full min-w-0 items-center gap-3 px-4 text-xs text-white/50">
			{recorder.state === "recording" ? (
				<>
					<span className="flex items-center gap-1.5">
						<span className="relative flex h-2 w-2">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
							<span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
						</span>
						<span className="uppercase tracking-wide text-white/70">Rec</span>
					</span>
					{recorder.devices.length > 1 && (
						<select
							value={recorder.deviceId ?? ""}
							onChange={(e) => recorder.setDeviceId(e.target.value)}
							className="max-w-32 truncate border-none bg-transparent text-white/50 hover:text-white/70 focus:outline-none"
							title="Microphone (applies to the next take)"
						>
							{recorder.devices.map((d) => (
								<option key={d.deviceId} value={d.deviceId} className="bg-black">
									{d.label}
								</option>
							))}
						</select>
					)}
					<span className="relative h-1 w-16 overflow-hidden rounded-full bg-white/10">
						<span
							className={`block h-full transition-all duration-75 ${levelColor(recorder.levelDb)}`}
							style={{ width: `${Math.min(100, recorder.level * 100)}%` }}
						/>
					</span>
					<span className="font-mono tabular-nums">{formatDuration(recorder.duration)}</span>
					<span className="text-[10px] uppercase tracking-wide text-white/30">Enter save · Esc cancel</span>
				</>
			) : busy ? (
				<span className="flex items-center gap-1.5">
					<span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-white/30 border-t-white" />
					<span className="uppercase tracking-wide text-white/70">{activity.label}</span>
				</span>
			) : activity.type === "done" ? (
				<span className="truncate" title={activity.notice ?? activity.message}>
					<span className="uppercase tracking-wide text-emerald-400">✓ {activity.message}</span>
					{activity.notice && <span className="ml-2 text-amber-300/80">{activity.notice}</span>}
				</span>
			) : activity.type === "failed" ? (
				<span className="truncate text-red-400" title={activity.message}>
					{activity.message}
				</span>
			) : (
				<span className="flex items-center gap-1.5 text-white/35" title={`Record ${chapter}/${sectionId}`}>
					<MicrophoneIcon size={12} />
					<span className="uppercase tracking-wide">Ctrl+R record</span>
					{status && !status.ffmpeg && <span className="text-red-400">ffmpeg not found</span>}
					{status?.ffmpeg && !status.elevenLabsKey && (
						<span className="normal-case">· no ElevenLabs key: timings will be estimated</span>
					)}
				</span>
			)}

			{recorder.error && <span className="truncate text-red-400">{recorder.error}</span>}

			{debugMode && recorder.state !== "recording" && (
				<span className="flex items-center gap-2">
					<span className="uppercase tracking-wide text-white/35">Takes</span>
					<select
						value={selectedTake}
						onChange={(e) => setSelectedTake(e.target.value)}
						disabled={takes.length === 0 || busy}
						className="rounded-md border border-white/15 bg-transparent px-2 py-0.5 text-white/80"
					>
						{takes.length === 0 && <option value="">None</option>}
						{takes.map((take) => (
							<option key={take.id} value={take.id} className="bg-black">
								{formatTakeLabel(take.createdAt)}
							</option>
						))}
					</select>
					<button
						type="button"
						onClick={reprocessTake}
						disabled={!selectedTake || busy}
						className="uppercase tracking-wide text-white/70 hover:text-white disabled:opacity-40"
					>
						Use
					</button>
				</span>
			)}
		</div>
	)
}
