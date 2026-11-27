import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"
import type { AnimationSoundName } from "@/lib/animated-code/annotations"
import { animationSounds } from "@/sounds/AnimationSounds"
import { appSounds, COMPLETION_VARIANTS } from "@/sounds/AppSounds"

export const Route = createFileRoute("/debug/sounds")({
	beforeLoad: () => {
		if (!import.meta.env.DEV) {
			throw notFound()
		}
	},
	component: SoundboardPage,
	ssr: false, // Client-only - uses Web Audio APIs
})

const soundDescriptions: Record<AnimationSoundName, string> = {
	tick: "Subtle click sound",
	pop: "Gentle completion chime",
	whoosh: "Ascending pentatonic note",
	sad: "Melancholy sound (descending)",
	celebrate: "Triumphant sound (ascending)",
	chime: "Section completion chime",
	success: "Positive outcome (alias for celebrate)",
	error: "Negative outcome (alias for sad)",
	alarm: "Pager alert - alternating two notes",
	doom: "80s FM synth bass with pitch drop",
	spooky: "Mario ghost wobble - PWM with vibrato",
	press: "Key press sound",
	fail: "Deep bass failure sound",
	succeed: "Success chime - fixed pitch",
	ping1: "Ping at first pitch (low)",
	ping2: "Ping at second pitch (mid)",
	ping3: "Ping at third pitch (high)",
	derp: "Silly trombone (mocking)",
	skip: "Very subtle tick for skipping",
}

// Creative variations for doom and spooky sounds
const doomVariations = [
	{
		name: "doom-swell",
		label: "Doom Swell",
		description: "Inception BWAAAH horn",
		play: () => appSounds.playDoomSound(),
	},
	{
		name: "doom-heartbeat",
		label: "Doom Heartbeat",
		description: "Slowing heartbeat dies",
		play: () => appSounds.playDoomHeartbeat(),
	},
	{
		name: "doom-shatter",
		label: "Doom Shatter",
		description: "Glass breaking cascade",
		play: () => appSounds.playDoomShatter(),
	},
	{
		name: "doom-void",
		label: "Doom Void",
		description: "Sucked into black hole",
		play: () => appSounds.playDoomVoid(),
	},
] as const

const spookyVariations = [
	{
		name: "spooky-giggle",
		label: "Spooky Giggle",
		description: "Creepy rapid laughter",
		play: () => appSounds.playSpookySound(),
	},
	{
		name: "spooky-strings",
		label: "Spooky Strings",
		description: "Horror movie dissonance",
		play: () => appSounds.playSpookyStrings(),
	},
	{
		name: "spooky-wind",
		label: "Spooky Wind",
		description: "Wind through haunted ruins",
		play: () => appSounds.playSpookyWind(),
	},
	{
		name: "spooky-radio",
		label: "Spooky Radio",
		description: "Ghost voice on lo-fi AM",
		play: () => appSounds.playSpookyRadio(),
	},
] as const

const orchestralVariations = [
	{
		name: "violin-swell",
		label: "Violin Swell",
		description: "High singing string",
		play: () => appSounds.playViolinSwell(),
	},
	{
		name: "cello-swell",
		label: "Cello Swell",
		description: "Rich warm low string",
		play: () => appSounds.playCelloSwell(),
	},
	{
		name: "strings-swell",
		label: "Full Strings",
		description: "Dramatic chord - behold!",
		play: () => appSounds.playStringsSwell(),
	},
	{
		name: "rising-strings",
		label: "Rising Strings",
		description: "Upward swell for reveals",
		play: () => appSounds.playRisingStrings(),
	},
] as const

