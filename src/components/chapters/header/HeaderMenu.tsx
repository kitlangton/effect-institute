import { useAtomSet, useAtomValue } from "@effect/atom-react"
import {
	ArrowCounterClockwiseIcon,
	ChatCenteredDotsIcon,
	DiscordLogoIcon,
	KeyboardIcon,
	SlidersIcon,
} from "@phosphor-icons/react"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { PLAYBACK_RATES, type PlaybackRate } from "@/atoms/audioPlayer"
import { chapterAtom, completedSectionsFamily } from "@/atoms/narration"
import { resetAllProgressAtom } from "@/atoms/progress"
import {
	DropdownMenu,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Slider } from "@/components/ui/slider"
import { useClickSound } from "@/hooks/useClickSound"
import { usePlaybackRateControls } from "@/hooks/usePlaybackRateControls"
import { useVolumeControls } from "@/hooks/useVolumeControls"
import { NavIconButton } from "../NavIconButton"
import { NavDropdownContent, NavDropdownItem } from "./NavDropdown"

const DISCORD_URL = "https://discord.com/channels/795981131316985866/1449050466464956416"

interface HeaderMenuProps {
	openFeedback: () => void
}

export function HeaderMenu({ openFeedback }: HeaderMenuProps) {
	const { playbackRate, setPlaybackRate } = usePlaybackRateControls()
	const { volume, setVolume } = useVolumeControls()
	const chapter = useAtomValue(chapterAtom)
	const clearCompletedSections = useAtomSet(
		chapter ? completedSectionsFamily(chapter) : completedSectionsFamily("__none__"),
	)
	const resetAllProgress = useAtomSet(resetAllProgressAtom)
	const playClick = useClickSound()
	const [speedOpen, setSpeedOpen] = useState(false)

	const handleRateChange = (rate: PlaybackRate) => {
		setPlaybackRate(rate)
	}

	const formatRate = (rate: number) => (rate === 1 ? "1×" : `${rate}×`)

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<NavIconButton aria-label="Open menu" className="text-white/60" onClick={playClick}>
					<SlidersIcon size={16} weight="fill" />
				</NavIconButton>
			</DropdownMenuTrigger>
			<NavDropdownContent align="end" sideOffset={8} className="min-w-[180px]">
				{/* Speed submenu */}
				<DropdownMenuSub open={speedOpen} onOpenChange={setSpeedOpen}>
					<DropdownMenuSubTrigger
						className="px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 [&>svg:last-child]:hidden"
						onPointerEnter={() => setSpeedOpen(true)}
					>
						<span>Speed</span>
						<span className="ml-auto tabular-nums text-white/50">{formatRate(playbackRate)}</span>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						{PLAYBACK_RATES.map((rate) => {
							const active = playbackRate === rate
							return (
								<NavDropdownItem
									key={rate}
									onSelect={(event: Event) => {
										event.preventDefault()
										playClick()
										handleRateChange(rate)
									}}
									className={`tabular-nums ${active ? "text-white bg-white/10" : "text-white/70 hover:text-white"}`}
								>
									{formatRate(rate)}
								</NavDropdownItem>
							)
						})}
					</DropdownMenuSubContent>
				</DropdownMenuSub>

				<DropdownMenuSeparator className="bg-[var(--border-subtle)]" />

				{/* Volume slider */}
				<DropdownMenuLabel className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-[0.18em] text-white/50">
					Volume
				</DropdownMenuLabel>
				<div className="px-3 pb-3 pt-1">
					<Slider value={[volume]} onValueChange={([v]) => setVolume(v)} min={0} max={1} step={0.01} />
				</div>

				<DropdownMenuSeparator className="bg-[var(--border-subtle)]" />
				<NavDropdownItem asChild className="text-white/80 hover:text-white">
					<Link to="/hotkeys" onClick={playClick}>
						<KeyboardIcon size={16} weight="bold" />
						<span>Hotkeys</span>
					</Link>
				</NavDropdownItem>
				<NavDropdownItem
					onSelect={() => {
						playClick()
						openFeedback()
					}}
					className="text-white/80 hover:text-white"
				>
					<ChatCenteredDotsIcon size={16} weight="bold" />
					<span>Feedback</span>
				</NavDropdownItem>
				<NavDropdownItem asChild className="text-white/80 hover:text-white">
					<a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" onClick={playClick}>
						<DiscordLogoIcon size={16} weight="fill" />
						<span>Discord</span>
					</a>
				</NavDropdownItem>
				<DropdownMenuSeparator className="bg-[var(--border-subtle)]" />
				<NavDropdownItem
					onSelect={() => {
						playClick()
						resetAllProgress()
						clearCompletedSections(new Set())
					}}
					className="text-white/50 hover:text-red-300"
				>
					<ArrowCounterClockwiseIcon size={16} weight="bold" />
					<span>Reset progress</span>
				</NavDropdownItem>
			</NavDropdownContent>
		</DropdownMenu>
	)
}
