import { useAtomValue } from "@effect/atom-react"
import { contextMenuTargetAtom } from "@/atoms/cursor"
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu"

interface SectionContextMenuProps {
	chapter: string
	onFeedback: (sectionId: string) => void
	onOpenInEditor: (path: string) => void
	onCopyPath: (path: string) => void
	children: React.ReactNode
}

/**
 * Shared context menu for all sections.
 * Reads from contextMenuTargetAtom to determine which section was right-clicked.
 */
export function SectionContextMenu({
	chapter,
	onFeedback,
	onOpenInEditor,
	onCopyPath,
	children,
}: SectionContextMenuProps) {
	const target = useAtomValue(contextMenuTargetAtom)
	const isDev = import.meta.env.DEV

	const dslPath = target.type === "section" ? `content/${chapter}/${target.sectionId}.ts` : null

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent>
				{target.type === "section" && dslPath && (
					<>
						<ContextMenuItem onSelect={() => onFeedback(target.sectionId)}>Leave feedback</ContextMenuItem>
						{isDev && (
							<>
								<ContextMenuSeparator />
								<ContextMenuLabel>Dev actions</ContextMenuLabel>
								<ContextMenuItem onSelect={() => onOpenInEditor(dslPath)}>Open in editor</ContextMenuItem>
								<ContextMenuItem onSelect={() => onCopyPath(dslPath)}>Copy file path</ContextMenuItem>
							</>
						)}
					</>
				)}
			</ContextMenuContent>
		</ContextMenu>
	)
}
