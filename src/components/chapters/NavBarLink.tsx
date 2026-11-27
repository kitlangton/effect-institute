import { Link, type LinkProps } from "@tanstack/react-router"
import { useClickSound } from "@/hooks/useClickSound"
import { cn } from "@/lib/utils"

type NavBarLinkProps = LinkProps & {
	className?: string
	onClick?: () => void
}

export function NavBarLink({ className, onClick, ...props }: NavBarLinkProps) {
	const playClick = useClickSound()

	const handleClick = () => {
		playClick()
		onClick?.()
	}

	return (
		<span onClick={handleClick} className="contents">
			<Link
				{...props}
				className={cn(
					"flex items-center px-4 h-full text-xs font-bold text-white/60 hover:text-white/80 uppercase tracking-wide cursor-default",
					className,
				)}
			/>
		</span>
	)
}
