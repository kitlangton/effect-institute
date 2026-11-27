import type React from "react"
import { forwardRef, memo } from "react"
import { cn } from "@/lib/utils"
import { NAV_BAR_HEIGHT } from "./constants"

interface NavIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	heightOffset?: number
	offsetTop?: number
}

export const NavIconButton = memo(
	forwardRef<HTMLButtonElement, NavIconButtonProps>(
		({ className, style, heightOffset = 1, offsetTop = 0, type, ...props }, ref) => (
			<button
				ref={ref}
				type={type ?? "button"}
				className={cn("flex items-center justify-center hover:text-white hover:bg-white/6", className)}
				style={{
					width: NAV_BAR_HEIGHT,
					height: NAV_BAR_HEIGHT - heightOffset,
					marginTop: offsetTop,
					...style,
				}}
				{...props}
			/>
		),
	),
)

NavIconButton.displayName = "NavIconButton"
