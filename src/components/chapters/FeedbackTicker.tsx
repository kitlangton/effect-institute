import { Fragment, useMemo } from "react"
import { feedbackTestimonials } from "./testimonials"

const fadeWidthPx = 48
const scrollDurationSeconds = Math.min(Math.max(feedbackTestimonials.length * 10, 240), 600)

function mulberry32(seed: number) {
	let state = seed >>> 0
	return () => {
		state += 0x6d2b79f5
		let result = Math.imul(state ^ (state >>> 15), state | 1)
		result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
		return ((result ^ (result >>> 14)) >>> 0) / 4294967296
	}
}

function shuffleWithSeed<T>(items: readonly T[], seed: number) {
	const result = [...items]
	const rand = mulberry32(seed)
	for (let index = result.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(rand() * (index + 1))
		;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
	}
	return result
}

function Divider() {
	return (
		<span className="mx-4 inline-flex items-center justify-center align-middle leading-none text-white/45">
			<span className="text-[8px] leading-none">■</span>
		</span>
	)
}

interface TickerTrackProps {
	items: readonly string[]
}

function TickerTrack({ items }: TickerTrackProps) {
	return (
		<div className="flex items-center whitespace-nowrap text-xs text-white/65 font-mono flex-shrink-0">
			{items.map((text, index) => (
				<Fragment key={`${index}-${text.slice(0, 24)}`}>
					<span className="text-white/65">{text}</span>
					<Divider />
				</Fragment>
			))}
		</div>
	)
}

interface FeedbackTickerProps {
	seed: number
}

export function FeedbackTicker({ seed }: FeedbackTickerProps) {
	const randomizedTestimonials = useMemo(() => shuffleWithSeed(feedbackTestimonials, seed), [seed])

	return (
		<section className="relative overflow-hidden w-full" aria-label="Learner feedback ticker">
			<div
				className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none"
				style={{ width: fadeWidthPx }}
			/>
			<div
				className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none"
				style={{ width: fadeWidthPx }}
			/>
			<div className="px-5">
				<div
					className="flex animate-scroll motion-reduce:animate-none will-change-transform"
					style={{ animationDuration: `${scrollDurationSeconds}s` }}
				>
					<TickerTrack items={randomizedTestimonials} />
					<div aria-hidden="true">
						<TickerTrack items={randomizedTestimonials} />
					</div>
				</div>
			</div>
		</section>
	)
}
