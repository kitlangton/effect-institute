import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMeasure } from "@/hooks/useMeasure"

const landingAdjectivesA = [
	"Strange",
	"Free",
	"Electric",
	"All-consuming",
	"Uncanny",
	"Lynchian",
	"Idiosyncratic",
] as const
const landingAdjectivesB = [
	"semi-interactive",
	"audio-visual",
	"cinematic",
	"nightmarish",
	"eldritch",
	"lugubrious",
	"sagacious",
	"pedantic",
	"titillating",
	"callipygian",
	"ASMR-adjacent",
	"hermetically-sealed",
] as const
const adjectiveIntervalMs = 5000
const adjectiveOffsetMs = 2500
const adjectiveStartA = ["Strange", "Free"] as const
const adjectiveStartB = ["semi-interactive", "audio-visual"] as const
const lowerCaseExceptions = new Set(["ASMR-adjacent"])
const morphSpring = { type: "spring" as const, visualDuration: 0.5, bounce: 0.0 }
const letterStagger = 0.01
const EMPTY_STRINGS: readonly string[] = []

interface RotatingAdjectiveProps {
	adjectives: readonly string[]
	intervalMs?: number
	offsetMs?: number
	fixedStart?: readonly string[]
	avoidWords?: readonly string[]
	onChange?: (word: string) => void
	formatWord?: (word: string) => string
}

function RotatingAdjective({
	adjectives,
	intervalMs = adjectiveIntervalMs,
	offsetMs = 0,
	fixedStart = EMPTY_STRINGS,
	avoidWords = EMPTY_STRINGS,
	onChange,
	formatWord,
}: RotatingAdjectiveProps) {
	const format = useCallback((word: string) => (formatWord ? formatWord(word) : word), [formatWord])
	const buildOrder = useCallback((list: readonly string[], start: readonly string[]) => {
		const unique = Array.from(new Set(list))
		const startItems = start.filter((word) => unique.includes(word))
		const remaining = unique.filter((word) => !startItems.includes(word))
		return { startItems, remaining }
	}, [])
	const shuffle = useCallback((items: readonly string[]) => {
		const copy = [...items]
		for (let i = copy.length - 1; i > 0; i -= 1) {
			const j = Math.floor(Math.random() * (i + 1))
			;[copy[i], copy[j]] = [copy[j], copy[i]]
		}
		return copy
	}, [])

	const { startItems, remaining } = useMemo(
		() => buildOrder(adjectives, fixedStart),
		[adjectives, fixedStart, buildOrder],
	)
	const normalize = useCallback((word: string) => format(word).trim().toLowerCase(), [format])
	const avoidSet = useMemo(() => new Set(avoidWords.map(normalize)), [avoidWords, normalize])
	const avoidSetRef = useRef(avoidSet)
	useEffect(() => {
		avoidSetRef.current = avoidSet
	}, [avoidSet])
	const findNextIndex = useCallback(
		(fromIndex: number, currentOrder: string[]) => {
			for (let i = fromIndex + 1; i < currentOrder.length; i += 1) {
				if (!avoidSetRef.current.has(normalize(currentOrder[i]))) return i
			}
			return -1
		},
		[normalize],
	)
	const [order, setOrder] = useState<string[]>(() => [...startItems, ...remaining])
	const orderRef = useRef(order)
	const [index, setIndex] = useState(0)
	const [measureRef, { width: contentWidth }] = useMeasure<HTMLSpanElement>()
	const [enableMotion, setEnableMotion] = useState(false)
	const [allowWidthAnimation, setAllowWidthAnimation] = useState(false)

	useEffect(() => {
		if (!enableMotion && contentWidth > 0) {
			const frameId = window.requestAnimationFrame(() => setEnableMotion(true))
			return () => window.cancelAnimationFrame(frameId)
		}
	}, [contentWidth, enableMotion])

	useEffect(() => {
		if (!enableMotion || allowWidthAnimation) return
		const timeoutId = window.setTimeout(() => setAllowWidthAnimation(true), 60)
		return () => window.clearTimeout(timeoutId)
	}, [enableMotion, allowWidthAnimation])

	useEffect(() => {
		if (startItems.length + remaining.length === 0) return
		const shuffled = shuffle(remaining)
		const nextOrder = [...startItems, ...shuffled]
		orderRef.current = nextOrder
		setOrder(nextOrder)
		setIndex(0)
	}, [startItems, remaining, shuffle])

	useEffect(() => {
		orderRef.current = order
	}, [order])

	useEffect(() => {
		if (startItems.length + remaining.length === 0) return
		let intervalId: number | null = null
		let timeoutId: number | null = null

		const start = () => {
			intervalId = window.setInterval(() => {
				setIndex((current) => {
					const currentOrder = orderRef.current
					if (currentOrder.length === 0) return current
					const next = findNextIndex(current, currentOrder)
					if (next >= 0) return next

					const allowed = remaining.filter((word) => !avoidSetRef.current.has(normalize(word)))
					const blocked = remaining.filter((word) => avoidSetRef.current.has(normalize(word)))
					const reshuffled = [...startItems, ...shuffle(allowed), ...shuffle(blocked)]
					orderRef.current = reshuffled
					setOrder(reshuffled)
					return 0
				})
			}, intervalMs)
		}

		if (offsetMs > 0) {
			timeoutId = window.setTimeout(start, offsetMs)
		} else {
			start()
		}

		return () => {
			if (intervalId !== null) window.clearInterval(intervalId)
			if (timeoutId !== null) window.clearTimeout(timeoutId)
		}
	}, [intervalMs, offsetMs, remaining, shuffle, startItems, findNextIndex, normalize])

	const adjective = order[index] ?? ""
	const displayWord = format(adjective)

	useEffect(() => {
		if (order.length === 0) return
		if (!avoidSetRef.current.has(normalize(adjective))) return
		setIndex((current) => {
			const currentOrder = orderRef.current
			if (currentOrder.length === 0) return current
			const next = findNextIndex(current, currentOrder)
			if (next >= 0) return next
			const allowed = remaining.filter((word) => !avoidSetRef.current.has(normalize(word)))
			const blocked = remaining.filter((word) => avoidSetRef.current.has(normalize(word)))
			const reshuffled = [...startItems, ...shuffle(allowed), ...shuffle(blocked)]
			orderRef.current = reshuffled
			setOrder(reshuffled)
			return 0
		})
	}, [adjective, avoidWords, findNextIndex, normalize, order.length, remaining, shuffle, startItems])

	useEffect(() => {
		onChange?.(displayWord)
	}, [displayWord, onChange])

	if (!enableMotion) {
		return (
			<span className="relative align-baseline whitespace-pre">
				<span ref={measureRef} className="absolute opacity-0 pointer-events-none whitespace-pre">
					{displayWord}
				</span>
				<span className="inline-grid align-baseline" style={{ gridTemplateAreas: '"text"', justifyItems: "start" }}>
					<span className="whitespace-pre" style={{ gridArea: "text" }}>
						{displayWord}
					</span>
				</span>
			</span>
		)
	}

	return (
		<span className="relative align-baseline whitespace-pre">
			<span ref={measureRef} className="absolute opacity-0 pointer-events-none whitespace-pre">
				{displayWord}
			</span>
			<motion.span
				className="inline-grid align-baseline overflow-hidden"
				animate={{ width: contentWidth }}
				transition={allowWidthAnimation ? morphSpring : { duration: 0 }}
				initial={false}
				style={{ gridTemplateAreas: '"text"', justifyItems: "start" }}
			>
				<AnimatePresence mode="popLayout" initial={false}>
					<motion.span
						key={displayWord}
						className="whitespace-pre"
						style={{
							gridArea: "text",
							willChange: "filter",
							backfaceVisibility: "hidden",
							WebkitFontSmoothing: "antialiased",
						}}
					>
						{displayWord.split("").map((letter, index) => (
							<motion.span
								key={`${displayWord}-${index}-${letter}`}
								initial={{ opacity: 0, filter: "blur(2px)" }}
								animate={{
									opacity: 1,
									filter: "blur(0px)",
									transition: {
										...morphSpring,
										delay: index * letterStagger,
									},
								}}
								exit={{
									opacity: 0,
									filter: "blur(2px)",
									transition: {
										...morphSpring,
									},
								}}
								transition={morphSpring}
								className="inline-block"
							>
								{letter === " " ? "\u00A0" : letter}
							</motion.span>
						))}
					</motion.span>
				</AnimatePresence>
			</motion.span>
		</span>
	)
}

