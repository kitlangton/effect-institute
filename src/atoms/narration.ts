import { Schema } from "effect"
import { Atom } from "effect/reactivity"
import type { SectionData } from "@/lib/tooling/types"
import { sectionPlaybackAtom } from "./audioPlayer"
import { frontendKeyValueRuntime } from "./runtime"

export type { SectionData }

export const lastSectionCache = new Map<string, string>()

// --- URL search param for active section ---
export const sectionParamAtom = Atom.searchParam("section")

// --- Last visited chapter (for highlighting on home page) ---
export const lastChapterAtom = Atom.make<string | null>(null).pipe(Atom.keepAlive)

// --- Per-chapter last section (persisted to localStorage) ---
export const lastSectionFamily = Atom.family((chapter: string) =>
	Atom.kvs({
		runtime: frontendKeyValueRuntime,
		key: `effect-institute:lastSection:${chapter}`,
		schema: Schema.String,
		defaultValue: () => "",
	}),
)

export interface NarrationState {
	/** Current chapter ID */
	chapter: string | null
	sections: readonly SectionData[]
	activeIndex: number
}

const initialState: NarrationState = {
	chapter: null,
	sections: [],
	activeIndex: 0,
}

// --- Main Atom ---

export const narrationAtom = Atom.make(initialState).pipe(Atom.keepAlive)

// --- Derived Atoms ---

export const activeSectionAtom = Atom.map(
	narrationAtom,
	(s: NarrationState) => s.sections[s.activeIndex] as SectionData | undefined,
)

export const activeIndexAtom = Atom.map(narrationAtom, (s: NarrationState) => s.activeIndex)

export const sectionsAtom = Atom.map(narrationAtom, (s: NarrationState) => s.sections)

export const chapterAtom = Atom.map(narrationAtom, (s: NarrationState) => s.chapter)

export const canGoNextAtom = Atom.map(narrationAtom, (s: NarrationState) => s.activeIndex < s.sections.length - 1)

export const canGoPrevAtom = Atom.map(narrationAtom, (s: NarrationState) => s.activeIndex > 0)

/**
 * Create a derived atom that computes a step based on time thresholds.
 * Only triggers re-render when the step actually changes.
 * Uses per-section playback state to avoid stale time when switching sections.
 */
export function createStepAtom(sectionId: string, sectionIndex: number, stepTimes: readonly number[]) {
	const playbackAtom = sectionPlaybackAtom(sectionId)

	return Atom.readable((get) => {
		if (sectionIndex !== get(activeIndexAtom)) return 0
		const { currentTime } = get(playbackAtom)
		for (let i = stepTimes.length - 1; i >= 0; i--) {
			if (currentTime >= stepTimes[i]) {
				return i
			}
		}
		return 0
	})
}

// --- Actions (pure functions returning updaters) ---

export const setSections =
	(chapter: string, sections: readonly SectionData[], startIndex = 0) =>
	(prev: NarrationState): NarrationState => ({
		...prev,
		chapter,
		sections,
		activeIndex: Math.max(0, Math.min(startIndex, sections.length - 1)),
	})

export const setActiveIndex =
	(activeIndex: number) =>
	(prev: NarrationState): NarrationState => ({
		...prev,
		activeIndex,
	})

/** Update sections in place without resetting activeIndex (for HMR) */
export const updateSections =
	(sections: readonly SectionData[]) =>
	(prev: NarrationState): NarrationState => ({
		...prev,
		sections,
		// Keep activeIndex, but clamp if sections were removed
		activeIndex: Math.min(prev.activeIndex, sections.length - 1),
	})

// --- localStorage-synced navigation ---

/**
 * Writable atom for section navigation.
 * Reading: returns current activeIndex from narrationAtom
 * Writing: updates localStorage (per-chapter) AND narrationAtom.activeIndex atomically
 *
 * This keeps URLs clean while still persisting position per chapter.
 */
export const goToSectionAtom = Atom.writable(
	(get) => get(activeIndexAtom),
	(ctx, index: number) => {
		const sections = ctx.get(sectionsAtom)
		const chapter = ctx.get(chapterAtom)
		const section = sections[index]
		if (section && chapter) {
			lastSectionCache.set(chapter, section.id)
			// Persist to localStorage via kvs atom
			ctx.set(lastSectionFamily(chapter), section.id)
			// Update narrationAtom.activeIndex immediately
			const prev = ctx.get(narrationAtom)
			ctx.set(narrationAtom, {
				...prev,
				activeIndex: Math.max(0, Math.min(index, prev.sections.length - 1)),
			})
		}
	},
)

// --- Scroll cooldown (persists across re-renders) ---
export const scrollCooldownAtom = Atom.make(0)

// --- Completed sections (per-chapter, using families) ---

/** Per-chapter completed sections. Each chapter has its own isolated Set. */
export const completedSectionsFamily = Atom.family((_chapterId: string) => Atom.make(new Set<number>()))

/** Per-chapter hydration status. True once progress loaded from storage. */
export const progressHydratedFamily = Atom.family((_chapterId: string) => Atom.make(false))

const EMPTY_COMPLETED_SECTIONS = new Set<number>()

export const completedSectionsAtom = Atom.make((get) => {
	const chapter = get(chapterAtom)
	return chapter ? get(completedSectionsFamily(chapter)) : EMPTY_COMPLETED_SECTIONS
})

export const progressHydratedAtom = Atom.make((get) => {
	const chapter = get(chapterAtom)
	return chapter ? get(progressHydratedFamily(chapter)) : false
})

export const markSectionCompleted =
	(index: number) =>
	(prev: Set<number>): Set<number> =>
		new Set([...prev, index])
