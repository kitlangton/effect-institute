import { GithubLogoIcon, KeyboardIcon } from "@phosphor-icons/react"
import { Link } from "@tanstack/react-router"
import { useClickSound } from "@/hooks/useClickSound"
import { NavBarLink } from "../NavBarLink"
import { NavBarRow } from "../NavBarRow"

const REPO_URL = "https://github.com/kitlangton/effect-institute"

export function IndexNavBar() {
	const playClick = useClickSound()

	return (
		<NavBarRow className="border-b border-[var(--border-subtle)]">
			<NavBarLink to="/">Effect Institute</NavBarLink>
			<div className="flex items-center h-full border-l border-[var(--border-subtle)]">
				<Link
					to="/hotkeys"
					onClick={playClick}
					aria-label="Keyboard shortcuts"
					className="flex items-center gap-1.5 px-3 h-full text-xs text-white/50 hover:text-white hover:bg-white/6 uppercase tracking-wide"
				>
					<KeyboardIcon size={14} weight="fill" />
					<span className="hidden sm:inline">Hotkeys</span>
				</Link>
				<a
					href={REPO_URL}
					target="_blank"
					rel="noopener noreferrer"
					onClick={playClick}
					aria-label="GitHub repository"
					className="flex items-center gap-1.5 px-3 h-full border-l border-[var(--border-subtle)] text-xs text-white/50 hover:text-white hover:bg-white/6 uppercase tracking-wide"
				>
					<GithubLogoIcon size={14} weight="fill" />
					<span className="hidden sm:inline">GitHub</span>
				</a>
			</div>
		</NavBarRow>
	)
}
