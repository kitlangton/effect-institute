import { useEffect } from "react"
import { taskSounds } from "@/lib/visual-effect/sounds/TaskSounds"
import { appSounds } from "@/sounds/AppSounds"

const POINTER_EVENT_OPTIONS: AddEventListenerOptions = {
	capture: true,
	passive: true,
}

const KEY_EVENT_OPTIONS: AddEventListenerOptions = {
	capture: true,
}

/**
 * Registers the minimum user-gesture listeners required for unlocking the
 * Web Audio context. Chrome blocks AudioContext resume calls that aren't tied
 * to pointer or key gestures, so we listen for the first qualifying event and
 * forward it to the sound system.
 */
export function useAudioUnlock() {
	useEffect(() => {
		if (typeof window === "undefined") return

		let unlocking: Promise<void> | null = null
		let unlocked = false

		const listeners: Array<{
			type: keyof WindowEventMap
			listener: (event: Event) => void
			options?: AddEventListenerOptions | undefined
		}> = []

		const removeListeners = () => {
			for (const { type, listener, options } of listeners) {
				window.removeEventListener(type, listener, options)
			}
			listeners.length = 0
		}

		const tryUnlock = () => {
			if (unlocked || unlocking) return

			unlocking = Promise.all([appSounds.unlockFromUserGesture(), taskSounds.unlockFromUserGesture()])
				.then(([appUnlocked, taskUnlocked]) => {
					if (appUnlocked && taskUnlocked) {
						unlocked = true
						removeListeners()
					}
				})
				.finally(() => {
					unlocking = null
				})
		}

		const addListener = (type: keyof WindowEventMap, options?: AddEventListenerOptions) => {
			const listener = () => tryUnlock()
			window.addEventListener(type, listener, options)
			listeners.push({ type, listener, options })
		}

		addListener("pointerdown", POINTER_EVENT_OPTIONS)
		addListener("touchstart", POINTER_EVENT_OPTIONS)
		addListener("keydown", KEY_EVENT_OPTIONS)

		return () => {
			removeListeners()
		}
	}, [])
}
