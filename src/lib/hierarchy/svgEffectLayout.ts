import type { SvgEffectNodeSpec } from "./types"

const MONO_STACK =
	'Commit Mono, IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

export interface SvgEffectLayoutConfig {
	nodeSize: number
	contentFontSize: number
	labelFontSize: number
	labelGap: number
	contentPaddingX: number
	bubbleHeight: number
	bubbleGap: number
	bubblePaddingX: number
	bubbleFontSize: number
	charWidthRatio: number
	fontFamily: string
}

export const defaultSvgEffectLayout: SvgEffectLayoutConfig = {
	nodeSize: 64,
	contentFontSize: 16,
	labelFontSize: 13,
	labelGap: 10,
	contentPaddingX: 18,
	bubbleHeight: 30,
	bubbleGap: 8,
	bubblePaddingX: 11,
	bubbleFontSize: 16,
	charWidthRatio: 0.56,
	fontFamily: MONO_STACK,
}

export interface SvgEffectBubble {
	type: "error" | "log"
	message: string
}

export function normalizeText(value: string): string {
	return value.replace(/\s+/g, " ").trim()
}

const CHECK_RESULT_SCALE = 1.4
const DEFAULT_TEXT_RESULT_SCALE = 1.15

export function getContentText(node: SvgEffectNodeSpec): string | null {
	switch (node.visualState) {
		case "completed":
			return normalizeText(node.result ?? "✓")
		case "failed":
		case "death":
			return "ERR"
		case "interrupted":
			return "INT"
		case "idle":
			return "*"
		case "running":
			return null
	}
}

export function getContentScale(node: SvgEffectNodeSpec, content?: string | null): number {
	if (node.resultScale) return node.resultScale
	const text = content ?? getContentText(node)
	if (!text) return 1
	if (text === "✓") return CHECK_RESULT_SCALE
	if (node.visualState === "completed") return DEFAULT_TEXT_RESULT_SCALE
	return 1
}

export function getBubble(node: SvgEffectNodeSpec): SvgEffectBubble | null {
	if ((node.visualState === "failed" || node.visualState === "death") && node.error) {
		return { type: "error", message: normalizeText(node.error) }
	}

	if (node.showLog && node.logMessage) {
		return { type: "log", message: normalizeText(node.logMessage) }
	}

	return null
}

export function measureMonoText(text: string, fontSize: number, charWidthRatio: number): number {
	const safeText = text.length > 0 ? text : " "
	return safeText.length * fontSize * charWidthRatio
}

export function getNodeTargetWidth(node: SvgEffectNodeSpec, layout: SvgEffectLayoutConfig): number {
	const content = getContentText(node)
	if (!content) return layout.nodeSize

	const contentScale = getContentScale(node, content)
	const contentWidth = measureMonoText(content, layout.contentFontSize * contentScale, layout.charWidthRatio)
	const target = Math.ceil(contentWidth + layout.contentPaddingX * 2)
	return Math.max(layout.nodeSize, target)
}
