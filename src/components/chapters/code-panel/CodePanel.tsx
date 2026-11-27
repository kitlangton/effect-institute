import { useEffect, useRef } from "react"
import type { SectionData } from "@/atoms/narration"
import { NAV_BAR_HEIGHT } from "../constants"
import { CodeActionBar } from "../header/CodeActionBar"
import { CodePanelContent } from "./CodePanelContent"

interface CodePanelProps {
	section: SectionData
	sectionIndex: number
}

export function CodePanel({ section, sectionIndex }: CodePanelProps) {
	const scrollRef = useRef<HTMLDivElement>(null)

	// Reset scroll position when section changes
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollLeft = 0
		}
	}, [section.id])

	return (
		<div
			className="flex flex-col items-center justify-center flex-1 min-w-0 relative"
			style={{
				fontSize: "var(--code-text-size)",
				lineHeight: "var(--code-line-height)",
				paddingTop: NAV_BAR_HEIGHT,
			}}
		>
			<CodeActionBar />
			<div ref={scrollRef} className="w-full h-full overflow-auto hide-scrollbar flex items-center justify-center">
				<CodePanelContent section={section} sectionIndex={sectionIndex} />
			</div>

			{/* Right fade overlay */}
			<div
				className="absolute top-0 right-0 bottom-0 w-16 pointer-events-none z-10"
				style={{
					background: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.8) 100%)",
				}}
			/>
			{/* Bottom gradient fade */}
			<div
				className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none z-10"
				style={{
					background: "linear-gradient(to bottom, transparent 0%, black 100%)",
				}}
			/>
		</div>
	)
}
