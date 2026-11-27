import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useHotkeys } from "@/hooks/useHotkeys"
import { OGFrame } from "./-frame"

interface ChapterMeta {
	id: string
	title: string
	description?: string
	order: number
	draft?: boolean
	comingSoon?: boolean
}

const DEFAULTS = {
	title: "Chapter Title",
	description: "Learn about Effect patterns and best practices.",
} as const

type FieldKey = keyof typeof DEFAULTS

function getValue(params: Record<string, unknown>, key: FieldKey): string {
	const value = params[key]
	if (typeof value === "string" && value.length > 0) {
		return value
	}
	return DEFAULTS[key]
}

/** Convert number to Roman numerals */
function toRoman(num: number): string {
	const romanNumerals: [number, string][] = [
		[10, "X"],
		[9, "IX"],
		[5, "V"],
		[4, "IV"],
		[1, "I"],
	]
	let result = ""
	for (const [value, symbol] of romanNumerals) {
		while (num >= value) {
			result += symbol
			num -= value
		}
	}
	return result
}

export const Route = createFileRoute("/og/chapter")({
	component: ChapterOGTemplate,
	validateSearch: (search: Record<string, unknown>) => ({
		title: getValue(search, "title"),
		description: getValue(search, "description"),
		chapter: typeof search.chapter === "string" ? search.chapter : undefined,
	}),
})

function ChapterOGTemplate() {
	const { title: paramTitle, description: paramDescription, chapter: chapterId } = Route.useSearch()
	const navigate = Route.useNavigate()

	const [chapters, setChapters] = useState<ChapterMeta[]>([])
	const [currentIndex, setCurrentIndex] = useState(0)

	useEffect(() => {
		fetch("/content/manifest.json")
			.then((res) => res.json())
			.then((manifest) => {
				const sorted = [...manifest.chapters]
					.filter((c: ChapterMeta) => !c.draft && !c.comingSoon)
					.sort((a: ChapterMeta, b: ChapterMeta) => a.order - b.order)
				setChapters(sorted)

				if (chapterId) {
					const idx = sorted.findIndex((c: ChapterMeta) => c.id === chapterId)
					if (idx !== -1) setCurrentIndex(idx)
				}
			})
			.catch(console.error)
	}, [chapterId])

	useHotkeys({
		context: "og-chapter",
		enabled: chapters.length > 0,
		handlers: {
			"ogChapter.nextChapter": () => {
				if (chapters.length === 0) return false
				const newIndex = (currentIndex + 1) % chapters.length
				setCurrentIndex(newIndex)
				navigate({ search: (prev) => ({ ...prev, chapter: chapters[newIndex].id }) })
				return true
			},
			"ogChapter.prevChapter": () => {
				if (chapters.length === 0) return false
				const newIndex = (currentIndex - 1 + chapters.length) % chapters.length
				setCurrentIndex(newIndex)
				navigate({ search: (prev) => ({ ...prev, chapter: chapters[newIndex].id }) })
				return true
			},
		},
	})

	const currentChapter = chapters[currentIndex]
	const title = currentChapter?.title ?? paramTitle
	const description = currentChapter?.description ?? paramDescription
	const chapterNumber = currentIndex + 1

	return (
		<OGFrame>
			<div>
				<h1 className="text-[56px] font-bold leading-[1.1] tracking-[0.04em] text-white uppercase line-clamp-2">
					{title}
				</h1>
				{description && (
					<p className="mt-5 text-[22px] leading-[1.4] tracking-[0.02em] text-white/60 uppercase line-clamp-2">
						{description}
					</p>
				)}
			</div>
			<div className="flex items-center gap-6 text-[18px] tracking-[0.2em] text-white/40">
				<span>CHAPTER {toRoman(chapterNumber)}</span>
				<span className="flex-1 border-t border-white/20" />
			</div>
		</OGFrame>
	)
}
