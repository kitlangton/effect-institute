import { RotatingAdjectivePair } from "@/components/chapters/RotatingAdjectives"

export function WelcomeBanner() {
	return (
		<div className="px-5 py-4 border-t border-[var(--border-subtle)] bg-white/[0.02]">
			<p className="text-sm text-white/70">
				<RotatingAdjectivePair /> Effect lessons
			</p>
			<p className="text-xs text-white/40 mt-0.5">Free, open source, and saved locally in your browser.</p>
		</div>
	)
}
