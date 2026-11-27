import { createFileRoute } from "@tanstack/react-router"
import { OGFrame } from "./-frame"

export const Route = createFileRoute("/og/home")({
	component: HomeOGTemplate,
})

function HomeOGTemplate() {
	return (
		<OGFrame>
			<div>
				<div className="flex items-center justify-between">
					<span className="text-[80px] font-bold leading-[1] tracking-[0.02em] text-white uppercase">EFFECT</span>
					<span className="text-[80px] font-bold leading-[1] tracking-[0.02em] text-white uppercase">INSTITUTE</span>
				</div>
				<div className="mt-6 flex flex-col gap-2 text-[26px] tracking-[0.15em] text-white/50 uppercase">
					<div className="flex justify-between">
						<span>ERRORS</span>
						<span>SERVICES</span>
						<span>LAYERS</span>
						<span>CONTEXT</span>
					</div>
					<div className="flex justify-between">
						<span>STREAMS</span>
						<span>FIBERS</span>
						<span>CONCURRENCY</span>
						<span>RETRIES</span>
					</div>
					<div className="flex justify-between">
						<span>RESOURCES</span>
						<span>SCHEDULING</span>
						<span>TESTING</span>
						<span>TRACING</span>
					</div>
				</div>
			</div>
			<div className="flex items-center gap-6 text-[18px] tracking-[0.2em] text-white/40">
				<span className="flex-1 border-t border-white/20" />
				<span>TAKE THE EFFECT PILL</span>
				<span className="flex-1 border-t border-white/20" />
			</div>
		</OGFrame>
	)
}
