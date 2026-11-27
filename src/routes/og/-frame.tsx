import { type CSSProperties, type ReactNode, useId } from "react"

const WIDTH = 1200
const HEIGHT = 630

export function OGFrame({ children }: { children: ReactNode }) {
	const maskId = useId()

	return (
		<section
			className="flex items-center justify-center bg-[#010102] p-8"
			style={{ width: `${WIDTH}px`, height: `${HEIGHT}px`, boxSizing: "border-box" }}
		>
			<div
				className="relative flex h-full w-full flex-col overflow-hidden border border-white/20 text-[18px] uppercase tracking-[0.32em]"
				style={{ background: "#030405" }}
			>
				<div className="relative z-10 flex h-full flex-col justify-between">
					{/* Header */}
					<div className="grid grid-cols-2 border-b border-white/20">
						<Cell>
							<div className="flex items-center gap-3">
								<span>EFFECT.INSTITUTE</span>
							</div>
						</Cell>
						<Cell className="justify-end text-white/60">
							<div className="flex items-center gap-3">
								<span>SEMI-INTERACTIVE LESSONS</span>
							</div>
						</Cell>
					</div>

					{/* Center content - split layout */}
					<div className="flex flex-1 overflow-hidden">
						{/* Left - two stacked squares */}
						<div className="flex flex-col border-r border-white/20" style={{ width: "220px" }}>
							<div
								className="flex items-center justify-center border-b border-white/20 overflow-hidden"
								style={{ width: "220px", height: "220px" }}
							>
								<svg width="218" height="218" viewBox="0 0 218 218" style={{ margin: "1px" }}>
									<defs>
										<mask id={maskId}>
											<rect width="218" height="218" fill="white" />
											<rect x="0" y="0" width="218" height="2" fill="black" />
											<rect x="0" y="216" width="218" height="2" fill="black" />
											<rect x="0" y="0" width="2" height="218" fill="black" />
											<rect x="216" y="0" width="2" height="218" fill="black" />
										</mask>
									</defs>
									<g mask={`url(#${maskId})`}>
										<ConcentricRings cx={109} cy={109} scale={0.4} />
									</g>
								</svg>
							</div>
							<div
								className="flex items-center justify-center overflow-hidden"
								style={{ width: "220px", height: "220px" }}
							>
								<svg width="220" height="220" viewBox="0 0 220 220">
									<EffectNode cx={61} cy={61} size={76} state="idle" />
									<EffectNode cx={159} cy={61} size={76} state="success" />
									<EffectNode cx={61} cy={159} size={76} state="failed" />
									<EffectNode cx={159} cy={159} size={76} state="interrupted" />
								</svg>
							</div>
						</div>

						{/* Right - page-specific content */}
						<div
							className="flex flex-1 flex-col justify-between px-10 py-10"
							style={{ fontFamily: "'Commit Mono', ui-monospace, monospace" }}
						>
							{children}
						</div>
					</div>

					{/* Footer with diagonal stripes */}
					<div className="relative border-t border-white/20" style={{ height: "60px" }}>
						<div
							className="absolute inset-0"
							style={{
								backgroundImage:
									"repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(255,255,255,0.2) 12px, rgba(255,255,255,0.2) 13px)",
								marginTop: "1px",
							}}
						/>
					</div>
				</div>
			</div>
		</section>
	)
}

type EffectState = "idle" | "success" | "failed" | "interrupted"

const STATE_COLORS: Record<EffectState, { fill: string; border: string }> = {
	idle: { fill: "#27272a", border: "rgba(255,255,255,0.15)" },
	success: { fill: "#16a34a", border: "rgba(74,222,128,0.7)" },
	failed: { fill: "#dc2626", border: "rgba(248,113,113,0.7)" },
	interrupted: { fill: "#ea580c", border: "rgba(251,146,60,0.7)" },
}

