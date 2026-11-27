import { useAtom, useAtomSet } from "@effect/atom-react"
import { useCallback } from "react"
import { PLAYBACK_RATES, type PlaybackRate, playbackRateAtom, setPlaybackRateAtom } from "@/atoms/audioPlayer"
import { notificationAtom, notify } from "@/atoms/notification"

interface PlaybackRateOptions {
	notify?: boolean
}

export function usePlaybackRateControls() {
	const [playbackRate, setPlaybackRateAtomValue] = useAtom(playbackRateAtom)
	const setNotification = useAtomSet(notificationAtom)
	const setPlaybackRateAction = useAtomSet(setPlaybackRateAtom)

	const setPlaybackRate = useCallback(
		(rate: PlaybackRate, options: PlaybackRateOptions = {}) => {
			if (rate === playbackRate) return false
			setPlaybackRateAtomValue(rate)
			setPlaybackRateAction(rate)

			if (options.notify !== false) {
				setNotification(notify(`Speed: ${rate}x`))
			}

			return true
		},
		[playbackRate, setPlaybackRateAtomValue, setPlaybackRateAction, setNotification],
	)

	const stepPlaybackRate = useCallback(
		(direction: "up" | "down", options?: PlaybackRateOptions) => {
			const currentIndex = PLAYBACK_RATES.indexOf(playbackRate)
			if (currentIndex === -1) return false

			const nextIndex = direction === "up" ? currentIndex + 1 : currentIndex - 1
			if (nextIndex < 0 || nextIndex >= PLAYBACK_RATES.length) return false

			return setPlaybackRate(PLAYBACK_RATES[nextIndex], options)
		},
		[playbackRate, setPlaybackRate],
	)

	return {
		playbackRate,
		setPlaybackRate,
		stepPlaybackRate,
	}
}
