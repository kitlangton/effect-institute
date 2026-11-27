import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"
import { NAV_BAR_HEIGHT } from "./constants"

interface NavBarRowProps extends HTMLAttributes<HTMLDivElement> {}

export function NavBarRow({ className, style, ...props }: NavBarRowProps) {
	return (
		<div
			className={cn("flex-none bg-black flex items-center justify-between", className)}
			style={{ height: NAV_BAR_HEIGHT, ...style }}
			{...props}
		/>
	)
}