function SoundboardPage() {
	const [lastPlayed, setLastPlayed] = useState<string | null>(null)
	const [playing, setPlaying] = useState<string | null>(null)

	const playSound = async (name: string, playFn: () => Promise<void>) => {
		setPlaying(name)
		setLastPlayed(name)
		try {
			await playFn()
		} finally {
			// Brief delay before clearing playing state for visual feedback
			setTimeout(() => setPlaying(null), 150)
		}
	}

	const soundNames = Object.keys(animationSounds) as AnimationSoundName[]

	return (
		<div className="min-h-screen bg-black text-white p-8">
			<div className="max-w-2xl mx-auto space-y-8">
				<div>
					<h1 className="text-2xl font-bold mb-2">🔊 Animation Soundboard</h1>
					<p className="text-white/60 text-sm">
						Click any sound to play it. These are the sounds available for animation steps via{" "}
						<code className="text-blue-400">.sound()</code>.
					</p>
				</div>

				{/* Sound grid */}
				<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
					{soundNames.map((name) => (
						<button
							key={name}
							onClick={() => playSound(name, animationSounds[name])}
							className={`
								relative p-4 rounded-lg border text-left transition-all
								${
									playing === name
										? "bg-blue-600 border-blue-400 scale-95"
										: lastPlayed === name
											? "bg-white/10 border-blue-500"
											: "bg-white/5 border-white/20 hover:border-white/40 hover:bg-white/10"
								}
							`}
						>
							<div className="font-mono font-medium text-sm mb-1">{name}</div>
							<div className="text-xs text-white/50">{soundDescriptions[name]}</div>
							{playing === name && (
								<div className="absolute top-2 right-2 w-2 h-2 bg-blue-400 rounded-full animate-ping" />
							)}
						</button>
					))}
				</div>

				{/* Doom Variations */}
				<div>
					<h2 className="text-lg font-semibold mb-3 text-white/80">💀 Doom Variations</h2>
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
						{doomVariations.map((v) => (
							<button
								key={v.name}
								onClick={() => playSound(v.name, v.play)}
								className={`
									relative p-3 rounded-lg border text-left transition-all
									${
										playing === v.name
											? "bg-red-600 border-red-400 scale-95"
											: lastPlayed === v.name
												? "bg-white/10 border-red-500"
												: "bg-white/5 border-white/20 hover:border-white/40 hover:bg-white/10"
									}
								`}
							>
								<div className="font-mono font-medium text-sm mb-1">{v.label}</div>
								<div className="text-xs text-white/50">{v.description}</div>
								{playing === v.name && (
									<div className="absolute top-2 right-2 w-2 h-2 bg-red-400 rounded-full animate-ping" />
								)}
							</button>
						))}
					</div>
				</div>

				{/* Spooky Variations */}
				<div>
					<h2 className="text-lg font-semibold mb-3 text-white/80">👻 Spooky Variations</h2>
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
						{spookyVariations.map((v) => (
							<button
								key={v.name}
								onClick={() => playSound(v.name, v.play)}
								className={`
									relative p-3 rounded-lg border text-left transition-all
									${
										playing === v.name
											? "bg-purple-600 border-purple-400 scale-95"
											: lastPlayed === v.name
												? "bg-white/10 border-purple-500"
												: "bg-white/5 border-white/20 hover:border-white/40 hover:bg-white/10"
									}
								`}
							>
								<div className="font-mono font-medium text-sm mb-1">{v.label}</div>
								<div className="text-xs text-white/50">{v.description}</div>
								{playing === v.name && (
									<div className="absolute top-2 right-2 w-2 h-2 bg-purple-400 rounded-full animate-ping" />
								)}
							</button>
						))}
					</div>
				</div>

				{/* Orchestral Variations */}
				<div>
					<h2 className="text-lg font-semibold mb-3 text-white/80">🎻 Orchestral Swells</h2>
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
						{orchestralVariations.map((v) => (
							<button
								key={v.name}
								onClick={() => playSound(v.name, v.play)}
								className={`
									relative p-3 rounded-lg border text-left transition-all
									${
										playing === v.name
											? "bg-amber-600 border-amber-400 scale-95"
											: lastPlayed === v.name
												? "bg-white/10 border-amber-500"
												: "bg-white/5 border-white/20 hover:border-white/40 hover:bg-white/10"
									}
								`}
							>
								<div className="font-mono font-medium text-sm mb-1">{v.label}</div>
								<div className="text-xs text-white/50">{v.description}</div>
								{playing === v.name && (
									<div className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full animate-ping" />
								)}
							</button>
						))}
					</div>
				</div>

				{/* Celebration Scale */}
				<div>
					<h2 className="text-lg font-semibold mb-3 text-white/80">🎉 Celebration Triads (Group Complete)</h2>
					<p className="text-white/50 text-sm mb-3">Ascending major triads for group completion sequences.</p>
					<div className="flex flex-wrap gap-2">
						{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
							<button
								key={i}
								onClick={() => playSound(`celebration-${i}`, () => appSounds.playCelebrationNote(i))}
								className={`
									px-3 py-2 rounded-lg border transition-all font-mono text-sm
									${
										playing === `celebration-${i}`
											? "bg-emerald-600 border-emerald-400 scale-95"
											: "bg-white/5 border-white/20 hover:border-white/40 hover:bg-white/10"
									}
								`}
							>
								{i}
							</button>
						))}
						<button
							onClick={async () => {
								setPlaying("celebration-all")
								for (let i = 0; i < 5; i++) {
									await appSounds.playCelebrationNote(i)
									await new Promise((r) => setTimeout(r, 250))
								}
								setPlaying(null)
							}}
							className={`
								px-4 py-2 rounded-lg border transition-all
								${
									playing === "celebration-all"
										? "bg-emerald-600 border-emerald-400 scale-95"
										: "bg-emerald-500/20 border-emerald-500 hover:bg-emerald-500/30"
								}
							`}
						>
							Play Sequence (5)
						</button>
					</div>
				</div>

				{/* Single Note Dings */}
				<div>
					<h2 className="text-lg font-semibold mb-3 text-white/80">🔔 Single Note Dings</h2>
					<p className="text-white/50 text-sm mb-3">Simple one-note completion sounds. XP/level-up style.</p>
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
						{COMPLETION_VARIANTS.filter((v) => v.key.startsWith("ding-")).map((v) => (
							<button
								key={v.key}
								onClick={() => playSound(v.key, () => appSounds.playCompletionVariant(v.key))}
								className={`
									relative p-3 rounded-lg border text-left transition-all
									${
										playing === v.key
											? "bg-yellow-600 border-yellow-400 scale-95"
											: lastPlayed === v.key
												? "bg-white/10 border-yellow-500"
												: "bg-white/5 border-white/20 hover:border-white/40 hover:bg-white/10"
									}
								`}
							>
								<div className="font-mono font-medium text-sm mb-1">{v.label}</div>
								<div className="text-xs text-white/50">{v.description}</div>
								{playing === v.key && (
									<div className="absolute top-2 right-2 w-2 h-2 bg-yellow-400 rounded-full animate-ping" />
								)}
							</button>
						))}
					</div>
				</div>

				{/* Completion Sound Variants - Different synth settings */}
				<div>
					<h2 className="text-lg font-semibold mb-3 text-white/80">✅ Two-Note Completion Variants</h2>
					<p className="text-white/50 text-sm mb-3">Ascending intervals for section completion.</p>
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
						{COMPLETION_VARIANTS.filter((v) => !v.key.startsWith("ding-")).map((v) => (
							<button
								key={v.key}
								onClick={() => playSound(v.key, () => appSounds.playCompletionVariant(v.key))}
								className={`
									relative p-3 rounded-lg border text-left transition-all
									${
										playing === v.key
											? "bg-green-600 border-green-400 scale-95"
											: lastPlayed === v.key
												? "bg-white/10 border-green-500"
												: "bg-white/5 border-white/20 hover:border-white/40 hover:bg-white/10"
									}
								`}
							>
								<div className="font-mono font-medium text-sm mb-1">{v.label}</div>
								<div className="text-xs text-white/50">{v.description}</div>
								{playing === v.key && (
									<div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-ping" />
								)}
							</button>
						))}
					</div>
				</div>

				{/* Last played indicator */}
				{lastPlayed && (
					<div className="text-center text-white/40 text-sm">
						Last played: <span className="font-mono text-white/60">{lastPlayed}</span>
					</div>
				)}

				{/* Usage hint */}
				<div className="border border-[var(--border-subtle)] rounded-lg p-4 bg-white/5">
					<h2 className="font-medium mb-2 text-white/80">Usage in DSL</h2>
					<pre className="text-sm text-white/60 font-mono overflow-x-auto">
						{`on("word")
  .slots({ type: "error" })
  .sound("${lastPlayed || "doom"}")`}
					</pre>
				</div>
			</div>
		</div>
	)
}
