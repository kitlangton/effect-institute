import type { ComponentPropsWithoutRef } from "react"
import { DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type DropdownMenuContentProps = ComponentPropsWithoutRef<typeof DropdownMenuContent>
type DropdownMenuItemProps = ComponentPropsWithoutRef<typeof DropdownMenuItem>

export function NavDropdownContent({ className, ...props }: DropdownMenuContentProps) {
	return (
		<DropdownMenuContent
			{...props}
			className={cn("bg-black border border-[var(--border-subtle)] shadow-xl p-0 rounded-none", className)}
		/>
	)
}

export function NavDropdownItem({ className, ...props }: DropdownMenuItemProps) {
	return (
		<DropdownMenuItem
			{...props}
			className={cn("px-3 py-2 text-sm text-white/70 hover:text-white flex items-center gap-2", className)}
		/>
	)
}
