"use client"

import { useEffect, useRef } from "react"
import type { AnimationSoundName } from "@/lib/animated-code/annotations"
import { playAnimationSound } from "@/sounds/AnimationSounds"

/**
 * Hook that plays a sound effect when the animation step changes.
 *
 * Sound only plays on step transitions, not on initial render or re-renders.
 *
 * @param step - Current animation step index
 * @param sound - Sound effect name to play (undefined = no sound)
 *
 * @example
 * ```tsx
 * const currentSound = snapshotEntry?.sound
 * useAnimationSound(step, currentSound)
 * ```
 */
export function useAnimationSound(step: number, sound: AnimationSoundName | undefined): void {
	const prevStepRef = useRef(step)

	useEffect(() => {
		// Only play on step change (not initial render)
		if (step !== prevStepRef.current) {
			prevStepRef.current = step

			if (sound) {
				playAnimationSound(sound)
			}
		}
	}, [step, sound])
}