export function RotatingAdjectivePair() {
	const [currentA, setCurrentA] = useState("")
	const [previousA, setPreviousA] = useState("")
	const [currentB, setCurrentB] = useState("")
	const [previousB, setPreviousB] = useState("")
	const currentARef = useRef(currentA)
	const currentBRef = useRef(currentB)

	const handleChangeA = useCallback((word: string) => {
		const prev = currentARef.current
		currentARef.current = word
		setPreviousA(prev)
		setCurrentA(word)
	}, [])
	const handleChangeB = useCallback((word: string) => {
		const prev = currentBRef.current
		currentBRef.current = word
		setPreviousB(prev)
		setCurrentB(word)
	}, [])
	const avoidForA = useMemo(() => [currentB, previousB].filter((word) => word.length > 0), [currentB, previousB])
	const avoidForB = useMemo(() => [currentA, previousA].filter((word) => word.length > 0), [currentA, previousA])
	const formatB = useCallback((word: string) => {
		if (lowerCaseExceptions.has(word)) return word
		return word.toLowerCase()
	}, [])

	return (
		<>
			<RotatingAdjective
				adjectives={landingAdjectivesA}
				fixedStart={adjectiveStartA}
				intervalMs={adjectiveIntervalMs}
				avoidWords={avoidForA}
				onChange={handleChangeA}
			/>
			{", "}
			<RotatingAdjective
				adjectives={landingAdjectivesB}
				fixedStart={adjectiveStartB}
				intervalMs={adjectiveIntervalMs}
				offsetMs={adjectiveOffsetMs}
				avoidWords={avoidForB}
				onChange={handleChangeB}
				formatWord={formatB}
			/>
		</>
	)
}
