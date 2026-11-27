import { useAtomSet } from "@effect/atom-react"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { progressHydratedFamily } from "@/atoms/narration"
import { InlineGroupHeader } from "@/components/chapters/group-headers/InlineGroupHeader"
import { ChapterProgressRing } from "@/components/chapters/progress/ChapterProgressRing"
import { type Status, StatusIndicator } from "@/lib/neo-code-block/view/StatusIndicator"

export const Route = createFileRoute("/debug/components")({
	beforeLoad: () => {
		if (!import.meta.env.DEV) {
			throw notFound()
		}
	},
	component: ComponentsPage,
	ssr: false,
})

const DEMO_INDICES = [0, 1, 2, 3]

function ComponentsPage() {
	const [completedSections, setCompletedSections] = useState<Set<number>>(new Set())

	// Mark progress as hydrated so completion sounds play (debug page uses dummy chapter)
	const setHydrated = useAtomSet(progressHydratedFamily("__debug__"))
	useEffect(() => {
		setHydrated(true)
	}, [setHydrated])

	const toggleSection = (index: number) => {
		setCompletedSections((prev) => {
			const next = new Set(prev)
			if (next.has(index)) {
				next.delete(index)
			} else {
				next.add(index)
			}
			return next
		})
	}

	const toggleAll = () => {
		const allComplete = DEMO_INDICES.every((i) => completedSections.has(i))
		if (allComplete) {
			setCompletedSections(new Set())
		} else {
			setCompletedSections(new Set(DEMO_INDICES))
		}
	}

	const completeNext = () => {
		for (const i of DEMO_INDICES) {
			if (!completedSections.has(i)) {
				setCompletedSections((prev) => new Set([...prev, i]))
				break
			}
		}
	}

	const reset = () => {
		setCompletedSections(new Set())
	}

	return (
		<div className="min-h-screen bg-black text-white p-8">
			<div className="max-w-2xl mx-auto space-y-8">
				<div>
					<h1 className="text-2xl font-bold mb-2">Component Playground</h1>
					<p className="text-white/60 text-sm">Test interactive components in isolation.</p>
				</div>

				{/* Group Header */}
				<div className="border border-white/20  p-6 space-y-6">
					<div>
						<h2 className="text-lg font-semibold mb-2">Group Header</h2>
						<p className="text-white/50 text-sm">Full group header with progress dots and celebration effects.</p>
					</div>

					{/* The component */}
					<div className=" overflow-hidden border border-[var(--border-subtle)]">
						<InlineGroupHeader title="Getting Started" firstIndex={0} lastIndex={3} />
					</div>

					{/* Individual toggles */}
					<div className="space-y-2">
						<div className="text-white/60 text-sm">Toggle individual:</div>
						<div className="flex gap-2">
							{DEMO_INDICES.map((i) => (
								<button
									key={i}
									onClick={() => toggleSection(i)}
									className={`
										w-10 h-10  border transition-all font-mono
										${
											completedSections.has(i)
												? "bg-emerald-600 border-emerald-400"
												: "bg-white/5 border-white/20 hover:border-white/40"
										}
									`}
								>
									{i}
								</button>
							))}
						</div>
					</div>

					{/* Action buttons */}
					<div className="flex gap-3">
						<button
							onClick={completeNext}
							disabled={DEMO_INDICES.every((i) => completedSections.has(i))}
							className="px-4 py-2  border border-blue-500 bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
						>
							Complete Next
						</button>
						<button
							onClick={toggleAll}
							className="px-4 py-2  border border-emerald-500 bg-emerald-500/20 hover:bg-emerald-500/30 transition-all"
						>
							{DEMO_INDICES.every((i) => completedSections.has(i)) ? "Clear All" : "Complete All"}
						</button>
						<button
							onClick={reset}
							className="px-4 py-2  border border-white/30 bg-white/5 hover:bg-white/10 transition-all"
						>
							Reset
						</button>
					</div>

					{/* State display */}
					<div className="text-xs text-white/40 font-mono">completed: [{[...completedSections].sort().join(", ")}]</div>
				</div>

				{/* Status Indicators */}
				<StatusIndicatorSection />

				{/* Progress Indicators */}
				<ProgressIndicatorSection />
			</div>
		</div>
	)
}

const STATUSES: Status[] = ["idle", "running", "success", "error", "interrupted", "die"]

