/**
 * Renderer for step-driven components.
 *
 * Takes a compiled component flow and current step, looks up the component
 * from the registry, and renders it with the appropriate state.
 *
 * Components are lazy-loaded on first render via React.lazy().
 */

import { Component, type ReactNode, Suspense } from "react"
import type { ComponentFlowData } from "@/lib/tooling/types"
import { getStepDrivenComponent } from "./componentRegistry"

/**
 * Error boundary that catches chunk loading failures and reloads the page.
 * This handles the case where a new deployment has different chunk hashes
 * and users with stale manifests try to load components that no longer exist.
 */
class ChunkErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
	override state = { hasError: false }

	static getDerivedStateFromError(error: Error) {
		// Check if this is a chunk loading failure
		const isChunkError =
			error.message.includes("Failed to fetch dynamically imported module") ||
			error.message.includes("Loading chunk") ||
			error.message.includes("Loading CSS chunk")

		if (isChunkError) {
			return { hasError: true }
		}
		// Re-throw non-chunk errors
		throw error
	}

	override componentDidCatch(error: Error) {
		const isChunkError =
			error.message.includes("Failed to fetch dynamically imported module") ||
			error.message.includes("Loading chunk") ||
			error.message.includes("Loading CSS chunk")

		if (isChunkError) {
			// Reload to get fresh assets
			window.location.reload()
		}
	}

	override render() {
		if (this.state.hasError) {
			// Show nothing while reloading
			return null
		}
		return this.props.children
	}
}

interface StepDrivenComponentProps {
	/** Compiled component flow from section data */
	componentFlow: ComponentFlowData
	/** Current step index (0-based) */
	step: number
}

/**
 * Invisible placeholder while component chunk loads.
 * Uses min-height to prevent layout shift, but shows nothing visible.
 * Components should load fast enough that users don't notice.
 */
function ComponentLoadingFallback() {
	return <div className="min-h-[200px]" />
}

/**
 * Renders a step-driven component with the state for the current step.
 * Wrapped in Suspense for lazy loading support.
 */
export function StepDrivenComponent({ componentFlow, step }: StepDrivenComponentProps) {
	const Component = getStepDrivenComponent(componentFlow.name)

	if (!Component) {
		console.warn(`[StepDrivenComponent] Component "${componentFlow.name}" not found in registry`)
		return null
	}

	// Clamp step to valid range
	const clampedStep = Math.max(0, Math.min(step, componentFlow.snapshots.length - 1))
	const state = componentFlow.snapshots[clampedStep]?.state ?? {}

	return (
		<ChunkErrorBoundary>
			<Suspense fallback={<ComponentLoadingFallback />}>
				<Component state={state} step={clampedStep} totalSteps={componentFlow.snapshots.length} />
			</Suspense>
		</ChunkErrorBoundary>
	)
}
