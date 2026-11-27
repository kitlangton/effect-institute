import { useAtomValue } from "@effect/atom-react"
import { useEffect, useEffectEvent, useMemo, useRef } from "react"
import { hotkeyMapAtom } from "@/atoms/hotkeys"
import { sequenceIsPrefix, sequenceMatches, sequenceSpecificity } from "@/lib/hotkeys/match"
import { normalizeEvent } from "@/lib/hotkeys/normalize"
import { hotkeyActionList } from "@/lib/hotkeys/registry"
import { isEditableTarget } from "@/lib/hotkeys/shouldIgnore"
import type { HotkeyActionId, HotkeyContextId, KeySequence } from "@/lib/hotkeys/types"

type HotkeyHandler = (event: KeyboardEvent) => boolean | undefined

type HotkeyHandlers = Partial<Record<HotkeyActionId, HotkeyHandler>>

interface HotkeyOptions {
	context: HotkeyContextId
	handlers: HotkeyHandlers
	enabled?: boolean
	capture?: boolean
}

const SEQUENCE_TIMEOUT_MS = 500

export function useHotkeys({ context, handlers, enabled = true, capture = true }: HotkeyOptions) {
	const hotkeyMap = useAtomValue(hotkeyMapAtom)
	const handlersRef = useRef(handlers)
	const enabledRef = useRef(enabled)
	const mapRef = useRef(hotkeyMap)
	const sequenceRef = useRef<{ buffer: KeySequence; timeoutId: number | null }>({ buffer: [], timeoutId: null })

	useEffect(() => {
		handlersRef.current = handlers
	}, [handlers])

	useEffect(() => {
		enabledRef.current = enabled
		if (!enabled) {
			sequenceRef.current.buffer = []
			if (sequenceRef.current.timeoutId) {
				window.clearTimeout(sequenceRef.current.timeoutId)
				sequenceRef.current.timeoutId = null
			}
		}
	}, [enabled])

	useEffect(() => {
		mapRef.current = hotkeyMap
	}, [hotkeyMap])

	const actionsForContext = useMemo(
		() => hotkeyActionList.filter((action) => action.contexts.includes(context)),
		[context],
	)

	const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
		if (!enabledRef.current) return
		if (event.defaultPrevented || event.isComposing) return

		const combo = normalizeEvent(event)
		if (!combo) return

		const activeHandlers = handlersRef.current
		const activeMap = mapRef.current
		const activeActions = actionsForContext.filter((action) => activeHandlers[action.id])
		if (activeActions.length === 0) return

		const editableTarget = isEditableTarget(event.target)
		const bindings = activeActions.flatMap((action) => {
			if (editableTarget && !action.allowInInputs) return []
			return (activeMap[action.id] ?? []).map((sequence) => ({ action, sequence }))
		})
		if (bindings.length === 0) return

		const maxSequenceLength = bindings.reduce((max, { sequence }) => Math.max(max, sequence.length), 1)
		const nextBuffer = [...sequenceRef.current.buffer, combo].slice(-maxSequenceLength)

		const fullMatches = [] as Array<{
			actionId: HotkeyActionId
			sequence: KeySequence
			specificity: number
		}>

		for (const { action, sequence } of bindings) {
			if (sequenceMatches(sequence, nextBuffer)) {
				fullMatches.push({
					actionId: action.id,
					sequence,
					specificity: sequenceSpecificity(sequence),
				})
			}
		}

		const prefixBuffer = findLongestPrefixSuffix(
			nextBuffer,
			bindings.map((binding) => binding.sequence),
		)
		if (fullMatches.length > 0) {
			const hasLongerPrefix = prefixBuffer.length > 0
			if (!hasLongerPrefix) {
				fullMatches.sort((a, b) => {
					if (b.sequence.length !== a.sequence.length) return b.sequence.length - a.sequence.length
					return b.specificity - a.specificity
				})

				const winner = fullMatches[0]
				const handler = activeHandlers[winner.actionId]
				const handled = handler ? handler(event) !== false : false
				if (handled) {
					event.preventDefault()
				}
				if (sequenceRef.current.timeoutId) {
					window.clearTimeout(sequenceRef.current.timeoutId)
					sequenceRef.current.timeoutId = null
				}
				sequenceRef.current.buffer = []
				return
			}
		}

		if (prefixBuffer.length > 0) {
			sequenceRef.current.buffer = prefixBuffer
			if (sequenceRef.current.timeoutId) window.clearTimeout(sequenceRef.current.timeoutId)
			sequenceRef.current.timeoutId = window.setTimeout(() => {
				sequenceRef.current.buffer = []
			}, SEQUENCE_TIMEOUT_MS)
			return
		}
		if (sequenceRef.current.timeoutId) {
			window.clearTimeout(sequenceRef.current.timeoutId)
			sequenceRef.current.timeoutId = null
		}
		sequenceRef.current.buffer = []
	})

	useEffect(() => {
		if (!capture) return
		window.addEventListener("keydown", onKeyDown, { capture: true })
		return () => window.removeEventListener("keydown", onKeyDown, { capture: true })
	}, [capture, onKeyDown])
}

function findLongestPrefixSuffix(buffer: KeySequence, sequences: KeySequence[]): KeySequence {
	for (let start = 0; start < buffer.length; start += 1) {
		const suffix = buffer.slice(start)
		for (const sequence of sequences) {
			if (sequenceIsPrefix(sequence, suffix)) {
				return suffix
			}
		}
	}
	return []
}
