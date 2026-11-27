import { DiscordLogoIcon, GitMergeIcon, HeartIcon } from "@phosphor-icons/react"
import { Link } from "@tanstack/react-router"
import React from "react"
import { useClickSound } from "@/hooks/useClickSound"

interface FooterLinksProps {
	uppercase?: boolean
}

export const FooterLinks = React.memo(function FooterLinks({ uppercase = false }: FooterLinksProps) {
	const playClick = useClickSound()
	const changelogLabel = uppercase ? "CHANGELOG" : "Changelog"
	const discordLabel = uppercase ? "DISCORD" : "Discord"
	const kitLabel = uppercase ? "KIT" : "Kit"

	return (
		<>
			<Link
				to="/changelog"
				onClick={playClick}
				className="flex items-center gap-1.5 px-3 sm:px-4 h-full text-xs text-white/50 hover:text-white hover:bg-white/6 uppercase tracking-wide cursor-default"
			>
				<GitMergeIcon size={14} weight="fill" className="text-white/30" />
				<span className="hidden sm:inline">{changelogLabel}</span>
			</Link>
			<a
				href="https://discord.com/channels/795981131316985866/1449050466464956416"
				target="_blank"
				rel="noopener noreferrer"
				onClick={playClick}
				className="flex items-center gap-1.5 px-3 sm:px-4 h-full text-xs text-white/50 hover:text-white hover:bg-white/6 uppercase tracking-wide cursor-default"
			>
				<DiscordLogoIcon size={14} weight="fill" className="text-white/30" />
				<span className="hidden sm:inline">{discordLabel}</span>
			</a>
			<a
				href="https://x.com/kitlangton"
				target="_blank"
				rel="noopener noreferrer"
				onClick={playClick}
				className="group flex items-center gap-1.5 px-3 sm:px-4 h-full text-xs text-white/50 hover:text-white hover:bg-white/6 uppercase tracking-wide cursor-default"
			>
				<HeartIcon size={12} weight="fill" className="text-white/30 group-hover:text-red-500" />
				<span className="hidden sm:inline">{kitLabel}</span>
			</a>
		</>
	)
})