const STATE_ICONS: Record<EffectState, { path: string; stroke?: boolean }> = {
	idle: {
		path: "M240,128a15.79,15.79,0,0,1-10.5,15l-63.44,23.07L143,229.5a16,16,0,0,1-30,0L89.94,166.06,26.5,143a16,16,0,0,1,0-30L89.94,89.94,113,26.5a16,16,0,0,1,30,0l23.07,63.44L229.5,113A15.79,15.79,0,0,1,240,128Z",
	},
	success: {
		path: "M40 144 L96 200 L224 72",
		stroke: true,
	},
	failed: {
		path: "M128,16C70.65,16,24,60.86,24,116c0,34.1,18.27,66,48,84.28V216a16,16,0,0,0,16,16h8a4,4,0,0,0,4-4V200.27a8.17,8.17,0,0,1,7.47-8.25,8,8,0,0,1,8.53,8v28a4,4,0,0,0,4,4h16a4,4,0,0,0,4-4V200.27a8.17,8.17,0,0,1,7.47-8.25,8,8,0,0,1,8.53,8v28a4,4,0,0,0,4,4h8a16,16,0,0,0,16-16V200.28C213.73,182,232,150.1,232,116,232,60.86,185.35,16,128,16ZM92,152a20,20,0,1,1,20-20A20,20,0,0,1,92,152Zm72,0a20,20,0,1,1,20-20A20,20,0,0,1,164,152Z",
	},
	interrupted: {
		path: "M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z",
	},
}

function EffectNode({
	cx,
	cy,
	size = 64,
	state = "idle",
}: {
	cx: number
	cy: number
	size?: number
	state?: EffectState
}) {
	const half = size / 2
	const iconSize = size * 0.5
	const scale = iconSize / 256
	const icon = STATE_ICONS[state]
	const colors = STATE_COLORS[state]

	return (
		<g>
			<rect
				x={cx - half}
				y={cy - half}
				width={size}
				height={size}
				fill={colors.fill}
				stroke={colors.border}
				strokeWidth={1}
			/>
			<g transform={`translate(${cx - iconSize / 2}, ${cy - iconSize / 2}) scale(${scale})`}>
				{icon.stroke ? (
					<path
						d={icon.path}
						fill="none"
						stroke="rgba(255,255,255,0.9)"
						strokeWidth={24}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				) : (
					<path d={icon.path} fill="rgba(255,255,255,0.9)" />
				)}
			</g>
		</g>
	)
}

function ConcentricRings({ cx, cy, scale = 1 }: { cx: number; cy: number; scale?: number }) {
	const rings = [
		{ radius: 40 * scale, opacity: 0.6, strokeWidth: 1.5 },
		{ radius: 90 * scale, opacity: 0.45, strokeWidth: 1.5 },
		{ radius: 150 * scale, opacity: 0.32, strokeWidth: 1 },
		{ radius: 220 * scale, opacity: 0.22, strokeWidth: 1 },
		{ radius: 300 * scale, opacity: 0.14, strokeWidth: 1 },
		{ radius: 400 * scale, opacity: 0.08, strokeWidth: 1 },
		{ radius: 520 * scale, opacity: 0.04, strokeWidth: 1 },
		{ radius: 660 * scale, opacity: 0.02, strokeWidth: 1 },
	]

	return (
		<g>
			<circle cx={cx} cy={cy} r={8 * scale} fill="white" opacity={1} />
			{rings.map((ring, i) => (
				<circle
					key={i}
					cx={cx}
					cy={cy}
					r={ring.radius}
					fill="none"
					stroke="white"
					strokeWidth={ring.strokeWidth}
					opacity={ring.opacity}
				/>
			))}
		</g>
	)
}

function Cell({
	children,
	className = "",
	style,
}: {
	children?: ReactNode
	className?: string
	style?: CSSProperties
}) {
	return (
		<div className={`flex items-center border-white/20 px-8 py-5 ${className}`} style={style}>
			{children}
		</div>
	)
}
