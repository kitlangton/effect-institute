import { useAtom } from "@effect/atom-react"
import { useEffect, useState } from "react"
import { lastChapterAtom } from "@/atoms/narration"
import { loadAllProgress } from "@/atoms/progress"
import { fetchChapterManifestMap, fetchCourseManifest } from "@/lib/content/delivery"
import type { ChapterMetadata } from "@/lib/tooling/types"
import { type ChapterProgress, type ContinueTarget, computeChapterProgress } from "./ChapterList"

export function useHomeChapters(onRestoreSelection: (index: number) => void) {
	const [lastChapter, setLastChapter] = useAtom(lastChapterAtom)
	const [chapters, setChapters] = useState<ChapterMetadata[]>([])
	const [chapterProgress, setChapterProgress] = useState<Map<string, ChapterProgress>>(new Map())
	const [continueTarget, setContinueTarget] = useState<ContinueTarget | null>(null)
	const [progressLoading, setProgressLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false

		async function loadChapters() {
			try {
				const manifest = await fetchCourseManifest()
				const sorted = [...manifest.chapters].sort((a, b) => a.order - b.order)
				const filtered = import.meta.env.DEV ? sorted : sorted.filter((c) => !c.draft)
				if (cancelled) return
				setChapters(filtered)
				if (lastChapter) {
					const idx = filtered.findIndex((c) => c.id === lastChapter)
					if (idx >= 0) onRestoreSelection(idx)
					setLastChapter(null)
				}
			} catch (err) {
				if (!cancelled) setError(String(err))
			}
		}

		loadChapters()
		return () => {
			cancelled = true
		}
	}, [lastChapter, setLastChapter, onRestoreSelection])

	useEffect(() => {
		if (chapters.length === 0) return

		let cancelled = false
		setProgressLoading(true)

		async function loadProgress() {
			try {
				const completedByChapter = await loadAllProgress()
				const manifestByChapter = await fetchChapterManifestMap(chapters)
				const computed = computeChapterProgress(chapters, completedByChapter, manifestByChapter)
				if (!cancelled) {
					setChapterProgress(computed.progressMap)
					setContinueTarget(computed.continueTarget)
					setProgressLoading(false)
				}
			} catch (err) {
				if (!cancelled) {
					setError(String(err))
					setProgressLoading(false)
				}
			}
		}

		loadProgress()
		return () => {
			cancelled = true
		}
	}, [chapters])

	return {
		chapters,
		chapterProgress,
		continueTarget,
		progressLoading,
		error,
	}
}
