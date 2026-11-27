import { CheckIcon, CircleNotchIcon, SkullIcon, WarningIcon, XIcon } from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type Status = "idle" | "running" | "success" | "error" | "interrupted" | "die"
type Size = "sm" | "md" | "lg"

interface StatusIndicatorProps {
	status: Status
	size?: Size
	className?: string
}

const sizeClasses: Record<Size, string> = {
	sm: "w-3 h-3",
	md: "w-4 h-4",
	lg: "w-5 h-5",
}

const transition = { type: "spring" as const, stiffness: 400, damping: 25 }

const baseAnim = {
	initial: { scale: 0, filter: "blur(4px)", opacity: 0 },
	animate: { scale: 1, filter: "blur(0px)", opacity: 1 },
	exit: { scale: 0, filter: "blur(4px)", opacity: 0 },
}

// Phosphor icons sit slightly high; this nudges them down to align with text
const iconAlign = "translate-y-[0px]"

const icons: Record<Exclude<Status, "idle">, (size: Size) => ReactNode> = {
	running: (size) => (
		<CircleNotchIcon className={cn(sizeClasses[size], iconAlign, "animate-spin-fast text-blue-400")} weight="bold" />
	),
	success: (size) => <CheckIcon className={cn(sizeClasses[size], iconAlign, "text-emerald-400")} weight="bold" />,
	error: (size) => <XIcon className={cn(sizeClasses[size], iconAlign, "text-red-400")} weight="bold" />,
	interrupted: (size) => <WarningIcon className={cn(sizeClasses[size], iconAlign, "text-amber-400")} weight="fill" />,
	die: (size) => <SkullIcon className={cn(sizeClasses[size], iconAlign, "text-red-500")} weight="fill" />,
}

export function StatusIndicator({ status, size = "md", className }: StatusIndicatorProps) {
	return (
		<span className={cn("inline-flex items-center justify-center", sizeClasses[size], className)}>
			<AnimatePresence mode="popLayout">
				{status !== "idle" && (
					<motion.span
						key={status}
						className="inline-flex items-center justify-center"
						{...baseAnim}
						transition={transition}
					>
						{icons[status](size)}
					</motion.span>
				)}
			</AnimatePresence>
		</span>
	)
}
