import { useAtomSet } from "@effect/atom-react"
import { HouseIcon } from "@phosphor-icons/react"
import { useParams } from "@tanstack/react-router"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { lastChapterAtom } from "@/atoms/narration"
import { PulsingDotGrid } from "@/components/chapters/backgrounds/PulsingDotGrid"
import { FooterEffectLink } from "@/components/chapters/FooterEffectLink"
import { NavBarLink } from "@/components/chapters/NavBarLink"
import { NavBarRow } from "@/components/chapters/NavBarRow"
import { FooterLinks } from "@/components/FooterLinks"
import { RotatingBadge } from "@/components/narrated/RotatingBadge"

const APOLOGY_MESSAGES = [
	"I'm so sorry",
	"Please forgive me",
	"I wish I could help",
	"My deepest apologies",
	"This hurts me too",
	"I feel terrible",
	"So sorry about this",
	"Please don't hate me",
	"I'm doing my best",
	"Desktop is nice though",
	"I didn't choose this life",
	"Mobile wasn't ready",
	"I blame the viewport",
	"The pixels betrayed us",
	"Screens should be bigger",
	"My heart is heavy",
	"I carry this burden",
	"Forgiveness is a journey",
	"We all have limits",
	"Today is not our day",
	"The stars misaligned",
	"I weep for us both",
	"Such is my fate",
	"A tragedy unfolds",
	"Woe is me",
]

const TAP_MESSAGES = [
	"You just ruptured my spleen",
	"Ouch! My days are numbered",
	"That's my only kidney!",
	"I felt that in my soul",
	"Why would you do this",
	"I deserved that",
	"Right in the feelings",
	"My ancestors felt that",
	"I'm already sad enough",
	"Et tu, mobile user?",
	"That was my good side",
	"I'll remember this",
	"The audacity",
	"Pain is temporary... wait no",
	"I trusted you",
]

// Create a shuffled message queue that doesn't repeat until exhausted
function createMessageQueue(messages: string[]) {
	let queue: string[] = []

	return () => {
		if (queue.length === 0) {
			queue = [...messages].sort(() => Math.random() - 0.5)
		}
		return queue.shift()!
	}
}

const SAD_EMOJIS = ["😢", "😔", "😭", "🥺", "😞", "😰", "🙁"]

