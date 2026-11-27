import { type ComponentType, lazy } from "react"
import type { NarratedComponentName } from "@/lib/content/narrated-components"

/** Props passed to step-driven components */
export interface StepDrivenComponentProps<TState = Record<string, unknown>> {
	/** Current state (derived from base + flow steps) */
	state: TState
	/** Total number of steps */
	totalSteps: number
	/** Current step index */
	step: number
}

/**
 * Lazy component loaders - each component is loaded on-demand.
 * This creates separate chunks that only load when a section needs them.
 */
const lazyComponentLoaders = {
	EffectFailDemo: () =>
		import("./EffectFailDemo").then((m) => ({
			default: m.EffectFailDemo as ComponentType<StepDrivenComponentProps<unknown>>,
		})),
	EffectIsDescriptionDemo: () =>
		import("./EffectIsDescriptionDemo").then((m) => ({
			default: m.EffectIsDescriptionDemo as ComponentType<StepDrivenComponentProps<unknown>>,
		})),
	ErrorShortCircuitDemo: () =>
		import("./ErrorShortCircuitDemo").then((m) => ({
			default: m.ErrorShortCircuitDemo as ComponentType<StepDrivenComponentProps<unknown>>,
		})),
	EffectPromiseDemo: () =>
		import("./EffectPromiseDemo").then((m) => ({
			default: m.EffectPromiseDemo as ComponentType<StepDrivenComponentProps<unknown>>,
		})),
	EffectRunDemo: () =>
		import("./EffectRunDemo").then((m) => ({
			default: m.EffectRunDemo as ComponentType<StepDrivenComponentProps<unknown>>,
		})),
	EffectSyncDemo: () =>
		import("./EffectSyncDemo").then((m) => ({
			default: m.EffectSyncDemo as ComponentType<StepDrivenComponentProps<unknown>>,
		})),
	EffectTypeDisplay: () =>
		import("./EffectTypeDisplay").then((m) => ({
			default: m.EffectTypeDisplay as ComponentType<StepDrivenComponentProps<unknown>>,
		})),
	GeneratorsDemo: () =>
		import("./GeneratorsDemo").then((m) => ({
			default: m.GeneratorsDemo as ComponentType<StepDrivenComponentProps<unknown>>,
		})),
	GetUserDemo: () =>
		import("./GetUserDemo").then((m) => ({
			default: m.GetUserDemo as ComponentType<StepDrivenComponentProps<unknown>>,
		})),
	KeyboardDiagram: () =>
		import("./KeyboardDiagram").then((m) => ({
			default: m.KeyboardDiagram as ComponentType<StepDrivenComponentProps<unknown>>,
		})),
	SyncVsSucceedDemo: () =>
		import("./SyncVsSucceedDemo").then((m) => ({
			default: m.SyncVsSucceedDemo as ComponentType<StepDrivenComponentProps<unknown>>,
		})),
	WelcomeControls: () =>
		import("./WelcomeControls").then((m) => ({
			default: m.WelcomeControls as ComponentType<StepDrivenComponentProps<unknown>>,
		})),
	WelcomeFeedback: () =>
		import("./WelcomeFeedback").then((m) => ({
			default: m.WelcomeFeedback as ComponentType<StepDrivenComponentProps<unknown>>,
		})),
	WhyComposeDemo: () =>
		import("./WhyComposeDemo").then((m) => ({
			default: m.WhyComposeDemo as ComponentType<StepDrivenComponentProps<unknown>>,
		})),
	StructuredConcurrencyDemo: () =>
		import("./StructuredConcurrencyDemo").then((m) => ({
			default: m.StructuredConcurrencyDemo as ComponentType<StepDrivenComponentProps<unknown>>,
		})),
} satisfies Record<NarratedComponentName, () => Promise<{ default: ComponentType<StepDrivenComponentProps<unknown>> }>>

/** Cache of lazy-wrapped components */
const lazyComponentCache: Record<string, ComponentType<StepDrivenComponentProps<unknown>>> = {}

/** Cache of in-flight/loaded import promises so preload and React.lazy share one identity path. */
const componentLoadPromiseCache: Record<
	string,
	Promise<{ default: ComponentType<StepDrivenComponentProps<unknown>> }>
> = {}

function loadComponent(name: string): Promise<{ default: ComponentType<StepDrivenComponentProps<unknown>> }> | null {
	const loader = lazyComponentLoaders[name as NarratedComponentName]
	if (!loader) return null
	componentLoadPromiseCache[name] ??= loader().catch((error) => {
		delete componentLoadPromiseCache[name]
		delete lazyComponentCache[name]
		throw error
	})
	return componentLoadPromiseCache[name]
}

/**
 * Get a step-driven component by name.
 * Returns a stable React.lazy wrapper backed by the shared load promise.
 */
export function getStepDrivenComponent(name: string): ComponentType<StepDrivenComponentProps<unknown>> | null {
	if (lazyComponentCache[name]) {
		return lazyComponentCache[name]
	}

	const loadPromise = loadComponent(name)
	if (!loadPromise) return null

	const LazyComponent = lazy(() => loadPromise)
	lazyComponentCache[name] = LazyComponent
	return LazyComponent
}

/**
 * Preload a component (useful for prefetching before navigation).
 * Starts loading through the same promise used by the stable React.lazy wrapper.
 */
export function preloadComponent(name: string): void {
	void loadComponent(name)?.catch(() => {})
}
