import { createFileRoute, notFound } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { HierarchicalEffectRow } from "@/components/narrated/HierarchicalEffectRow"
import { type PixiEffectArrow, PixiEffectRow } from "@/components/narrated/PixiEffectRow"
import { PixiEffectStage } from "@/components/narrated/PixiEffectStage"
import { useHotkeys } from "@/hooks/useHotkeys"
import { useMeasure } from "@/hooks/useMeasure"
import { defaultSvgEffectLayout } from "@/lib/hierarchy/svgEffectLayout"
import type { HierarchicalEffectNode, SvgEffectNodeSpec } from "@/lib/hierarchy/types"

export const Route = createFileRoute("/debug/pixi-comparison")({
	beforeLoad: () => {
		if (!import.meta.env.DEV) {
			throw notFound()
		}
	},
	component: PixiComparisonPage,
	ssr: false,
})

// ============================================================================
// Showcase Definitions
// ============================================================================

interface ShowcaseStep {
	id: string
	label: string
	description?: string
	nodes: SvgEffectNodeSpec[]
}

const SHOWCASE_STEPS: ShowcaseStep[] = [
	{
		id: "idle",
		label: "Idle baseline",
		description: "Same nodes across the entire sequence.",
		nodes: [
			{ id: "sensorData", name: "sensorData", visualState: "idle" },
			{ id: "biometrics", name: "biometrics", visualState: "idle" },
			{ id: "analyze", name: "analyze", visualState: "idle" },
			{ id: "shout", name: "shout", visualState: "idle", hidden: true },
		],
	},
	{
		id: "race-start",
		label: "Race begins",
		description: "Two effects run concurrently.",
		nodes: [
			{ id: "sensorData", name: "sensorData", visualState: "running" },
			{ id: "biometrics", name: "biometrics", visualState: "running" },
			{ id: "analyze", name: "analyze", visualState: "idle" },
			{ id: "shout", name: "shout", visualState: "idle", hidden: true },
		],
	},
	{
		id: "race-resolve",
		label: "Race resolves",
		description: "One wins, the other is interrupted.",
		nodes: [
			{ id: "sensorData", name: "sensorData", visualState: "completed", result: "{ mSv: 0.3 }" },
			{ id: "biometrics", name: "biometrics", visualState: "interrupted" },
			{ id: "analyze", name: "analyze", visualState: "idle" },
			{ id: "shout", name: "shout", visualState: "idle", hidden: true },
		],
	},
	{
		id: "biometrics-retry",
		label: "Biometrics retry",
		nodes: [
			{ id: "sensorData", name: "sensorData", visualState: "completed", result: "{ mSv: 0.3 }" },
			{ id: "biometrics", name: "biometrics", visualState: "running" },
			{ id: "analyze", name: "analyze", visualState: "idle" },
			{ id: "shout", name: "shout", visualState: "idle", hidden: true },
		],
	},
	{
		id: "biometrics-interrupted-again",
		label: "Interrupted again",
		description: "Multiple interruptions on the same node.",
		nodes: [
			{ id: "sensorData", name: "sensorData", visualState: "completed", result: "{ mSv: 0.3 }" },
			{ id: "biometrics", name: "biometrics", visualState: "interrupted" },
			{ id: "analyze", name: "analyze", visualState: "idle" },
			{ id: "shout", name: "shout", visualState: "idle", hidden: true },
		],
	},
	{
		id: "biometrics-running",
		label: "Biometrics running",
		nodes: [
			{ id: "sensorData", name: "sensorData", visualState: "completed", result: "{ mSv: 0.3 }" },
			{ id: "biometrics", name: "biometrics", visualState: "running" },
			{ id: "analyze", name: "analyze", visualState: "idle" },
			{ id: "shout", name: "shout", visualState: "idle", hidden: true },
		],
	},
	{
		id: "biometrics-complete",
		label: "Biometrics completed",
		nodes: [
			{ id: "sensorData", name: "sensorData", visualState: "completed", result: "{ mSv: 0.3 }" },
			{ id: "biometrics", name: "biometrics", visualState: "completed", result: "{ pulse: 72 }" },
			{ id: "analyze", name: "analyze", visualState: "idle" },
			{ id: "shout", name: "shout", visualState: "idle", hidden: true },
		],
	},
	{
		id: "analyze-running",
		label: "Analyze running",
		nodes: [
			{ id: "sensorData", name: "sensorData", visualState: "completed", result: "{ mSv: 0.3 }" },
			{ id: "biometrics", name: "biometrics", visualState: "completed", result: "{ pulse: 72 }" },
			{ id: "analyze", name: "analyze", visualState: "running" },
			{ id: "shout", name: "shout", visualState: "idle", hidden: true },
		],
	},
	{
		id: "analyze-failed",
		label: "Analyze failed",
		nodes: [
			{ id: "sensorData", name: "sensorData", visualState: "completed", result: "{ mSv: 0.3 }" },
			{ id: "biometrics", name: "biometrics", visualState: "completed", result: "{ pulse: 72 }" },
			{ id: "analyze", name: "analyze", visualState: "failed", error: "BadPayload" },
			{ id: "shout", name: "shout", visualState: "idle", hidden: true },
		],
	},
	{
		id: "analyze-reset",
		label: "Analyze reset",
		nodes: [
			{ id: "sensorData", name: "sensorData", visualState: "completed", result: "{ mSv: 0.3 }" },
			{ id: "biometrics", name: "biometrics", visualState: "completed", result: "{ pulse: 72 }" },
			{ id: "analyze", name: "analyze", visualState: "idle" },
			{ id: "shout", name: "shout", visualState: "idle", hidden: true },
		],
	},
	{
		id: "analyze-retry",
		label: "Analyze running again",
		nodes: [
			{ id: "sensorData", name: "sensorData", visualState: "completed", result: "{ mSv: 0.3 }" },
			{ id: "biometrics", name: "biometrics", visualState: "completed", result: "{ pulse: 72 }" },
			{ id: "analyze", name: "analyze", visualState: "running" },
			{ id: "shout", name: "shout", visualState: "idle", hidden: true },
		],
	},
	{
		id: "analyze-complete",
		label: "Analyze completed",
		nodes: [
			{ id: "sensorData", name: "sensorData", visualState: "completed", result: "{ mSv: 0.3 }" },
			{ id: "biometrics", name: "biometrics", visualState: "completed", result: "{ pulse: 72 }" },
			{ id: "analyze", name: "analyze", visualState: "completed", result: '{ status: "ok" }' },
			{ id: "shout", name: "shout", visualState: "idle", hidden: true },
		],
	},
	{
		id: "shout-appears",
		label: "Shout appears",
		nodes: [
			{ id: "sensorData", name: "sensorData", visualState: "completed", result: "{ mSv: 0.3 }" },
			{ id: "biometrics", name: "biometrics", visualState: "completed", result: "{ pulse: 72 }" },
			{ id: "analyze", name: "analyze", visualState: "completed", result: '{ status: "ok" }' },
			{ id: "shout", name: "shout", visualState: "idle" },
		],
	},
	{
		id: "shout-running",
		label: "Shout running",
		nodes: [
			{ id: "sensorData", name: "sensorData", visualState: "completed", result: "{ mSv: 0.3 }" },
			{ id: "biometrics", name: "biometrics", visualState: "completed", result: "{ pulse: 72 }" },
			{ id: "analyze", name: "analyze", visualState: "completed", result: '{ status: "ok" }' },
			{ id: "shout", name: "shout", visualState: "running", showLog: true, logMessage: "ALL CLEAR!" },
		],
	},
	{
		id: "shout-complete",
		label: "Shout completed",
		nodes: [
			{ id: "sensorData", name: "sensorData", visualState: "completed", result: "{ mSv: 0.3 }" },
			{ id: "biometrics", name: "biometrics", visualState: "completed", result: "{ pulse: 72 }" },
			{ id: "analyze", name: "analyze", visualState: "completed", result: '{ status: "ok" }' },
			{ id: "shout", name: "shout", visualState: "completed", result: "✓", showLog: false },
		],
	},
]

