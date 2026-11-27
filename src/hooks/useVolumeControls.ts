import { useAtom, useAtomSet } from "@effect/atom-react"
import { useCallback, useEffect } from "react"
import { setVolumeAtom as setAudioVolumeAtom } from "@/atoms/audioPlayer"
import { volumeAtom } from "@/atoms/volume"
import { taskSounds } from "@/lib/visual-effect/sounds/TaskSounds"
import { appSounds } from "@/sounds/AppSounds"

export function useVolumeControls() {
	const [volume, setVolumeAtomValue] = useAtom(volumeAtom)
	const setAudioVolume = useAtomSet(setAudioVolumeAtom)

	// Sync volume to sound systems when it changes
	// App tones are scaled to 70% of main volume to keep UI sounds subtle
	// Task sounds (Pixie nodes) use full volume for important feedback
	useEffect(() => {
		appSounds.setVolume(volume * 0.7)
		taskSounds.setVolume(volume)
		setAudioVolume(volume)
	}, [volume, setAudioVolume])

	const setVolume = useCallback(
		(value: number) => {
			const clamped = Math.max(0, Math.min(1, value))
			setVolumeAtomValue(clamped)
		},
		[setVolumeAtomValue],
	)

	return {
		volume,
		setVolume,
	}
}
