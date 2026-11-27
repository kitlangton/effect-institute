/**
 * Sound effects for animation steps.
 *
 * Maps preset names to playback functions using existing Tone.js synths.
 */
import type { AnimationSoundName } from "@/lib/animated-code/annotations"
import { appSounds } from "./AppSounds"

export const animationSounds: Record<AnimationSoundName, () => Promise<void>> = {
	tick: () => appSounds.playClick(),
	pop: () => appSounds.playCompletionSound(),
	whoosh: () => appSounds.playExampleAdvance(),
	sad: () => appSounds.playToggleSound(true),
	celebrate: () => appSounds.playToggleSound(false),
	chime: () => appSounds.playCompletionSound(),
	success: () => appSounds.playToggleSound(false),
	error: () => appSounds.playToggleSound(true),
	alarm: () => appSounds.playAlarmSound(),
	doom: () => appSounds.playDoomSound(),
	spooky: () => appSounds.playSpookySound(),
	press: () => appSounds.playKeyPress(),
	fail: () => appSounds.playFail(),
	succeed: () => appSounds.playWin(),
	ping1: () => appSounds.playCompletionVariant("ding-bell"),
	ping2: () => appSounds.playCompletionVariant("ding-crystal"),
	ping3: () => appSounds.playCompletionVariant("ding-shimmer"),
	derp: () => appSounds.playDerpTrombone(),
	skip: () => appSounds.playSkipTick(),
}

/** Play an animation sound effect by name. */
export function playAnimationSound(name: AnimationSoundName): void {
	animationSounds[name]()
}
