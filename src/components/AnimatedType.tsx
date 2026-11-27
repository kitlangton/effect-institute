import { DotsThreeIcon } from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"
import { springConfigs } from "../utils/animationConfigs"

export interface TypeSegment {
	id: string // Stable identifier for this segment
	content: React.ReactNode
	color: string
	isEllipsis?: boolean
}

interface AnimatedTypeProps {
	segments: TypeSegment[]
	className?: string
}

export function AnimatedType({ segments, className = "" }: AnimatedTypeProps) {
	const springConfig = springConfigs.smooth

	return (
		<div className="relative inline-flex items-center flex-wrap">
			<div className={`inline-flex items-center flex-wrap ${className}`}>
				<AnimatePresence mode="sync" initial={false}>
					{segments.map((segment) => (
						<motion.span
							key={segment.id}
							// NOTE(KIT): NEVER ANIMATE OPACITY!
							initial={{ filter: "blur(4px)", width: 0 }}
							animate={{
								filter: "blur(0px)",
								transition: springConfig,
								width: "auto",
							}}
							exit={{
								filter: "blur(4px)",
								width: 0,
								transition: { ...springConfig, visualDuration: 0.2 },
							}}
							className={
								segment.isEllipsis ? "inline-flex items-center" : "inline-block whitespace-pre-wrap sm:whitespace-pre"
							}
							style={{
								overflow: "hidden",
								color: segment.color,
								opacity: segment.isEllipsis ? 0.7 : 1,
								// Only hint compositor properties (not width)
								willChange: "opacity, filter",
								backfaceVisibility: "hidden",
								WebkitFontSmoothing: "antialiased",
							}}
						>
							{segment.isEllipsis ? (
								<DotsThreeIcon size={20} weight="bold" style={{ color: segment.color }} />
							) : (
								segment.content
							)}
						</motion.span>
					))}
				</AnimatePresence>
			</div>
		</div>
	)
}
