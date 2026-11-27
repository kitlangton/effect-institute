"use client"

import type { FrameLine, SpotlightConfig, StatusConfig } from "../types"
import { LineParts } from "./LineParts"

interface MeasurementLineProps {
	line: FrameLine
	lineIndex: number
	spotlight?: SpotlightConfig
	status?: StatusConfig
}

/**
 * Hidden, static line used for stable cursor measurement.
 * Renders once per active cursor line to avoid width-animation artifacts.
 */
export function MeasurementLine({ line, lineIndex, spotlight, status }: MeasurementLineProps) {
	return (
		<div
			data-measure-line-id={line.lineId}
			aria-hidden="true"
			className="absolute inset-0 pointer-events-none select-none flex items-baseline"
			style={{ visibility: "hidden" }}
		>
			<LineParts
				line={line}
				lineIndex={lineIndex}
				renderMode="static"
				{...(spotlight !== undefined && { spotlight })}
				{...(status !== undefined && { status })}
			/>
		</div>
	)
}
