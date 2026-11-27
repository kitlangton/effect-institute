export type HotkeyContextId = "chapter" | "home" | "changelog" | "debug-pixi" | "og-chapter" | "modal"

export type HotkeyCategory = "Playback" | "Navigation" | "Debug" | "Modal"

export type KeyCombo = {
	key: string
	ctrl?: boolean
	shift?: boolean
	alt?: boolean
	meta?: boolean
}

export type KeySequence = ReadonlyArray<KeyCombo>

export type HotkeyActionId =
	| "chapter.playPause"
	| "chapter.firstSection"
	| "chapter.lastSection"
	| "chapter.restart"
	| "chapter.seekBack"
	| "chapter.seekForward"
	| "chapter.stepBack"
	| "chapter.stepForward"
	| "chapter.playbackRateDown"
	| "chapter.playbackRateUp"
	| "chapter.toggleDebug"
	| "nav.nextItem"
	| "nav.prevItem"
	| "nav.goHome"
	| "home.openSelected"
	| "home.clearSelection"
	| "debugPixi.prevStep"
	| "debugPixi.nextStep"
	| "ogChapter.prevChapter"
	| "ogChapter.nextChapter"
	| "modal.close"

export type HotkeyAction = {
	id: HotkeyActionId
	label: string
	description?: string
	category: HotkeyCategory
	contexts: ReadonlyArray<HotkeyContextId>
	allowInInputs?: boolean
	devOnly?: boolean
	customizable?: boolean
}

export type HotkeyMap = Record<HotkeyActionId, KeySequence[]>
