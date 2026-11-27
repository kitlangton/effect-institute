/**
 * Hook that combines audio atoms with navigation logic.
 * Provides a unified controller interface for playback + navigation.
 * Audio state is managed entirely by AudioPlayer service.
 */
import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react"
import { useNavigate } from "@tanstack/react-router"
import { startTransition, useCallback, useEffect, useRef } from "react"
import {
	effectivePlaybackRateAtom,
	isFinishedAtom,
	loadSectionAtom,
	playAtom,
	playbackStateAtom,
	preloadSectionAtom,
	restartAtom,
	seekByAtom,
	seekToAtom,
	setPlaybackRateAtom,
	toggleAtom,
} from "@/atoms/audioPlayer"
import { completionTriggerAtom } from "@/atoms/completion"
import {
	addGlowingSection,
	glowingSectionsAtom,
	pendingCompletionSoundAtom,
	pendingRingSectionAtom,
	removeGlowingSection,
} from "@/atoms/completionEffects"
import {
	canGoNextChapterAtom,
	courseManifestLoadedAtom,
	fetchCourseManifestAtom,
	nextChapterAtom,
} from "@/atoms/course"
import {
	activeIndexAtom,
	activeSectionAtom,
	canGoNextAtom,
	canGoPrevAtom,
	chapterAtom,
	completedSectionsFamily,
	goToSectionAtom,
	lastChapterAtom,
	markSectionCompleted,
	sectionsAtom,
} from "@/atoms/narration"
import { markCompletedAtom } from "@/atoms/progress"
import { appSounds } from "@/sounds/AppSounds"

export function useAudioController() {
	const navigate = useNavigate()
	const setGoToSection = useAtomSet(goToSectionAtom)
	const chapter = useAtomValue(chapterAtom)
	const [completedSections, setCompleted] = useAtom(completedSectionsFamily(chapter ?? "__none__"))
	const activeSection = useAtomValue(activeSectionAtom)
	const activeIndex = useAtomValue(activeIndexAtom)
	const sections = useAtomValue(sectionsAtom)
	const canGoNext = useAtomValue(canGoNextAtom)
	const canGoPrev = useAtomValue(canGoPrevAtom)
	const isFinished = useAtomValue(isFinishedAtom)
	const playbackState = useAtomValue(playbackStateAtom)

	// Cross-chapter navigation
	const fetchCourseManifest = useAtomSet(fetchCourseManifestAtom)
	const canGoNextChapter = useAtomValue(canGoNextChapterAtom)
	const nextChapter = useAtomValue(nextChapterAtom)
	const courseManifestLoaded = useAtomValue(courseManifestLoadedAtom)

	// Audio action atoms
	const toggle = useAtomSet(toggleAtom)
	const play = useAtomSet(playAtom)
	const restart = useAtomSet(restartAtom)
	const seekTo = useAtomSet(seekToAtom)
	const seekBy = useAtomSet(seekByAtom)
	const loadSection = useAtomSet(loadSectionAtom)
	const preloadSection = useAtomSet(preloadSectionAtom)
	const effectiveRate = useAtomValue(effectivePlaybackRateAtom)
	const setPlaybackRateAction = useAtomSet(setPlaybackRateAtom)
	const markCompletedPersist = useAtomSet(markCompletedAtom)

	// Visual effect state atoms (state-driven, not event-driven)
	const setGlowingSections = useAtomSet(glowingSectionsAtom)
	const setPendingSound = useAtomSet(pendingCompletionSoundAtom)
	const setPendingRing = useAtomSet(pendingRingSectionAtom)

	// Track if we should play after navigating (explicit user action)
	const playAfterNavRef = useRef(false)
	const playbackRateRef = useRef(effectiveRate)
	// Track previous section ID and audioFile to know when to reload
	const prevAudioKeyRef = useRef<string | null>(null)
	// Glow timeout ref for cleanup
	const glowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const delayedPlayRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const cancelDelayedPlay = useCallback(() => {
		if (delayedPlayRef.current) {
			clearTimeout(delayedPlayRef.current)
			delayedPlayRef.current = null
		}
	}, [])

	// Apply effective playback rate (considers temporary overrides)
	useEffect(() => {
		playbackRateRef.current = effectiveRate
		setPlaybackRateAction(effectiveRate)
	}, [effectiveRate, setPlaybackRateAction])

	// Fetch course manifest for cross-chapter navigation
	useEffect(() => {
		fetchCourseManifest()
	}, [fetchCourseManifest, chapter])

	// Load audio when section or hashed audioFile changes
	useEffect(() => {
		if (!activeSection || !chapter) return

		const audioKey = `${chapter}:${activeSection.id}:${activeSection.audioFile ?? ""}`
		if (prevAudioKeyRef.current === audioKey) return
		prevAudioKeyRef.current = audioKey

		loadSection({
			sectionId: activeSection.id,
			chapter,
			audioFile: activeSection.audioFile,
		})

		// Apply saved playback rate
		setPlaybackRateAction(playbackRateRef.current)

		// Play after navigation if requested
		if (playAfterNavRef.current) {
			playAfterNavRef.current = false
			// Delay to let section transition + animation settle
			cancelDelayedPlay()
			delayedPlayRef.current = setTimeout(() => {
				delayedPlayRef.current = null
				play()
			}, 300)
		}
	}, [activeSection, chapter, loadSection, play, setPlaybackRateAction, cancelDelayedPlay])

	useEffect(() => {
		if (!chapter || sections.length === 0) return

		const indices = [activeIndex - 1, activeIndex + 1, activeIndex + 2]
		for (const index of indices) {
			if (index < 0 || index >= sections.length) continue
			const section = sections[index]
			if (!section.audioFile) continue
			preloadSection({
				chapter,
				audioFile: section.audioFile,
			})
		}
	}, [chapter, sections, activeIndex, preloadSection])

	// Mark section complete when audio finishes
	// All condition logic is in completionTriggerAtom - effect just watches for null→non-null
	const completionTrigger = useAtomValue(completionTriggerAtom)
	const prevTriggerRef = useRef<typeof completionTrigger>(null)

	useEffect(() => {
		// Only fire when trigger transitions from null to non-null
		if (completionTrigger && !prevTriggerRef.current) {
			const { sectionId, activeIndex: triggerIndex, chapter: triggerChapter } = completionTrigger

			// Mark complete in state
			setCompleted(markSectionCompleted(triggerIndex))

			// Trigger visual effects (state-driven, not event-driven)
			setGlowingSections(addGlowingSection(sectionId))
			setPendingSound(true)
			setPendingRing(sectionId)

			// Clear glow after 1s
			if (glowTimeoutRef.current) clearTimeout(glowTimeoutRef.current)
			glowTimeoutRef.current = setTimeout(() => {
				setGlowingSections(removeGlowingSection(sectionId))
			}, 1000)

			// Persist to storage (localStorage or the account)
			markCompletedPersist({ chapter: triggerChapter, sectionId })
		}
		prevTriggerRef.current = completionTrigger
	}, [completionTrigger, setCompleted, setGlowingSections, setPendingSound, setPendingRing, markCompletedPersist])

	// Cleanup glow timeout on unmount
	useEffect(() => {
		return () => {
			if (glowTimeoutRef.current) clearTimeout(glowTimeoutRef.current)
			cancelDelayedPlay()
		}
	}, [cancelDelayedPlay])

	// Navigation actions - uses goToSectionAtom which updates URL + state atomically
	// Wrapped in startTransition to avoid blocking input during re-renders
	const goToSection = useCallback(
		(index: number) => {
			cancelDelayedPlay()
			playAfterNavRef.current = false
			startTransition(() => setGoToSection(index))
		},
		[setGoToSection, cancelDelayedPlay],
	)

	const nextSection = useCallback(() => {
		if (!canGoNext) return
		cancelDelayedPlay()
		playAfterNavRef.current = false
		startTransition(() => setGoToSection(activeIndex + 1))
	}, [canGoNext, activeIndex, setGoToSection, cancelDelayedPlay])

	const continueToNext = useCallback(() => {
		if (!canGoNext) return
		cancelDelayedPlay()
		playAfterNavRef.current = true
		startTransition(() => setGoToSection(activeIndex + 1))
	}, [canGoNext, activeIndex, setGoToSection, cancelDelayedPlay])

	const prevSection = useCallback(() => {
		if (!canGoPrev) return
		cancelDelayedPlay()
		playAfterNavRef.current = false
		startTransition(() => setGoToSection(activeIndex - 1))
	}, [canGoPrev, activeIndex, setGoToSection, cancelDelayedPlay])

	// Navigate to next chapter (fresh=1 bypasses localStorage restoration)
	const goToNextChapter = useCallback(() => {
		if (!nextChapter) return
		cancelDelayedPlay()
		appSounds.playKeyPress()
		navigate({
			to: "/chapters/$chapter",
			params: { chapter: nextChapter.id },
			search: { fresh: "1" },
		})
	}, [nextChapter, navigate, cancelDelayedPlay])

	const setLastChapter = useAtomSet(lastChapterAtom)
	const goHome = useCallback(() => {
		cancelDelayedPlay()
		setLastChapter(chapter)
		navigate({ to: "/" })
	}, [navigate, chapter, setLastChapter, cancelDelayedPlay])

	// Combined action: if finished, advance and play; otherwise toggle
	// Play sound only when a prompt is visible (begin, continue, next chapter, home)
	const showBeginPrompt = activeIndex === 0 && completedSections.size === 0 && playbackState === "idle"

	const spaceAction = useCallback(() => {
		if (isFinished && canGoNext) {
			appSounds.playKeyPress()
			continueToNext()
		} else if (isFinished && canGoNextChapter) {
			appSounds.playKeyPress()
			goToNextChapter()
		} else if (isFinished && !canGoNext && !canGoNextChapter && courseManifestLoaded) {
			// End of all available chapters, go home
			appSounds.playKeyPress()
			goHome()
		} else if (isFinished && !canGoNext && !courseManifestLoaded) {
			fetchCourseManifest()
		} else {
			if (showBeginPrompt) {
				appSounds.playKeyPress()
			}
			toggle()
		}
	}, [
		isFinished,
		canGoNext,
		canGoNextChapter,
		courseManifestLoaded,
		continueToNext,
		goToNextChapter,
		goHome,
		toggle,
		showBeginPrompt,
		fetchCourseManifest,
	])

	return {
		// Audio actions
		toggle,
		restart,
		seekTo,
		seekBy,
		// Navigation
		goToSection,
		nextSection,
		continueToNext,
		prevSection,
		spaceAction,
		// Cross-chapter navigation
		goToNextChapter,
		canGoNextChapter,
		nextChapter,
	}
}

export type AudioController = ReturnType<typeof useAudioController>
