import { SHADOW_COLORS } from "../constants/colors"
import { theme } from "../theme"
import type { EffectState as TaskState } from "../VisualEffect"

export function getTaskShadow(state: TaskState): string {
	switch (state.type) {
		case "running":
			return SHADOW_COLORS.running
		default:
			return theme.shadow.sm
	}
}
