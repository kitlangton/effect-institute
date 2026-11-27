import * as ContextMenuPrimitive from "@radix-ui/react-context-menu"
import * as React from "react"

import { cn } from "@/lib/utils"

const ContextMenu = ContextMenuPrimitive.Root

const ContextMenuTrigger = ContextMenuPrimitive.Trigger

const ContextMenuContent = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
	<ContextMenuPrimitive.Portal>
		<ContextMenuPrimitive.Content
			ref={ref}
			className={cn(
				"z-50 min-w-[12rem] overflow-hidden rounded-none border border-[var(--border-subtle)] bg-black/95 p-1 text-white shadow-lg backdrop-blur",
				"data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
				className,
			)}
			{...props}
		/>
	</ContextMenuPrimitive.Portal>
))
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName

const ContextMenuItem = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.Item>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
		inset?: boolean
		variant?: "default" | "destructive"
	}
>(({ className, inset, variant = "default", ...props }, ref) => (
	<ContextMenuPrimitive.Item
		ref={ref}
		data-variant={variant}
		className={cn(
			"relative flex cursor-default select-none items-center gap-2 rounded-none px-2 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
			"focus:bg-white/10 data-[variant=destructive]:text-red-400 data-[variant=destructive]:focus:bg-red-500/15",
			inset && "pl-8",
			className,
		)}
		{...props}
	/>
))
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName

const ContextMenuLabel = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.Label>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & {
		inset?: boolean
	}
>(({ className, inset, ...props }, ref) => (
	<ContextMenuPrimitive.Label
		ref={ref}
		className={cn("px-3 py-2 text-xs uppercase tracking-[0.14em] text-white/50", inset && "pl-8", className)}
		{...props}
	/>
))
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName

const ContextMenuSeparator = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.Separator>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
	<ContextMenuPrimitive.Separator
		ref={ref}
		className={cn("my-1 h-px bg-[var(--border-subtle)]", className)}
		{...props}
	/>
))
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName

export { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger }
