import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { useCallback, useEffect, useEffectEvent, useRef } from "react"
import { getCurrentTimeAtom, recentSeekAtom } from "@/atoms/audioPlayer"
import { feedbackModalOpenAtom } from "@/atoms/globalState"
import { activeSectionAtom, scrollCooldownAtom } from "@/atoms/narration"
import { useClickSound } from "@/hooks/useClickSound"
import { useHotkeys } from "@/hooks/useHotkeys"
import { usePlaybackRateControls } from "@/hooks/usePlaybackRateControls"
import type { SectionData } from "@/lib/tooling/types"
import { appSounds } from "@/sounds/AppSounds"

export interface ChapterControlsOptions {
	controller: {
		spaceAction: () => void
		prevSection: () => void
		nextSection: () => void
		goToSection: (index: number) => void
		restart: () => void
		seekBy: (seconds: number) => void
		seekTo: (seconds: number) => void
	} | null
	sectionCount: number
	onRestart?: () => void
	onToggleDebug?: () => void
	onGoHome?: () => void
	/** Called when user attempts to scroll - show navigation hint */
	onScrollAttempt?: () => void
}

/**
 * Keyboard and scroll controls for chapter playback.
 *
 * Keyboard:
 * - Space: play/pause
 * - j / Down: next section
 * - k / Up: prev section
 * - gg / Home: first section
 * - G / End: last section
 * - gh: go to chapters index
 * - r: restart current section
 * - Left / Right: seek +/-2s (5s with shift), scaled by playback speed
 * - Alt+Left / Alt+Right: jump to previous/next animation step
 * - < / >: change playback speed
 * - Ctrl+D: toggle debug mode (dev only)
 *
 * Scroll: wheel triggers scroll-jacked navigation hint
 */
export function useChapterControls({
	controller,
	sectionCount,
	onRestart,
	onToggleDebug,
	onGoHome,
	onScrollAttempt,
}: ChapterControlsOptions) {
	const feedbackModalOpen = useAtomValue(feedbackModalOpenAtom)
	const scrollCooldown = useAtomValue(scrollCooldownAtom)
	const setScrollCooldown = useAtomSet(scrollCooldownAtom)
	const setRecentSeek = useAtomSet(recentSeekAtom)
	const getCurrentTime = useAtomSet(getCurrentTimeAtom, { mode: "promise" })
	const activeSection = useAtomValue(activeSectionAtom)
	const { playbackRate, stepPlaybackRate } = usePlaybackRateControls()
	const playClick = useClickSound()
	const runAction = useCallback(
		(action?: () => void, sound = true) => {
			// Defer to next frame to avoid blocking keydown handler
			requestAnimationFrame(() => {
				action?.()
				if (sound) playClick()
			})
		},
		[playClick],
	)

	// Mark recent seek with auto-clear timeout
	const recentSeekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const markRecentSeek = useCallback(() => {
		if (recentSeekTimeoutRef.current) clearTimeout(recentSeekTimeoutRef.current)
		setRecentSeek(true)
		recentSeekTimeoutRef.current = setTimeout(() => setRecentSeek(false), 300)
	}, [setRecentSeek])

	// Refs for callbacks only (stable identity across renders)
	const callbacksRef = useRef({ onRestart, onToggleDebug, onGoHome, onScrollAttempt })
	callbacksRef.current = { onRestart, onToggleDebug, onGoHome, onScrollAttempt }

	useHotkeys({
		context: "chapter",
		enabled: !feedbackModalOpen,
		handlers: {
			"chapter.playPause": () => {
				runAction(() => controller?.spaceAction())
				return true
			},
			"nav.prevItem": () => {
				runAction(() => controller?.prevSection())
				return true
			},
			"nav.nextItem": () => {
				runAction(() => controller?.nextSection())
				return true
			},
			"chapter.firstSection": () => {
				runAction(() => controller?.goToSection(0))
				return true
			},
			"chapter.lastSection": () => {
				runAction(() => controller?.goToSection(sectionCount - 1))
				return true
			},
			"nav.goHome": () => {
				runAction(() => callbacksRef.current.onGoHome?.())
				return true
			},
			"chapter.restart": () => {
				runAction(() => {
					callbacksRef.current.onRestart?.()
					controller?.restart()
				})
				return true
			},
			"chapter.stepBack": () => {
				void getCurrentTime().then((currentTime) => {
					const prevTime = findPrevStepTime(currentTime, activeSection)
					if (prevTime !== null) {
						markRecentSeek()
						controller?.seekTo(prevTime)
						appSounds.playSkipTick()
					}
				})
				return true
			},
			"chapter.stepForward": () => {
				void getCurrentTime().then((currentTime) => {
					const nextTime = findNextStepTime(currentTime, activeSection)
					if (nextTime !== null) {
						markRecentSeek()
						controller?.seekTo(nextTime)
						appSounds.playSkipTick()
					}
				})
				return true
			},
			"chapter.seekBack": (event) => {
				markRecentSeek()
				const baseSeek = event.shiftKey ? -5 : -2
				controller?.seekBy(baseSeek * playbackRate)
				appSounds.playSkipTick()
				return true
			},
			"chapter.seekForward": (event) => {
				markRecentSeek()
				const baseSeek = event.shiftKey ? 5 : 2
				controller?.seekBy(baseSeek * playbackRate)
				appSounds.playSkipTick()
				return true
			},
			"chapter.playbackRateDown": () => {
				if (stepPlaybackRate("down")) playClick()
				return true
			},
			"chapter.playbackRateUp": () => {
				if (stepPlaybackRate("up")) playClick()
				return true
			},
			"chapter.toggleDebug": () => {
				if (!import.meta.env.DEV) return false
				callbacksRef.current.onToggleDebug?.()
				return true
			},
		},
	})

	// Scroll handler - show hint instead of navigating
	const onWheel = useEffectEvent((e: WheelEvent) => {
		if (Math.abs(e.deltaY) < 50) return

		const now = Date.now()
		if (now - scrollCooldown < 1500) return // Longer cooldown for hint

		setScrollCooldown(now)
		callbacksRef.current.onScrollAttempt?.()
	})

	// Scroll controls - listener attached once, handler reads latest values
	useEffect(() => {
		window.addEventListener("wheel", onWheel, { passive: true })
		return () => window.removeEventListener("wheel", onWheel)
	}, [onWheel])
}

// --- Step navigation helpers ---

/**
 * Get all step times from a section (combines code animation and component flow steps).
 */
function getStepTimes(section: SectionData | undefined): number[] {
	if (!section) return []

	// Combine both step time arrays (code animation and component flow)
	const codeTimes = section.stepTimes ?? []
	const componentTimes = section.componentStepTimes ?? []

	// Merge, dedupe, and sort
	const allTimes = [...new Set([...codeTimes, ...componentTimes])].sort((a, b) => a - b)
	return allTimes
}

/**
 * Find the time of the previous step relative to current playback position.
 * Returns null if no previous step exists.
 */
function findPrevStepTime(currentTime: number, section: SectionData | undefined): number | null {
	const stepTimes = getStepTimes(section)
	if (stepTimes.length === 0) return null

	// Find highest step time that's before currentTime (with small buffer to prevent getting stuck)
	const buffer = 0.3
	for (let i = stepTimes.length - 1; i >= 0; i--) {
		if (stepTimes[i] < currentTime - buffer) {
			return stepTimes[i]
		}
	}
	return null
}

/**
 * Find the time of the next step relative to current playback position.
 * Returns null if no next step exists.
 */
function findNextStepTime(currentTime: number, section: SectionData | undefined): number | null {
	const stepTimes = getStepTimes(section)
	if (stepTimes.length === 0) return null

	// Find lowest step time that's after currentTime
	for (const time of stepTimes) {
		if (time > currentTime) {
			return time
		}
	}
	return null
}
