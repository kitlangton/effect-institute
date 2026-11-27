import { motion } from "motion/react"
import type { ReactNode } from "react"

const widthTransition = { type: "spring" as const, visualDuration: 0.2, bounce: 0 }

export interface GapWrapProps {
	leftGap: number
	width: number
	children: ReactNode
}

export function GapWrap({ leftGap, width, children }: GapWrapProps) {
	return (
		<motion.span
			initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)", width: 0, paddingLeft: 0 }}
			animate={{
				opacity: 1,
				scale: 1,
				filter: "blur(0px)",
				width: width + leftGap,
				paddingLeft: leftGap,
			}}
			exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)", width: 0, paddingLeft: 0 }}
			transition={widthTransition}
			className="inline-flex overflow-hidden box-border"
		>
			<span className="inline-flex w-full">{children}</span>
		</motion.span>
	)
}