function StatusIndicatorSection() {
	const [activeStatus, setActiveStatus] = useState<Status>("running")

	const cycleStatus = () => {
		const currentIndex = STATUSES.indexOf(activeStatus)
		const nextIndex = (currentIndex + 1) % STATUSES.length
		setActiveStatus(STATUSES[nextIndex])
	}

	const setStatus = (status: Status) => {
		setActiveStatus(status)
	}

	return (
		<div className="border border-white/20  p-6 space-y-6">
			<div>
				<h2 className="text-lg font-semibold mb-2">Status Indicators</h2>
				<p className="text-white/50 text-sm">Line execution status indicators for code animations.</p>
			</div>

			{/* All states side by side */}
			<div className="space-y-4">
				<div className="text-white/60 text-sm">All states:</div>
				<div className="flex gap-8 items-center p-4 bg-white/5 ">
					{STATUSES.map((status) => (
						<button
							key={status}
							onClick={() => setStatus(status)}
							className={`flex items-center gap-2 px-3 py-1.5transition-all ${
								activeStatus === status ? "bg-white/10 ring-1 ring-white/30" : "hover:bg-white/5"
							}`}
						>
							<StatusIndicator status={status} size="md" />
							<span className="text-sm text-white/70">{status}</span>
						</button>
					))}
				</div>
			</div>

			{/* Size comparison */}
			<div className="space-y-4">
				<div className="text-white/60 text-sm">Sizes:</div>
				<div className="flex gap-8 items-center p-4 bg-white/5">
					{(["sm", "md", "lg"] as const).map((size) => (
						<div key={size} className="flex items-center gap-3">
							<span className="text-xs text-white/50 w-6">{size}</span>
							<StatusIndicator status={activeStatus} size={size} />
						</div>
					))}
				</div>
			</div>

			{/* In context - code line simulation */}
			<div className="space-y-4">
				<div className="text-white/60 text-sm">In context (click to cycle):</div>
				<button onClick={cycleStatus} className="w-full text-left p-4 font-mono text-sm transition-colors space-y-1">
					<code className="block text-white/70">const topic = "Effect basics"</code>
					<CodeLineWithStatus status={activeStatus} />
					<code className="block text-white/70">console.log(result)</code>
				</button>
			</div>
		</div>
	)
}

const statusBg: Record<Status, string> = {
	idle: "",
	running: "bg-blue-500/15",
	success: "bg-emerald-500/15",
	error: "bg-red-500/15",
	interrupted: "bg-amber-500/15",
	die: "bg-red-500/15",
}

function CodeLineWithStatus({ status }: { status: Status }) {
	return (
		<code className="flex items-center">
			<span className="text-blue-400">const</span>
			<span className="text-white">&nbsp;result&nbsp;</span>
			<span className="text-white/50">=</span>
			<span className="text-blue-400">&nbsp;await&nbsp;</span>
			<span
				className={`inline-flex items-center rounded px-1 -mx-1 transition-colors duration-200 ${statusBg[status]}`}
			>
				<span className="text-yellow-300">fetchUser</span>
				<span className="text-white/50">(</span>
				<span className="text-emerald-400">id</span>
				<span className="text-white/50">)</span>
				<StatusIndicator status={status} size="sm" className="ml-1.5" />
			</span>
		</code>
	)
}

// ============================================================================
// Progress Indicators
// ============================================================================

function ProgressIndicatorSection() {
	const [completed, setCompleted] = useState(5)
	const total = 17

	return (
		<div className="border border-white/20 p-6 space-y-6">
			<div>
				<h2 className="text-lg font-semibold mb-2">Chapter Progress Ring</h2>
				<p className="text-white/50 text-sm">Circular progress for chapter completion on the index page.</p>
			</div>

			{/* Controls */}
			<div className="space-y-3">
				<div className="text-white/60 text-sm">
					Completed: {completed} / {total}
				</div>
				<input
					type="range"
					min={0}
					max={total}
					value={completed}
					onChange={(e) => setCompleted(Number(e.target.value))}
					className="w-full accent-white"
				/>
				<div className="flex gap-2">
					<button
						onClick={() => setCompleted(0)}
						className="px-3 py-1.5 text-xs border border-white/20 bg-white/5 hover:bg-white/10"
					>
						Reset
					</button>
					<button
						onClick={() => setCompleted(Math.min(completed + 1, total))}
						className="px-3 py-1.5 text-xs border border-white/20 bg-white/5 hover:bg-white/10"
					>
						+1
					</button>
					<button
						onClick={() => setCompleted(total)}
						className="px-3 py-1.5 text-xs border border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20"
					>
						Complete All
					</button>
				</div>
			</div>

			{/* Ring preview */}
			<div className="flex items-center gap-8 p-4 bg-white/5">
				<div className="flex items-center gap-3">
					<span className="text-sm text-white/60">Current:</span>
					<ChapterProgressRing completed={completed} total={total} />
				</div>
				<div className="flex items-center gap-3 opacity-50">
					<span className="text-sm text-white/60">Complete:</span>
					<ChapterProgressRing completed={total} total={total} />
				</div>
			</div>

			{/* In-context preview */}
			<div className="space-y-3">
				<div className="text-white/60 text-sm">In context:</div>
				<div className="border border-[var(--border-subtle)] bg-black">
					<ChapterCardPreview
						title="Introduction to Effect"
						description="Learn why Effect exists and what problems it solves"
						indicator={<ChapterProgressRing completed={completed} total={total} />}
					/>
					<ChapterCardPreview
						title="Services & Layers"
						description="Build modular, testable applications"
						indicator={<ChapterProgressRing completed={total} total={total} />}
					/>
					<ChapterCardPreview
						title="Error Handling"
						description="Type-safe error handling patterns"
						indicator={<ChapterProgressRing completed={0} total={12} />}
					/>
				</div>
			</div>
		</div>
	)
}

function ChapterCardPreview({
	title,
	description,
	indicator,
}: {
	title: string
	description: string
	indicator: React.ReactNode
}) {
	return (
		<div className="flex items-start gap-4 p-5 border-t border-[var(--border-subtle)] first:border-t-0">
			<div className="flex-1 min-w-0">
				<h3 className="text-lg font-medium text-white">{title}</h3>
				<p className="mt-1.5 text-sm text-white/50">{description}</p>
			</div>
			<div className="flex-none mt-1">{indicator}</div>
		</div>
	)
}
