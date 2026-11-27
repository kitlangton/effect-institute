import { PulsingDotGrid } from "@/components/chapters/backgrounds/PulsingDotGrid"
import { RotatingBadge } from "@/components/narrated/RotatingBadge"

export function HeroBadge() {
	return (
		<div className="relative py-12 flex justify-center items-center">
			{/* Full area dot grid */}
			<PulsingDotGrid className="absolute inset-0 opacity-70" baseOpacity={0.1} />

			<div className="relative w-[260px] h-[260px] flex items-center justify-center z-20">
				{/* Dark radial shadow for depth (under badge only) */}
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0">
					<div className="w-[230px] h-[230px] rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(0,0,0,0.95)_0%,rgba(0,0,0,0.9)_55%,rgba(0,0,0,0.6)_75%,rgba(0,0,0,0)_100%)] blur-3xl" />
				</div>

				<RotatingBadge activeWord={-1} flowingGlow />
			</div>
		</div>
	)
}
