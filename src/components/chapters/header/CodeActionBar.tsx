import { GithubLogoIcon } from "@phosphor-icons/react"
import { useClickSound } from "@/hooks/useClickSound"
import { NAV_BAR_HEIGHT } from "../constants"
import { RollingNotification } from "./RollingNotification"

const REPO_URL = "https://github.com/kitlangton/effect-institute"

export function CodeActionBar() {
	const playClick = useClickSound()

	return (
		<div
			className="absolute top-0 left-0 right-0 z-30 flex items-center bg-black border-b border-[var(--border-subtle)]"
			style={{ height: NAV_BAR_HEIGHT }}
		>
			<RollingNotification height={NAV_BAR_HEIGHT} />
			<div className="flex-1" />
			<a
				href={REPO_URL}
				target="_blank"
				rel="noopener noreferrer"
				onClick={playClick}
				aria-label="GitHub repository"
				className="flex items-center gap-1.5 px-3 h-full text-xs text-white/50 hover:text-white hover:bg-white/6 uppercase tracking-wide"
			>
				<GithubLogoIcon size={14} weight="fill" />
				<span>GitHub</span>
			</a>
		</div>
	)
}
