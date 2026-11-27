export type EffectState<A = unknown, E = unknown> =
	| { type: "idle" }
	| { type: "running" }
	| { type: "completed"; result: A }
	| { type: "failed"; error: E }
	| { type: "interrupted" }
	| { type: "death"; error: unknown }