// ============================================================================
// Component
// ============================================================================

function PixiComparisonPage() {
	const [scenarioIndex, setScenarioIndex] = useState(0)
	const [rowRef, rowBounds] = useMeasure<HTMLDivElement>()

	const currentStep = SHOWCASE_STEPS[scenarioIndex] ?? SHOWCASE_STEPS[0]

	useEffect(() => {
		setScenarioIndex(0)
	}, [])

	useHotkeys({
		context: "debug-pixi",
		handlers: {
			"debugPixi.prevStep": () => {
				setScenarioIndex((prev) => Math.max(0, prev - 1))
				return true
			},
			"debugPixi.nextStep": () => {
				setScenarioIndex((prev) => Math.min(SHOWCASE_STEPS.length - 1, prev + 1))
				return true
			},
		},
	})

	const layout = defaultSvgEffectLayout
	// Match original's py-6 pt-12 (48px top, 24px bottom)
	const visualPaddingTop = 48
	const paddingBottom = 24
	const rowPaddingX = 24
	const nodeGap = 24 // Match original's gap-6 (24px)
	const arrowGap = 24
	const bubbleFontSize = 16
	const bubblePaddingX = 11
	const bubblePaddingY = 7
	const bubbleHeight = Math.max(bubbleFontSize + bubblePaddingY * 2, bubbleFontSize + 8)

	// PixiEffectRow's internal Y calculation: paddingTop + bubbleHeight + bubbleGap + nodeSize/2
	// We want node center at: visualPaddingTop + nodeSize/2 = 48 + 32 = 80
	// So: effectivePaddingTop + bubbleHeight + bubbleGap + 32 = 80
	// effectivePaddingTop = 80 - 32 - bubbleHeight - bubbleGap = 48 - bubbleHeight - bubbleGap
	const effectivePaddingTop = visualPaddingTop - bubbleHeight - layout.bubbleGap

	// Height: top padding + node + label gap + label + bottom padding
	const rowHeight = visualPaddingTop + layout.nodeSize + layout.labelGap + layout.labelFontSize + paddingBottom

	const layoutConfig = {
		...layout,
		bubblePaddingX,
		bubbleHeight,
		bubbleFontSize,
	}

	const resolvedWidth = rowBounds.width || 720

	const stepArrows = useMemo<PixiEffectArrow[]>(() => {
		const arrows: PixiEffectArrow[] = []
		for (let i = 0; i < currentStep.nodes.length - 1; i += 1) {
			const left = currentStep.nodes[i]
			const right = currentStep.nodes[i + 1]
			if (!left?.hidden && !right?.hidden) {
				arrows.push({ afterIndex: i, gap: arrowGap * 2 })
			}
		}
		return arrows
	}, [currentStep.nodes, arrowGap])

	const hierarchyRoot = useMemo<HierarchicalEffectNode>(() => {
		const children = currentStep.nodes
			.filter((node) => !node.hidden)
			.map((node) => ({
				id: node.id,
				name: node.name,
				visualState: node.visualState,
				...(node.result !== undefined && { result: node.result }),
				...(node.resultScale !== undefined && { resultScale: node.resultScale }),
				...(node.error !== undefined && { error: node.error }),
				...(node.showLog !== undefined && { showLog: node.showLog }),
				...(node.logMessage !== undefined && { logMessage: node.logMessage }),
			}))

		return {
			id: "program",
			name: "program",
			children,
		}
	}, [currentStep.nodes])

	return (
		<div className="min-h-screen bg-black text-white p-8">
			<div className="max-w-6xl mx-auto space-y-6">
				<div>
					<h1 className="text-2xl font-bold mb-2">Pixi Effect Showcase</h1>
					<p className="text-white/60 text-sm">Use ← → to step through the flow.</p>
				</div>

				{/* Step controls */}
				<div className="flex items-center gap-4 border border-[var(--border-subtle)] bg-white/5 px-4 py-3 rounded">
					<div className="text-sm text-white/60">
						{currentStep.description ?? "Linear progression through node states."}
					</div>
					<div className="flex items-center gap-2 ml-auto">
						<button
							onClick={() => setScenarioIndex((prev) => Math.max(0, prev - 1))}
							disabled={scenarioIndex === 0}
							className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded"
						>
							←
						</button>
						<div className="min-w-[180px] text-center">
							<span className="text-xs text-white/50">
								{scenarioIndex + 1}/{SHOWCASE_STEPS.length}
							</span>
							<span className="ml-2 text-sm text-white/90">{currentStep.label}</span>
						</div>
						<button
							onClick={() => setScenarioIndex((prev) => Math.min(SHOWCASE_STEPS.length - 1, prev + 1))}
							disabled={scenarioIndex === SHOWCASE_STEPS.length - 1}
							className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded"
						>
							→
						</button>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-8">
					{/* Showcase row */}
					<div ref={rowRef} className="space-y-2">
						<div className="text-xs uppercase tracking-wide text-white/40">Pixi (PixiEffectRow)</div>
						<div
							className="relative border border-[var(--border-subtle)] bg-white/[0.02] rounded-lg"
							style={{ minHeight: rowHeight }}
						>
							<div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-fuchsia-500/40" />
							<PixiEffectStage height={rowHeight}>
								{({ app }) => (
									<PixiEffectRow
										sharedApp={app}
										widthOverride={resolvedWidth}
										heightOverride={rowHeight}
										nodes={currentStep.nodes}
										paddingTop={effectivePaddingTop}
										paddingBottom={paddingBottom}
										paddingX={rowPaddingX}
										gap={nodeGap}
										layout={layoutConfig}
										arrows={stepArrows}
									/>
								)}
							</PixiEffectStage>
						</div>
					</div>

					{/* Hierarchical container example */}
					<div className="space-y-2">
						<div className="text-xs uppercase tracking-wide text-white/40">Hierarchical (Container)</div>
						<div className="relative border border-[var(--border-subtle)] bg-white/[0.02] rounded-lg">
							<HierarchicalEffectRow root={hierarchyRoot} collapsed={false} showBorder gap={nodeGap} />
						</div>
					</div>
				</div>

				{/* Node state reference */}
				<div className="border border-[var(--border-subtle)] bg-white/5 rounded p-4 text-xs">
					<div className="text-white/40 uppercase tracking-wide mb-2">Current node states</div>
					<div className="flex flex-wrap gap-4">
						{currentStep.nodes.map((node, i) => (
							<div key={`${node.id}-${i}`} className="flex items-center gap-2">
								<span className="text-white/60 font-mono">{node.name}:</span>
								<span
									className={`font-medium ${
										node.visualState === "completed"
											? "text-emerald-400"
											: node.visualState === "failed"
												? "text-red-400"
												: node.visualState === "running"
													? "text-blue-400"
													: "text-white/40"
									}`}
								>
									{node.visualState}
								</span>
								{node.hidden && <span className="text-white/30">(hidden)</span>}
								{node.result && <span className="text-white/40">= {node.result}</span>}
								{node.error && <span className="text-red-400/60">err: {node.error}</span>}
								{node.showLog && <span className="text-yellow-400/60">log: {node.logMessage}</span>}
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}
