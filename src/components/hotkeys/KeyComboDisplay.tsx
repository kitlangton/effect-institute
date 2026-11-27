import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon } from "@phosphor-icons/react"
import type { ReactNode } from "react"
import { getKeyParts } from "@/lib/hotkeys/format"
import type { KeyCombo } from "@/lib/hotkeys/types"

const KEY_ICONS: Record<string, ReactNode> = {
	Left: <ArrowLeftIcon size={12} weight="bold" className="inline -mt-0.5" />,
	Right: <ArrowRightIcon size={12} weight="bold" className="inline -mt-0.5" />,
	Up: <ArrowUpIcon size={12} weight="bold" className="inline -mt-0.5" />,
	Down: <ArrowDownIcon size={12} weight="bold" className="inline -mt-0.5" />,
}

export function KeyComboDisplay({ combo }: { combo: KeyCombo }) {
	const parts = getKeyParts(combo)
	return (
		<>
			{parts.map((part, i) => (
				<span key={i}>
					{i > 0 && <span className="text-white/30">+</span>}
					{KEY_ICONS[part] ?? part}
				</span>
			))}
		</>
	)
}
