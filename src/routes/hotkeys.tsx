import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { GithubLogoIcon, HouseIcon } from "@phosphor-icons/react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useMemo, useRef, useState } from "react"
import type { HotkeyOverrides } from "@/atoms/hotkeys"
import { hotkeyMapAtom, hotkeyOverridesAtom } from "@/atoms/hotkeys"
import { NAV_BAR_HEIGHT } from "@/components/chapters/constants"
import { FooterEffectLink } from "@/components/chapters/FooterEffectLink"
import { FooterLinks } from "@/components/FooterLinks"
import { HotkeyGroup } from "@/components/hotkeys/HotkeyGroup"
import { getHotkeyConflicts } from "@/lib/hotkeys/conflicts"
import { serializeKeySequence } from "@/lib/hotkeys/format"
import { normalizeEvent } from "@/lib/hotkeys/normalize"
import { defaultKeymap, hotkeyActionList } from "@/lib/hotkeys/registry"
import type { HotkeyActionId, HotkeyCategory, KeyCombo, KeySequence } from "@/lib/hotkeys/types"

const REPO_URL = "https://github.com/kitlangton/effect-institute"

export const Route = createFileRoute("/hotkeys")({
	component: HotkeysPage,
})

function sequencesEqual(a: KeySequence[], b: KeySequence[]): boolean {
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i += 1) {
		if (serializeKeySequence(a[i]) !== serializeKeySequence(b[i])) return false
	}
	return true
}

function dedupeSequences(sequences: KeySequence[]): KeySequence[] {
	const unique: KeySequence[] = []
	for (const sequence of sequences) {
		const key = serializeKeySequence(sequence)
		if (unique.some((candidate) => serializeKeySequence(candidate) === key)) continue
		unique.push(sequence)
	}
	return unique
}

