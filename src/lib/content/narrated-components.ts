/** Narrated visualizations that authored content may publish. */
const narratedComponentNames = [
	"EffectFailDemo",
	"EffectIsDescriptionDemo",
	"ErrorShortCircuitDemo",
	"EffectPromiseDemo",
	"EffectRunDemo",
	"EffectSyncDemo",
	"EffectTypeDisplay",
	"GeneratorsDemo",
	"GetUserDemo",
	"KeyboardDiagram",
	"SyncVsSucceedDemo",
	"WelcomeControls",
	"WelcomeFeedback",
	"WhyComposeDemo",
	"StructuredConcurrencyDemo",
] as const

export type NarratedComponentName = (typeof narratedComponentNames)[number]

const knownNames = new Set<string>(narratedComponentNames)

export function isNarratedComponentName(name: string): name is NarratedComponentName {
	return knownNames.has(name)
}
