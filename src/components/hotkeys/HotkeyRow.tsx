import { ArrowCounterClockwiseIcon, PlusIcon } from "@phosphor-icons/react"
import { AnimatePresence } from "motion/react"
import type { ReactElement } from "react"
import { useMeasure } from "@/hooks/useMeasure"
import { serializeKeySequence } from "@/lib/hotkeys/format"
import type { HotkeyAction, HotkeyActionId, KeySequence } from "@/lib/hotkeys/types"
import { BindingButton } from "./BindingButton"
import { GapWrap } from "./GapWrap"

export interface HotkeyRowProps {
	action: HotkeyAction
	bindings: KeySequence[]
	conflicts: KeySequence[]
	isCapturing: boolean
	captureSequence: KeySequence
	isDefault: boolean
	onAdd: (actionId: HotkeyActionId) => void
	onRemove: (actionId: HotkeyActionId, index: number) => void
	onReset: (actionId: HotkeyActionId) => void
}

const IDLE_SIZE = 26
const GAP = 8

export function HotkeyRow({
	action,
	bindings,
	conflicts,
	isCapturing,
	captureSequence,
	isDefault,
	onAdd,
	onRemove,
	onReset,
}: HotkeyRowProps) {
	const [unboundMeasureRef, unboundBounds] = useMeasure<HTMLSpanElement>()
	const unboundWidth = unboundBounds.width > 0 ? Math.ceil(unboundBounds.width) : 0
	const items: Array<{ key: string; render: (leftGap: number) => ReactElement }> = []

	if (bindings.length === 0 && !isCapturing) {
		items.push({
			key: `${action.id}-unbound`,
			render: (leftGap) => (
				<GapWrap key={`${action.id}-unbound`} leftGap={leftGap} width={unboundWidth}>
					<span className="px-2 py-1 text-xs text-white/30 border border-white/10 bg-white/5 w-full box-border">
						Unbound
					</span>
				</GapWrap>
			),
		})
	}

	bindings.forEach((sequence, index) => {
		const bindingKey = serializeKeySequence(sequence)
		items.push({
			key: `${action.id}-${bindingKey}`,
			render: (leftGap) => (
				<BindingButton
					key={`${action.id}-${bindingKey}`}
					sequence={sequence}
					onRemove={() => onRemove(action.id, index)}
					idleSize={IDLE_SIZE}
					leftGap={leftGap}
				/>
			),
		})
	})

	if (isCapturing) {
		const captureKey = serializeKeySequence(captureSequence)
		items.push({
			key: `${action.id}-capture-${captureKey}`,
			render: (leftGap) => (
				<BindingButton
					key={`${action.id}-capture-${captureKey}`}
					sequence={captureSequence}
					isCapturing
					idleSize={IDLE_SIZE}
					leftGap={leftGap}
				/>
			),
		})
	}

	if (!isCapturing) {
		items.push({
			key: `${action.id}-add`,
			render: (leftGap) => (
				<GapWrap key={`${action.id}-add`} leftGap={leftGap} width={IDLE_SIZE}>
					<button
						type="button"
						onClick={() => onAdd(action.id)}
						className="inline-flex items-center justify-center text-xs border border-white/10 text-white/30 hover:border-emerald-400/50 hover:text-emerald-300 hover:bg-emerald-400/10 transition-colors overflow-hidden w-full box-border"
						style={{ height: IDLE_SIZE }}
					>
						<PlusIcon size={14} weight="bold" className="shrink-0" />
					</button>
				</GapWrap>
			),
		})
	}

	if (!isDefault && !isCapturing) {
		items.push({
			key: `${action.id}-reset`,
			render: (leftGap) => (
				<GapWrap key={`${action.id}-reset`} leftGap={leftGap} width={IDLE_SIZE}>
					<button
						type="button"
						onClick={() => onReset(action.id)}
						className="inline-flex items-center justify-center text-xs border border-white/10 text-white/30 hover:border-amber-400/50 hover:text-amber-300 hover:bg-amber-400/10 transition-colors overflow-hidden w-full box-border"
						style={{ height: IDLE_SIZE }}
						title="Reset to default"
					>
						<ArrowCounterClockwiseIcon size={14} weight="bold" className="shrink-0" />
					</button>
				</GapWrap>
			),
		})
	}

	return (
		<div className="relative px-5 py-4 flex items-start justify-between gap-6">
			<div className="space-y-1">
				<p className="text-sm text-white/70">{action.label}</p>
			</div>
			<div className="flex flex-col items-end gap-2">
				<span
					ref={unboundMeasureRef}
					className="absolute opacity-0 pointer-events-none whitespace-nowrap px-2 py-1 text-xs text-white/30 border border-white/10 bg-white/5"
				>
					Unbound
				</span>
				<div className="flex flex-wrap justify-end">
					<AnimatePresence>{items.map((item, index) => item.render(index === 0 ? 0 : GAP))}</AnimatePresence>
				</div>
				{conflicts.length > 0 && (
					<span className="text-[10px] uppercase tracking-wide text-amber-300/70">Conflict</span>
				)}
			</div>
		</div>
	)
}
