import { useAtomSet } from "@effect/atom-react"
import { outlineModeAtom } from "@/atoms/outline"
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget"
import { useClickSound } from "@/hooks/useClickSound"
import { NAV_BAR_HEIGHT } from "../constants"
import { BackButton } from "./BackButton"
import { HeaderMenu } from "./HeaderMenu"

interface ChapterTitleBarProps {
	title: string
	chapterId: string
	activeSectionId?: string | undefined
	feedbackOpen?: boolean
	onFeedbackOpenChange?: (open: boolean) => void
	feedbackSectionId?: string | null
}

export function ChapterTitleBar({
	title,
	chapterId,
	activeSectionId,
	feedbackOpen,
	onFeedbackOpenChange,
	feedbackSectionId,
}: ChapterTitleBarProps) {
	const setOutlineMode = useAtomSet(outlineModeAtom)
	const playClick = useClickSound()

	return (
		<div
			className="absolute top-0 left-0 right-0 z-40 text-sm font-bold tracking-wide text-white/60 uppercase bg-black border-b border-[var(--border-subtle)] grid grid-cols-[auto_1fr_auto] items-center"
			style={{ height: NAV_BAR_HEIGHT }}
		>
			<div className="flex items-center h-full">
				<BackButton />
			</div>
			<button
				type="button"
				className="flex items-center justify-center h-full cursor-default hover:text-white/80 uppercase gap-2"
				onClick={() => {
					playClick()
					setOutlineMode((prev) => !prev)
				}}
			>
				<span>{title}</span>
			</button>
			<div className="flex items-center h-full justify-end">
				<HeaderMenu openFeedback={() => onFeedbackOpenChange?.(true)} />
				{onFeedbackOpenChange && (
					<FeedbackWidget
						sectionId={feedbackSectionId ?? activeSectionId ?? "unknown"}
						chapterId={chapterId}
						variant="header"
						isOpen={feedbackOpen ?? false}
						onOpenChange={onFeedbackOpenChange}
						renderTrigger={() => null}
					/>
				)}
			</div>
		</div>
	)
}
