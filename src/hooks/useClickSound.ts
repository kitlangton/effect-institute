import { useCallback } from "react"
import { appSounds } from "@/sounds/AppSounds"

export function useClickSound() {
	return useCallback(() => {
		appSounds.playClick()
	}, [])
}
