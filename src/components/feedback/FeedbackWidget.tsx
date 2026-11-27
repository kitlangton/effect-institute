import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { ArrowSquareOutIcon, ChatCenteredDotsIcon, XIcon } from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { feedbackModalOpenAtom } from "@/atoms/globalState"
import { chapterAtom } from "@/atoms/narration"
import { useHotkeys } from "@/hooks/useHotkeys"

export type FeedbackSentiment = "up" | "meh" | "down"

const GITHUB_NEW_ISSUE_URL = "https://github.com/kitlangton/effect-institute/issues/new"
const NOTES_MAX = 2000

type FeedbackWidgetProps = {
	sectionId: string
	chapterId: string
	variant?: "section" | "header"
	renderTrigger?: (open: () => void) => ReactNode
	isOpen?: boolean
	onOpenChange?: (open: boolean) => void
	registerOpen?: (open: () => void) => void
	className?: string
}

const sentimentOptions: Array<{
	key: FeedbackSentiment
	emoji: string
	label: string
}> = [
	{ key: "up", emoji: "👍", label: "Helpful" },
	{ key: "meh", emoji: "😐", label: "Meh" },
	{ key: "down", emoji: "👎", label: "Confusing" },
]

function buildGitHubIssueUrl(opts: {
	chapterId: string
	sectionId: string
	sentiment: FeedbackSentiment | null
	notes: string
}): string {
	const emoji = opts.sentiment ? sentimentOptions.find((o) => o.key === opts.sentiment)?.emoji : null
	const title = `[Feedback] ${opts.chapterId}/${opts.sectionId}${emoji ? ` ${emoji}` : ""}`
	const lines = [
		opts.notes.trim(),
		"",
		"---",
		`- **Chapter:** \`${opts.chapterId}\``,
		`- **Section:** \`${opts.sectionId}\``,
		...(opts.sentiment ? [`- **Sentiment:** ${opts.sentiment}`] : []),
	]
	const params = new URLSearchParams({
		title,
		body: lines.join("\n").trim(),
	})
	return `${GITHUB_NEW_ISSUE_URL}?${params.toString()}`
}