function HotkeysPage() {
	const hotkeyOverrides = useAtomValue(hotkeyOverridesAtom)
	const setHotkeyOverrides = useAtomSet(hotkeyOverridesAtom)
	const hotkeyMap = useAtomValue(hotkeyMapAtom)
	const [captureTarget, setCaptureTarget] = useState<HotkeyActionId | null>(null)
	const [captureSequence, setCaptureSequence] = useState<KeyCombo[]>([])
	const captureTimeoutRef = useRef<number | null>(null)

	const visibleHotkeyActions = useMemo(
		() =>
			hotkeyActionList.filter(
				(action) => action.customizable !== false && (import.meta.env.DEV ? true : !action.devOnly),
			),
		[],
	)
	const hotkeyGroups = useMemo(() => {
		const categoryOrder: HotkeyCategory[] = ["Playback", "Navigation"]
		return categoryOrder
			.map((category) => ({
				category,
				actions: visibleHotkeyActions.filter((action) => action.category === category),
			}))
			.filter((group) => group.actions.length > 0)
	}, [visibleHotkeyActions])
	const hotkeyConflicts = useMemo(() => getHotkeyConflicts(hotkeyMap), [hotkeyMap])
	const hasOverrides = Object.keys(hotkeyOverrides).length > 0
	const conflictsByAction = useMemo(() => {
		const map = new Map<HotkeyActionId, KeySequence[]>()
		for (const conflict of hotkeyConflicts) {
			for (const actionId of conflict.actions) {
				const existing = map.get(actionId) ?? []
				map.set(actionId, [...existing, conflict.sequence])
			}
		}
		return map
	}, [hotkeyConflicts])

	const applyBindings = (actionId: HotkeyActionId, sequences: KeySequence[]) => {
		setHotkeyOverrides((prev) => {
			const next: HotkeyOverrides = { ...prev }
			const defaults = defaultKeymap[actionId]
			if (sequencesEqual(sequences, defaults)) {
				delete next[actionId]
			} else {
				next[actionId] = sequences
			}
			return next
		})
	}

	const resetBindings = (actionId: HotkeyActionId) => {
		applyBindings(actionId, defaultKeymap[actionId])
	}

	const removeBinding = (actionId: HotkeyActionId, index: number) => {
		const currentBindings = hotkeyMap[actionId] ?? []
		const nextBindings = currentBindings.filter((_, bindingIndex) => bindingIndex !== index)
		applyBindings(actionId, nextBindings)
	}

	const startCapture = (actionId: HotkeyActionId) => {
		if (captureTimeoutRef.current) window.clearTimeout(captureTimeoutRef.current)
		if (captureTarget === actionId) {
			setCaptureTarget(null)
			setCaptureSequence([])
			return
		}
		setCaptureTarget(actionId)
		setCaptureSequence([])
	}

	const cancelCapture = () => {
		if (captureTimeoutRef.current) window.clearTimeout(captureTimeoutRef.current)
		setCaptureTarget(null)
		setCaptureSequence([])
	}

	const commitCapture = () => {
		if (!captureTarget || captureSequence.length === 0) {
			cancelCapture()
			return
		}

		const currentBindings = hotkeyMap[captureTarget] ?? []
		applyBindings(captureTarget, dedupeSequences([...currentBindings, captureSequence]))
		if (captureTimeoutRef.current) {
			window.clearTimeout(captureTimeoutRef.current)
			captureTimeoutRef.current = null
		}
		setCaptureTarget(null)
		setCaptureSequence([])
	}

	const resetAllHotkeys = () => {
		if (!hasOverrides) return
		cancelCapture()
		setHotkeyOverrides({})
	}

	useEffect(() => {
		if (!captureTarget) return

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.repeat) return
			const combo = normalizeEvent(event)
			if (!combo) return
			event.preventDefault()
			event.stopPropagation()
			setCaptureSequence((prev) => [...prev, combo].slice(-2))
		}

		window.addEventListener("keydown", handleKeyDown, { capture: true })
		return () => window.removeEventListener("keydown", handleKeyDown, { capture: true })
	}, [captureTarget])

	useEffect(() => {
		if (!captureTarget || captureSequence.length === 0) return
		if (captureTimeoutRef.current) window.clearTimeout(captureTimeoutRef.current)
		if (captureSequence.length >= 2) {
			commitCapture()
			return
		}
		captureTimeoutRef.current = window.setTimeout(() => {
			commitCapture()
		}, 600)
		return () => {
			if (captureTimeoutRef.current) window.clearTimeout(captureTimeoutRef.current)
		}
	}, [captureTarget, captureSequence])

	return (
		<div className="min-h-dvh bg-black overflow-y-auto flex justify-center">
			<div className="max-w-2xl w-full sm:border-x border-[var(--border-subtle)] sm:mx-8 flex flex-col min-h-dvh">
				{/* Nav bar */}
				<div
					className="flex-none flex items-center justify-between border-b border-[var(--border-subtle)]"
					style={{ height: NAV_BAR_HEIGHT }}
				>
					<Link
						to="/"
						className="flex items-center px-4 h-full text-white/30 hover:text-white/60 hover:bg-white/5 cursor-default"
					>
						<HouseIcon size={16} weight="fill" />
					</Link>
					<h1 className="text-xs uppercase tracking-[0.3em] text-white/40">Hotkeys</h1>
					<a
						href={REPO_URL}
						target="_blank"
						rel="noopener noreferrer"
						aria-label="GitHub repository"
						className="flex items-center px-4 h-full border-l border-[var(--border-subtle)] text-white/30 hover:text-white/60 hover:bg-white/5"
					>
						<GithubLogoIcon size={16} weight="fill" />
					</a>
				</div>

				<div className="p-5 space-y-5">
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-1">
							<p className="text-sm text-white/70">Customize keyboard shortcuts.</p>
						</div>
						<button
							type="button"
							onClick={resetAllHotkeys}
							disabled={!hasOverrides}
							className={`text-xs uppercase tracking-wide whitespace-nowrap shrink-0 transition-colors ${
								hasOverrides ? "text-white/40 hover:text-white/70" : "text-white/20"
							}`}
						>
							Reset all
						</button>
					</div>
				</div>

				<div className="flex-1">
					{hotkeyGroups.map((group) => (
						<HotkeyGroup
							key={group.category}
							category={group.category}
							actions={group.actions}
							hotkeyMap={hotkeyMap}
							conflictsByAction={conflictsByAction}
							captureTarget={captureTarget}
							captureSequence={captureSequence}
							isDefaultForAction={(actionId) => sequencesEqual(hotkeyMap[actionId] ?? [], defaultKeymap[actionId])}
							onAdd={startCapture}
							onRemove={removeBinding}
							onReset={resetBindings}
						/>
					))}
				</div>

				{/* Footer */}
				<div
					className="flex-none bg-black border-t border-[var(--border-subtle)] flex items-center justify-between mt-auto"
					style={{ height: NAV_BAR_HEIGHT }}
				>
					<FooterEffectLink />
					<div className="flex items-center h-full">
						<FooterLinks />
					</div>
				</div>
			</div>
		</div>
	)
}