function FloatingSadCharacter() {
	const [message, setMessage] = useState<string | null>(null)
	const [emoji, setEmoji] = useState(SAD_EMOJIS[0])
	const [visible, setVisible] = useState(false)
	const [isReacting, setIsReacting] = useState(false) // true during tap reaction
	const [tapCount, setTapCount] = useState(0)
	const [isDead, setIsDead] = useState(false)

	// Message queues that cycle through all messages before repeating
	const getApologyMessage = useRef(createMessageQueue(APOLOGY_MESSAGES)).current
	const getTapMessage = useRef(createMessageQueue(TAP_MESSAGES)).current

	// Fade in after a short delay
	useEffect(() => {
		const timeout = setTimeout(() => setVisible(true), 1500)
		return () => clearTimeout(timeout)
	}, [])

	// Automated message cycle - only runs when idle (not reacting, not dead)
	useEffect(() => {
		if (!visible || isReacting || isDead) return

		let cancelled = false
		const timeouts: NodeJS.Timeout[] = []

		const scheduleMessage = (delay: number) => {
			const t = setTimeout(() => {
				if (cancelled) return

				// Show message (cycles through all before repeating)
				setMessage(getApologyMessage())

				// Hide message after 2.5s
				const t2 = setTimeout(() => {
					if (cancelled) return
					setMessage(null)

					// Change emoji 0.5s after message fades
					const t3 = setTimeout(() => {
						if (cancelled) return
						setEmoji(SAD_EMOJIS[Math.floor(Math.random() * SAD_EMOJIS.length)])

						// Schedule next message 4s after emoji change
						scheduleMessage(4000)
					}, 500)
					timeouts.push(t3)
				}, 2500)
				timeouts.push(t2)
			}, delay)
			timeouts.push(t)
		}

		// First message after 3s
		scheduleMessage(3000)

		return () => {
			cancelled = true
			timeouts.forEach(clearTimeout)
		}
	}, [visible, isReacting, isDead])

	const handleTap = () => {
		if (isDead || isReacting) return // Ignore taps while reacting

		const newTapCount = tapCount + 1
		setTapCount(newTapCount)
		setIsReacting(true)
		setMessage(null) // Clear any existing message immediately

		// Death after 5 taps
		if (newTapCount >= 5) {
			setIsDead(true)
			setEmoji("💀")
			// Brief delay then show death message
			setTimeout(() => setMessage("You monster..."), 100)
			// Clear message after 2s (character will float away)
			setTimeout(() => setMessage(null), 2100)
			return
		}

		// Normal tap reaction
		const tapEmojis = ["😂", "😱", "🤣", "😵"]
		setEmoji(tapEmojis[Math.floor(Math.random() * tapEmojis.length)])
		// Brief delay then show tap message (cycles through all before repeating)
		setTimeout(() => {
			setMessage(getTapMessage())
		}, 100)

		// Return to idle state after reaction completes
		setTimeout(() => {
			setMessage(null)
			setTimeout(() => {
				setEmoji(SAD_EMOJIS[Math.floor(Math.random() * SAD_EMOJIS.length)])
				setIsReacting(false)
			}, 500)
		}, 2000)
	}

	return (
		<div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
			<AnimatePresence>
				{visible && (
					<motion.div
						className="absolute pointer-events-none"
						style={{ fontSize: 28 }}
						initial={{
							opacity: 0,
							scale: 0.5,
							filter: "blur(8px)",
							x: "20vw",
							y: "15vh",
						}}
						animate={
							isDead
								? {
										opacity: [1, 1, 0],
										scale: 1,
										filter: "blur(0px)",
										x: "120vw",
										y: "150vh",
										rotate: 720,
									}
								: {
										opacity: 1,
										scale: 1,
										filter: "blur(0px)",
										x: ["20vw", "70vw", "15vw", "75vw", "25vw", "65vw", "20vw"],
										y: ["15vh", "60vh", "75vh", "25vh", "50vh", "80vh", "15vh"],
										rotate: [0, 8, -5, 10, -8, 5, 0],
									}
						}
						transition={
							isDead
								? {
										opacity: { duration: 4, times: [0, 0.7, 1] },
										y: { duration: 4, ease: "easeIn" },
										x: { duration: 4, ease: "easeIn" },
										rotate: { duration: 4, ease: "linear" },
									}
								: {
										opacity: {
											type: "spring",
											visualDuration: 0.5,
											bounce: 0.3,
										},
										scale: { type: "spring", visualDuration: 0.5, bounce: 0.3 },
										filter: {
											type: "spring",
											visualDuration: 0.5,
											bounce: 0,
										},
										x: { duration: 60, repeat: Infinity, ease: "easeInOut" },
										y: { duration: 55, repeat: Infinity, ease: "easeInOut" },
										rotate: {
											duration: 50,
											repeat: Infinity,
											ease: "easeInOut",
										},
									}
						}
					>
						<div className="relative">
							{/* Emoji with expression changes - tappable */}
							<motion.button
								type="button"
								key={emoji}
								className="block pointer-events-auto cursor-pointer"
								onClick={handleTap}
								initial={{ scale: 0.8 }}
								animate={{ scale: 1 }}
								whileTap={{ scale: 0.8 }}
								transition={{
									type: "spring",
									visualDuration: 0.3,
									bounce: 0.4,
								}}
							>
								{emoji}
							</motion.button>

							{/* Speech bubble */}
							<AnimatePresence>
								{message && (
									<motion.div
										initial={{ opacity: 0, scale: 0.5, filter: "blur(8px)" }}
										animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
										exit={{ opacity: 0, scale: 0.5, filter: "blur(8px)" }}
										transition={{
											type: "spring",
											visualDuration: 0.5,
											bounce: 0.3,
											filter: { bounce: 0 },
										}}
										className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap bg-[var(--border-subtle)] px-2 py-1 rounded-lg text-[10px] text-white/40 border border-solid border-[var(--border-active)]"
									>
										{message}
										<div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[var(--border-active)]" />
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

export function MobileLayout() {
	const { chapter } = useParams({ strict: false })
	const setLastChapter = useAtomSet(lastChapterAtom)
	return (
		<div className="h-dvh bg-black flex flex-col overflow-hidden relative">
			{/* Floating sad character - over everything */}
			<FloatingSadCharacter />

			{/* Sticky nav bar */}
			<NavBarRow className="border-b border-[var(--border-subtle)] z-20">
				<NavBarLink to="/" onClick={() => setLastChapter(chapter ?? null)} className="gap-2">
					<HouseIcon size={14} weight="fill" />
					<span>Home</span>
				</NavBarLink>
			</NavBarRow>

			{/* Scrollable main content */}
			<div className="flex-1 min-h-0 overflow-auto relative">
				<div className="min-h-full flex flex-col items-center justify-center px-8 py-12 text-center">
					{/* Tappable dot grid */}
					<PulsingDotGrid className="opacity-70" baseOpacity={0.1} />

					{/* Logo with radial gradient to hide dots behind it */}
					<div className="relative w-[200px] h-[200px] flex items-center justify-center mb-8 flex-shrink-0 z-20 overflow-visible">
						{/* Radial gradient to fade out dots behind logo */}
						<div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible">
							<div className="w-[320px] h-[320px] rounded-full bg-[radial-gradient(circle,rgba(0,0,0,1)_0%,rgba(0,0,0,1)_30%,rgba(0,0,0,0.8)_50%,rgba(0,0,0,0.4)_65%,rgba(0,0,0,0)_100%)]" />
						</div>

						<RotatingBadge activeWord={-1} flowingGlow />
					</div>

					<p className="text-[var(--color-text)]/60 text-sm leading-relaxed max-w-[280px] relative z-10">
						This interactive course is designed for desktop.
					</p>

					<p className="text-[var(--color-text)]/40 text-xs mt-4 relative z-10">Please visit on a larger screen.</p>
				</div>
			</div>

			{/* Sticky footer */}
			<NavBarRow className="border-t border-[var(--border-subtle)] z-20">
				<FooterEffectLink />
				<div className="flex items-center h-full">
					<FooterLinks />
				</div>
			</NavBarRow>
		</div>
	)
}
