import { SpeakerSimpleSlashIcon, WarningIcon } from "@phosphor-icons/react"
import type { SectionData } from "@/atoms/narration"

interface DebugSectionBadgeProps {
	chapter: string
	section: SectionData
}

const formatDuration = (secs: number) => {
	const mins = Math.floor(secs / 60)
	const s = Math.floor(secs % 60)
	return `${mins}:${s.toString().padStart(2, "0")}`
}

export function DebugSectionBadge({ chapter, section }: DebugSectionBadgeProps) {
	const duration = section.wordTimings.length > 0 ? section.wordTimings[section.wordTimings.length - 1].end : 0
	const timingsStatus = section._debug?.timingsStatus
	const isMissingAudio = timingsStatus === "none"
	const timingsMismatched = timingsStatus === "mismatched"

	return (
		<div className="px-8 py-1.5 flex items-center gap-2">
			{duration > 0 && <span className="text-[10px] font-mono text-white/50">{formatDuration(duration)}</span>}

			<button
				type="button"
				onClick={() => {
					const filePath = `content/${chapter}/${section.id}.ts`
					fetch(`/__open-in-editor?file=${encodeURIComponent(filePath)}`)
				}}
				className="px-2 py-0.5 text-[10px] font-mono text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 border border-[var(--border-subtle)] hover:border-white/20 cursor-pointer"
			>
				{section.id}
			</button>

			{isMissingAudio && (
				<div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium text-white/40">
					<SpeakerSimpleSlashIcon size={12} weight="fill" />
					Missing audio
				</div>
			)}

			{timingsMismatched && (
				<div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium text-amber-400">
					<WarningIcon size={12} weight="fill" />
					Timings mismatched
				</div>
			)}
		</div>
	)
}
