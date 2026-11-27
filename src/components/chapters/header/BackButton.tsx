import { HouseIcon } from "@phosphor-icons/react"
import { Link } from "@tanstack/react-router"
import React, { useCallback } from "react"
import { useClickSound } from "@/hooks/useClickSound"
import { NAV_BAR_HEIGHT } from "../constants"

export const BackButton = React.memo(function BackButton() {
	const playClick = useClickSound()
	const handleClick = useCallback(() => {
		playClick()
	}, [playClick])

	return (
		<Link
			to="/"
			onClick={handleClick}
			className="flex items-center justify-center text-white/60 hover:text-white hover:bg-white/6 cursor-auto"
			style={{ width: NAV_BAR_HEIGHT, height: NAV_BAR_HEIGHT - 1 }}
			aria-label="Back to home"
		>
			<HouseIcon size={16} weight="fill" />
		</Link>
	)
})
