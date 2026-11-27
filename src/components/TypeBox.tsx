export type ResultStatus = "neutral" | "success" | "error"

import { AnimatedType, type TypeSegment } from "./AnimatedType"
import { FlashOnChange } from "./FlashOnChange"

const STATUS_STYLES: Record<
	ResultStatus,
	{
		backgroundColor: string
		textClass: string
		borderColor?: string
	}
> = {
	neutral: {
		backgroundColor: "rgb(10,10,10)",
		textClass: "text-neutral-100",
	},
	success: {
		backgroundColor: "rgb(12,29,18)",
		textClass: "text-neutral-100",
		borderColor: "rgba(34,197,94,0.35)",
	},
	error: {
		backgroundColor: "rgb(34,20,20)",
		textClass: "text-neutral-100",
		borderColor: "rgba(248,113,113,0.35)",
	},
}

interface TypeBoxProps {
	segments: TypeSegment[]
	triggerKey: string
	borderColor: string
	className?: string
	status?: ResultStatus | undefined
}

export function TypeBox({ segments, triggerKey, borderColor, className = "", status = "neutral" }: TypeBoxProps) {
	const statusStyles = STATUS_STYLES[status]
	const resolvedBorderColor = statusStyles.borderColor ?? borderColor
	const resolvedBackgroundColor = statusStyles.backgroundColor

	return (
		<FlashOnChange
			triggerKey={triggerKey}
			className={`relative flex items-center flex-wrap justify-center px-5 py-4 border transition-colors duration-500 ${statusStyles.textClass} ${className}`}
			style={{
				borderColor: resolvedBorderColor,
				backgroundColor: resolvedBackgroundColor,
				transition: "background-color 400ms ease, border-color 400ms ease",
			}}
		>
			<AnimatedType segments={segments} className="font-mono text-sm sm:text-base md:text-lg" />
		</FlashOnChange>
	)
}
