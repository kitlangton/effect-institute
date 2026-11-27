import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react"
import { HandEyeIcon } from "@phosphor-icons/react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { isFinishedAtom, pauseAtom, playbackStateAtom } from "@/atoms/audioPlayer"
import { hoverSessionAtom } from "@/atoms/cursor"
import { debugModeAtom } from "@/atoms/debugMode"
import {
	activeSectionAtom,
	chapterAtom,
	completedSectionsFamily,
	lastChapterAtom,
	lastSectionCache,
	lastSectionFamily,
	narrationAtom,
	progressHydratedFamily,
	sectionParamAtom,
	sectionsAtom,
	setActiveIndex,
	setSections,
	updateSections,
} from "@/atoms/narration"
import { loadChapterProgress } from "@/atoms/progress"
import { responsiveSettingsAtom } from "@/atoms/responsiveSettings"
import { volumeAtom } from "@/atoms/volume"
import { ChapterCursor } from "@/components/chapters/cursor/ChapterCursor"
import { CursorTooltipRenderer } from "@/components/chapters/cursor/CursorTooltipRenderer"
import { ChapterTitleBar } from "@/components/chapters/header/ChapterTitleBar"
import { DesktopLayout } from "@/components/chapters/layouts/DesktopLayout"
import { MobileLayout } from "@/components/chapters/layouts/MobileLayout"
import { CompletionEffects } from "@/components/narrated/CompletionEffects"
import { useAudioController } from "@/hooks/useAudioController"
import { useChapterControls } from "@/hooks/useChapterControls"
import { useNarrationHmr } from "@/hooks/useNarrationHmr"
import { usePreloadComponents } from "@/hooks/usePreloadComponents"
import { fetchChapterManifest, fetchChapterSections } from "@/lib/content/delivery"
import type { ChapterManifest, SectionData } from "@/lib/tooling/types"

const CHAPTER_OG_IMAGES = new Set(["intro", "basics"])

export const Route = createFileRoute("/chapters/$chapter")({
	ssr: false,
	loader: async ({ params }): Promise<ChapterManifest | null> => {
		try {
			return await fetchChapterManifest(params.chapter)
		} catch {
			return null
		}
	},
	head: ({ params }) => {
		const chapterId = params.chapter
		const imageUrl = CHAPTER_OG_IMAGES.has(chapterId)
			? `https://www.effect.institute/og/${chapterId}.png`
			: "https://www.effect.institute/og/home.png"

		return {
			meta: [
				{
					property: "og:image",
					content: imageUrl,
				},
				{
					property: "og:image:width",
					content: "1200",
				},
				{
					property: "og:image:height",
					content: "630",
				},
				{
					property: "og:image:alt",
					content: `effect.institute chapter ${chapterId}`,
				},
				{
					name: "twitter:image",
					content: imageUrl,
				},
			],
		}
	},
	component: ChapterPage,
})

// Cache lastSection values at module load time, BEFORE kvs atoms can overwrite them
// (kvs has a bug where it writes default value while async load is pending)
if (typeof window !== "undefined") {
	const prefix = "effect-institute:lastSection:"
	for (const key of Object.keys(localStorage)) {
		if (!key.startsWith(prefix)) continue
		const chapter = key.slice(prefix.length)
		const raw = localStorage.getItem(key)
		if (raw) {
			try {
				const value = JSON.parse(raw) as string
				if (value) {
					lastSectionCache.set(chapter, value)
				}
			} catch {
				// Invalid JSON
			}
		}
	}
}

