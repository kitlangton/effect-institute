import { NAV_BAR_HEIGHT } from "@/components/chapters/constants"
import type { HotkeyAction, HotkeyActionId, HotkeyCategory, HotkeyMap, KeySequence } from "@/lib/hotkeys/types"
import { HotkeyRow } from "./HotkeyRow"

export interface HotkeyGroupProps {
	category: HotkeyCategory
	actions: readonly HotkeyAction[]
	hotkeyMap: HotkeyMap
	conflictsByAction: ReadonlyMap<HotkeyActionId, KeySequence[]>
	captureTarget: HotkeyActionId | null
	captureSequence: KeySequence
	isDefaultForAction: (actionId: HotkeyActionId) => boolean
	onAdd: (actionId: HotkeyActionId) => void
	onRemove: (actionId: HotkeyActionId, index: number) => void
	onReset: (actionId: HotkeyActionId) => void
}

export function HotkeyGroup({
	category,
	actions,
	hotkeyMap,
	conflictsByAction,
	captureTarget,
	captureSequence,
	isDefaultForAction,
	onAdd,
	onRemove,
	onReset,
}: HotkeyGroupProps) {
	return (
		<div>
			<div
				className="border-y border-[var(--border-subtle)]"
				style={{
					height: NAV_BAR_HEIGHT / 2,
					backgroundImage:
						"repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(255,255,255,0.08) 12px, rgba(255,255,255,0.08) 13px)",
				}}
			/>
			<div
				className="px-5 flex items-center gap-2 border-b border-[var(--border-subtle)] bg-white/[0.04]"
				style={{ height: NAV_BAR_HEIGHT }}
			>
				<h2 className="text-xs uppercase tracking-[0.15em] text-white/50">{category}</h2>
			</div>
			<div className="divide-y divide-white/10">
				{actions.map((action) => (
					<HotkeyRow
						key={action.id}
						action={action}
						bindings={hotkeyMap[action.id] ?? []}
						conflicts={conflictsByAction.get(action.id) ?? []}
						isCapturing={captureTarget === action.id}
						captureSequence={captureSequence}
						isDefault={isDefaultForAction(action.id)}
						onAdd={onAdd}
						onRemove={onRemove}
						onReset={onReset}
					/>
				))}
			</div>
		</div>
	)
}
