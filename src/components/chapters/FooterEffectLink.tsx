import { SkullIcon } from "@phosphor-icons/react"
import { useClickSound } from "@/hooks/useClickSound"
import { cn } from "@/lib/utils"

interface FooterEffectLinkProps {
	className?: string
}

export function FooterEffectLink({ className }: FooterEffectLinkProps) {
	const playClick = useClickSound()

	return (
		<a
			href="https://effect.website"
			target="_blank"
			rel="noopener noreferrer"
			onClick={playClick}
			className={cn(
				"flex items-center px-3 sm:px-4 h-full text-xs text-white/50 hover:text-white hover:bg-white/6 uppercase tracking-wide cursor-default",
				className,
			)}
		>
			<span className="hidden sm:inline">Effect or&nbsp;</span>
			<SkullIcon size={14} weight="fill" />
		</a>
	)
}