function ChapterPage() {
	const { chapter } = Route.useParams()
	const preloadedManifest = Route.useLoaderData()
	const navigate = useNavigate()
	const [error, setError] = useState<string | null>(null)
	const [chapterTitle, setChapterTitle] = useState<string>(preloadedManifest?.title ?? "")
	const [debugMode, setDebugMode] = useAtom(debugModeAtom)

	const setLastChapter = useAtomSet(lastChapterAtom)

	// Read responsive settings from atom
	const responsiveSettings = useAtomValue(responsiveSettingsAtom)
	const isMobile = responsiveSettings.breakpoint === "mobile"

	// Atom state
	const setState = useAtomSet(narrationAtom)
	const sections = useAtomValue(sectionsAtom)
	const activeSection = useAtomValue(activeSectionAtom)
	const state = useAtomValue(narrationAtom)
	const playbackState = useAtomValue(playbackStateAtom)
	const isFinished = useAtomValue(isFinishedAtom)
	const currentChapter = useAtomValue(chapterAtom)
	const volume = useAtomValue(volumeAtom)

	// URL param for active section (read-only, used only for initial navigation)
	const sectionParam = useAtomValue(sectionParamAtom)
	// Persisted last section from localStorage (via kvs atom)
	const lastSection = useAtomValue(lastSectionFamily(chapter))

	const { activeIndex } = state

	// Preload components for adjacent sections (±2 sections)
	usePreloadComponents(sections, activeIndex, 2)

	// Controller for playback actions (audio service is singleton)
	const controller = useAudioController()

	// Restart trigger for flashing the restart button
	const [restartTrigger, setRestartTrigger] = useState(0)

	// Scroll hint visibility
	const [showScrollHint, setShowScrollHint] = useState(false)
	const scrollHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const lastSoundPlayedRef = useRef<number>(0)

	const handleScrollAttempt = useCallback(() => {
		if (scrollHintTimeoutRef.current) {
			clearTimeout(scrollHintTimeoutRef.current)
		}
		setShowScrollHint(true)
		// Play the scroll-jacked sound effect (throttled to once per minute)
		const now = Date.now()
		if (now - lastSoundPlayedRef.current > 60_000) {
			lastSoundPlayedRef.current = now
			const audio = new Audio("/sounds/scroll-jacked.webm")
			audio.volume = volume * 0.5
			audio.play().catch(() => {})
		}
		scrollHintTimeoutRef.current = setTimeout(() => {
			setShowScrollHint(false)
		}, 3500)
	}, [volume])

	// Cleanup scroll hint timeout on unmount
	useEffect(() => {
		return () => {
			if (scrollHintTimeoutRef.current) {
				clearTimeout(scrollHintTimeoutRef.current)
			}
		}
	}, [])

	// Dismiss scroll hint when user navigates (arrow keys or click)
	useEffect(() => {
		if (showScrollHint) {
			setShowScrollHint(false)
			if (scrollHintTimeoutRef.current) {
				clearTimeout(scrollHintTimeoutRef.current)
				scrollHintTimeoutRef.current = null
			}
		}
	}, [activeIndex])

	// Progress persistence - use family atoms scoped to this chapter
	const setCompletedSections = useAtomSet(completedSectionsFamily(chapter))
	const setProgressHydrated = useAtomSet(progressHydratedFamily(chapter))

	// Reset hover session on unmount
	const setHoverSession = useAtomSet(hoverSessionAtom)
	useEffect(() => {
		return () => setHoverSession({ type: "inactive" })
	}, [setHoverSession])

	// Pause audio when navigating away
	const pause = useAtomSet(pauseAtom)
	useEffect(() => {
		return () => pause()
	}, [pause])
	useEffect(() => {
		if (isMobile) pause()
	}, [isMobile, pause])

	const [sectionsVersion, setSectionsVersion] = useState(0)
	const refreshSections = useCallback(() => setSectionsVersion((version) => version + 1), [])

	// Load chapter title (only needed in dev mode - prod uses preloaded manifest)
	useEffect(() => {
		if (!import.meta.env.DEV) return
		let ignore = false
		fetchChapterManifest(chapter)
			.then((manifest) => {
				if (!ignore) setChapterTitle(manifest.title || chapter)
			})
			.catch(() => {
				if (!ignore) setChapterTitle(chapter)
			})
		return () => {
			ignore = true
		}
	}, [chapter])

	// Helper to determine start index from URL param (one-time deep link) or persisted atom
	const getStartIndex = (sections: readonly SectionData[]) => {
		// Check for fresh param (used when navigating from previous chapter)
		const url = new URL(window.location.href)
		const isFresh = url.searchParams.has("fresh")
		if (isFresh) {
			// Clear fresh param after using
			url.searchParams.delete("fresh")
			window.history.replaceState({}, "", url.toString())
			return 0
		}

		// Priority: URL deep link (one-time) > persisted lastSection > 0
		if (sectionParam) {
			const idx = sections.findIndex((s) => s.id === sectionParam)
			if (idx >= 0) {
				// Clear URL param after using (one-time deep link)
				url.searchParams.delete("section")
				window.history.replaceState({}, "", url.toString())
				return idx
			}
		}
		// Use cached value from module load (before kvs could overwrite it)
		const cachedSection = lastSectionCache.get(chapter)
		if (cachedSection) {
			const idx = sections.findIndex((s) => s.id === cachedSection)
			if (idx >= 0) {
				return idx
			}
		}
		return 0
	}

	// Load the manifest-selected chapter snapshot. In development, HMR bumps
	// sectionsVersion after rebuilding the authoring artifacts.
	useEffect(() => {
		let ignore = false

		async function loadSections() {
			try {
				const manifest = import.meta.env.DEV
					? await fetchChapterManifest(chapter, { cache: "no-store" })
					: preloadedManifest
				if (!manifest) throw new Error("Manifest not loaded")

				const loadedSections = await fetchChapterSections(chapter, manifest, {
					cache: import.meta.env.DEV ? "no-store" : "default",
				})
				if (ignore) return

				const startIndex = getStartIndex(loadedSections)
				setState((prev) =>
					prev.sections.length === 0 || prev.chapter !== chapter
						? setSections(chapter, loadedSections, startIndex)(prev)
						: updateSections(loadedSections)(prev),
				)
				setError(null)
			} catch (err) {
				if (!ignore) {
					setError(String(err))
				}
			}
		}
		loadSections()
		return () => {
			ignore = true
		}
	}, [chapter, sectionsVersion, setState, preloadedManifest])

	useNarrationHmr({ chapter, refreshSections })

	// Handle late kvs hydration: if lastSection changes after sections are loaded,
	// and we're still at index 0 (haven't navigated), update to the hydrated position
	const initializedChapterRef = useRef<string | null>(null)
	useEffect(() => {
		// Only act if:
		// 1. We have a hydrated lastSection value
		// 2. Sections are loaded
		// 3. We're at the default position (index 0)
		// 4. We haven't already handled this for this chapter
		if (lastSection && sections.length > 0 && activeIndex === 0 && initializedChapterRef.current !== chapter) {
			const idx = sections.findIndex((s) => s.id === lastSection)
			if (idx > 0) {
				setState(setActiveIndex(idx))
				initializedChapterRef.current = chapter
			}
		}
	}, [lastSection, sections, activeIndex, chapter, setState])

	// Load progress from storage when sections are ready
	useEffect(() => {
		if (sections.length === 0 || currentChapter !== chapter) return
		let ignore = false

		loadChapterProgress(chapter)
			.then((sectionIds) => {
				if (ignore) return
				// Convert section IDs to indices
				const indices = new Set<number>()
				for (const sectionId of sectionIds) {
					const idx = sections.findIndex((s) => s.id === sectionId)
					if (idx !== -1) indices.add(idx)
				}
				setCompletedSections(() => indices)
				// Delay hydration flag so RollingGroupHeader syncs refs first
				requestAnimationFrame(() => {
					if (!ignore) setProgressHydrated(() => true)
				})
			})
			.catch((err) => {
				if (ignore) return
				console.error("[Progress] Failed to load:", err)
				// Still mark hydrated so sounds work
				requestAnimationFrame(() => {
					if (!ignore) setProgressHydrated(() => true)
				})
			})

		return () => {
			ignore = true
		}
	}, [chapter, sections, currentChapter, setCompletedSections, setProgressHydrated])

	// Keyboard + scroll controls (j/k, arrows, space, etc.)
	const toggleDebugMode = useCallback(() => {
		setDebugMode(!debugMode)
	}, [debugMode, setDebugMode])

	useChapterControls({
		controller,
		sectionCount: sections.length,
		onRestart: () => setRestartTrigger((prev) => prev + 1),
		onToggleDebug: toggleDebugMode,
		onGoHome: () => {
			setLastChapter(chapter)
			navigate({ to: "/" })
		},
		onScrollAttempt: handleScrollAttempt,
	})

	if (error) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-black text-red-400">
				Error loading narration: {error}
			</div>
		)
	}

	if (sections.length === 0 || currentChapter !== chapter) {
		return (
			<div className="min-h-screen bg-black">
				<ChapterTitleBar title={chapterTitle || chapter} chapterId={chapter} />
			</div>
		)
	}

	if (isMobile) {
		return <MobileLayout />
	}

	return (
		<>
			<ChapterCursor activeIndex={activeIndex} isPlaying={playbackState === "playing"} isFinished={isFinished} />
			<CursorTooltipRenderer />
			<CompletionEffects />
			<DesktopLayout
				chapter={chapter}
				chapterTitle={chapterTitle}
				sections={sections}
				activeSection={activeSection}
				restartTrigger={restartTrigger}
				controller={controller}
			/>
			{/* Scroll hint toast */}
			<AnimatePresence>
				{showScrollHint && (
					<motion.div
						initial={{ opacity: 0, y: -20, filter: "blur(0px)", backgroundColor: "rgba(40,40,40,0.95)" }}
						animate={{
							opacity: 1,
							y: 0,
							filter: "blur(0px)",
							backgroundColor: "rgba(10,10,10,0.95)",
							transition: {
								backgroundColor: { duration: 2, ease: "linear" },
								opacity: { duration: 0.2 },
								y: { duration: 0.2 },
							},
						}}
						exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
						className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col border border-white/15"
					>
						<div className="flex items-center gap-2 px-3 py-2 border-b border-white/15 text-white/60 text-xs uppercase tracking-wider">
							<HandEyeIcon size={14} weight="fill" />
							<span>Scroll-jacked!</span>
						</div>
						<div className="px-3 py-2 text-white/70 text-sm">
							Use{" "}
							<kbd className="inline-flex items-center justify-center w-5 h-5 mx-0.5 bg-white/8 border border-white/15 text-xs">
								↑
							</kbd>
							<kbd className="inline-flex items-center justify-center w-5 h-5 mx-0.5 bg-white/8 border border-white/15 text-xs">
								↓
							</kbd>{" "}
							or click to navigate
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	)
}