export function FeedbackWidget({
	sectionId,
	chapterId,
	variant = "section",
	renderTrigger,
	isOpen: controlledIsOpen,
	onOpenChange,
	registerOpen,
	className = "",
}: FeedbackWidgetProps) {
	const portalTarget = typeof document !== "undefined" ? (document.body as HTMLElement) : null
	const currentChapter = useAtomValue(chapterAtom)

	const [sentiment, setSentiment] = useState<FeedbackSentiment | null>(null)
	const [notes, setNotes] = useState("")
	const [internalIsOpen, setInternalIsOpen] = useState(false)
	const modalRef = useRef<HTMLDivElement>(null)

	const isControlled = controlledIsOpen !== undefined
	const isOpen = isControlled ? controlledIsOpen : internalIsOpen
	const setIsOpen = useCallback(
		(open: boolean) => {
			if (isControlled) {
				onOpenChange?.(open)
			} else {
				setInternalIsOpen(open)
			}
		},
		[isControlled, onOpenChange],
	)

	const open = useCallback(() => setIsOpen(true), [setIsOpen])

	useEffect(() => {
		registerOpen?.(open)
	}, [registerOpen, open])

	const setFeedbackModalOpen = useAtomSet(feedbackModalOpenAtom)
	useEffect(() => {
		setFeedbackModalOpen(isOpen)
	}, [isOpen, setFeedbackModalOpen])

	const close = useCallback(() => {
		setIsOpen(false)
	}, [setIsOpen])

	useHotkeys({
		context: "modal",
		enabled: isOpen,
		handlers: {
			"modal.close": () => {
				close()
				return true
			},
		},
	})

	useEffect(() => {
		if (!isOpen) return
		const originalOverflow = document.body.style.overflow
		document.body.style.overflow = "hidden"
		return () => {
			document.body.style.overflow = originalOverflow
		}
	}, [isOpen])

	const canSubmit = notes.trim().length > 0 || sentiment !== null

	const handleSubmit = () => {
		if (!canSubmit) return
		const url = buildGitHubIssueUrl({
			chapterId: chapterId || currentChapter || "unknown",
			sectionId,
			sentiment,
			notes,
		})
		window.open(url, "_blank", "noopener,noreferrer")
		setSentiment(null)
		setNotes("")
		close()
	}

	const trigger = renderTrigger ? (
		renderTrigger(open)
	) : variant === "section" ? (
		<button
			type="button"
			onClick={open}
			className="feedback-pill opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity duration-200 ease-out absolute top-2 right-3 z-10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] bg-white/10 border border-white/15 text-white/80 hover:text-white hover:bg-white/15 hover:border-white/30 shadow-lg backdrop-blur"
		>
			💬 Feedback
		</button>
	) : (
		<button
			type="button"
			onClick={open}
			aria-label="Open feedback"
			className="flex items-center justify-center h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
		>
			<ChatCenteredDotsIcon size={16} weight="bold" />
		</button>
	)

	return (
		<div className={`relative ${className}`}>
			{trigger}

			{portalTarget
				? createPortal(
						<AnimatePresence>
							{isOpen && (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.15 }}
									className="fixed inset-0 z-200 flex items-center justify-center p-4"
								>
									<motion.div
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
										className="absolute inset-0 bg-black/80"
										onClick={close}
									/>

									<motion.div
										ref={modalRef}
										tabIndex={-1}
										initial={{ opacity: 0, scale: 0.96, y: 8 }}
										animate={{ opacity: 1, scale: 1, y: 0 }}
										exit={{ opacity: 0, scale: 0.96, y: 8 }}
										transition={{ duration: 0.15, ease: "easeOut" }}
										onAnimationComplete={() => modalRef.current?.focus()}
										className="relative z-10 w-full max-w-md bg-black border border-[var(--border-subtle)] shadow-2xl outline-none"
										onPointerDownCapture={(e) => e.stopPropagation()}
										onClick={(e) => e.stopPropagation()}
									>
										<div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
											<div className="text-[11px] uppercase tracking-[0.18em] text-white/50">
												Feedback · {sectionId}
											</div>
											<button
												type="button"
												onClick={close}
												className="text-white/40 hover:text-white p-1 hover:bg-white/6"
											>
												<XIcon size={14} weight="bold" />
											</button>
										</div>

										<div className="p-4 space-y-4">
											<div className="space-y-2">
												<div className="text-[11px] uppercase tracking-[0.18em] text-white/50">
													How was this section?
												</div>
												<div className="flex gap-2">
													{sentimentOptions.map((option) => {
														const isActive = sentiment === option.key
														return (
															<button
																key={option.key}
																type="button"
																onClick={() => setSentiment(option.key)}
																className={`group flex-1 flex flex-col items-center gap-1 py-3 border ${
																	isActive
																		? "border-white/40 bg-white/10 text-white"
																		: "border-[var(--border-subtle)] bg-transparent text-white/60 hover:border-white/25 hover:text-white/80"
																}`}
															>
																<span className="text-2xl">{option.emoji}</span>
																<span className="text-[10px] uppercase tracking-wider opacity-70">{option.label}</span>
															</button>
														)
													})}
												</div>
											</div>

											<div className="space-y-2">
												<div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Tell us more</div>
												<textarea
													value={notes}
													onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
													placeholder="What could be improved?"
													rows={4}
													className="w-full resize-y min-h-[100px] bg-white/5 border border-[var(--border-subtle)] focus:border-white/25 focus:outline-none px-3 py-2 text-sm text-white placeholder:text-white/30"
												/>
												{notes.length > NOTES_MAX - 200 && (
													<div className="text-[11px] text-white/40 text-right">
														{notes.length} / {NOTES_MAX}
													</div>
												)}
											</div>
										</div>

										<div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--border-subtle)]">
											<button
												type="button"
												onClick={close}
												className="px-3 py-1.5 text-sm text-white/60 hover:text-white hover:bg-white/6"
											>
												Cancel
											</button>
											<button
												type="button"
												onClick={handleSubmit}
												disabled={!canSubmit}
												className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium ${
													canSubmit
														? "bg-white text-black hover:bg-white/90"
														: "bg-white/10 text-white/40 cursor-not-allowed"
												}`}
											>
												<span>Open on GitHub</span>
												<ArrowSquareOutIcon size={14} weight="bold" />
											</button>
										</div>
									</motion.div>
								</motion.div>
							)}
						</AnimatePresence>,
						portalTarget,
					)
				: null}
		</div>
	)
}
