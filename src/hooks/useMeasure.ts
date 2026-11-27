import { useLayoutEffect, useRef, useState } from "react"

export function useMeasure<T extends HTMLElement>() {
	const ref = useRef<T>(null)
	const [bounds, setBounds] = useState({ width: 0, height: 0 })

	useLayoutEffect(() => {
		if (!ref.current) return
		const resizeObserver = new ResizeObserver(([entry]) => {
			if (entry) {
				setBounds({
					width: entry.contentRect.width,
					height: entry.contentRect.height,
				})
			}
		})
		resizeObserver.observe(ref.current)
		return () => resizeObserver.disconnect()
	}, [])

	return [ref, bounds] as const
}
