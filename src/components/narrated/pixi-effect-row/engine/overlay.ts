import { type AnimationPlaybackControls, animate, type MotionValue } from "motion"
import type { BlurFilter, Graphics, Text } from "pixi.js"
import type { SvgEffectLayoutConfig } from "@/lib/hierarchy/svgEffectLayout"
import type { PixiEffectOverlay } from "../types"
import { applyBlur, type ManualSpringConfig } from "./math"
import { animateScalarMotion, readScalarMotion, type ScalarMotion, springFromLambda, syncScalarMotion } from "./motion"

export interface OverlayView {
	fill: Graphics
	border: Graphics
	label: Text
	blur: BlurFilter
}

export interface OverlayState {
	hasLayout: boolean
	x: MotionValue<number>
	y: MotionValue<number>
	width: MotionValue<number>
	height: MotionValue<number>
	xTarget: number
	yTarget: number
	widthTarget: number
	heightTarget: number
	xControl: AnimationPlaybackControls | null
	yControl: AnimationPlaybackControls | null
	widthControl: AnimationPlaybackControls | null
	heightControl: AnimationPlaybackControls | null
	opacity: ScalarMotion
	fillOpacity: ScalarMotion
	borderAlpha: ScalarMotion
	fillColor: number
	borderColor: number
	labelX: MotionValue<number>
	labelY: MotionValue<number>
	labelXTarget: number
	labelYTarget: number
	labelXControl: AnimationPlaybackControls | null
	labelYControl: AnimationPlaybackControls | null
	labelOpacity: ScalarMotion
	labelText: string
	labelAlign: "left" | "center"
}

export function applyLayoutToOverlayLabel(label: Text, layout: SvgEffectLayoutConfig) {
	label.style.fontFamily = layout.fontFamily
	label.style.fontSize = layout.labelFontSize
}

export function updateOverlayView({
	overlay,
	overlayState,
	overlayView,
	positionSpring,
	opacityLambda,
	fillOpacityLambda,
	borderAlphaLambda,
}: {
	overlay: PixiEffectOverlay | null
	overlayState: OverlayState
	overlayView: OverlayView
	positionSpring: ManualSpringConfig
	opacityLambda: number
	fillOpacityLambda: number
	borderAlphaLambda: number
}) {
	const targetRect = overlay?.rect
	const targetOpacity = overlay?.opacity ?? 0
	const targetFillOpacity = overlay?.fillOpacity ?? 0
	const targetBorderAlpha = overlay?.borderAlpha ?? 0
	const targetFillColor = overlay?.fillColor ?? overlayState.fillColor
	const targetBorderColor = overlay?.borderColor ?? overlayState.borderColor
	const targetLabel = overlay?.label
	const targetBlur = overlay?.blur ?? 0
	const spring = {
		type: "spring",
		stiffness: positionSpring.stiffness,
		damping: positionSpring.damping,
		mass: positionSpring.mass,
	} as const
	const opacitySpring = springFromLambda(opacityLambda)
	const fillOpacitySpring = springFromLambda(fillOpacityLambda)
	const borderAlphaSpring = springFromLambda(borderAlphaLambda)

	if (!overlayState.hasLayout && targetRect) {
		overlayState.xTarget = targetRect.x
		overlayState.yTarget = targetRect.y
		overlayState.widthTarget = targetRect.width
		overlayState.heightTarget = targetRect.height
		overlayState.x.set(targetRect.x)
		overlayState.y.set(targetRect.y)
		overlayState.width.set(targetRect.width)
		overlayState.height.set(targetRect.height)
		syncScalarMotion(overlayState.opacity, targetOpacity)
		syncScalarMotion(overlayState.fillOpacity, targetFillOpacity)
		syncScalarMotion(overlayState.borderAlpha, targetBorderAlpha)
		overlayState.fillColor = targetFillColor
		overlayState.borderColor = targetBorderColor
		overlayState.labelXTarget = targetLabel?.x ?? 0
		overlayState.labelYTarget = targetLabel?.y ?? 0
		overlayState.labelX.set(targetLabel?.x ?? 0)
		overlayState.labelY.set(targetLabel?.y ?? 0)
		syncScalarMotion(overlayState.labelOpacity, targetLabel?.opacity ?? 0)
		overlayState.labelText = targetLabel?.text ?? ""
		overlayState.labelAlign = targetLabel?.align ?? "left"
		overlayState.hasLayout = true
	} else {
		animateScalarMotion(overlayState.opacity, targetOpacity, opacitySpring)
		animateScalarMotion(overlayState.fillOpacity, targetFillOpacity, fillOpacitySpring)
		animateScalarMotion(overlayState.borderAlpha, targetBorderAlpha, borderAlphaSpring)
		overlayState.fillColor = targetFillColor
		overlayState.borderColor = targetBorderColor
		if (targetRect) {
			if (Math.abs(targetRect.x - overlayState.xTarget) > 0.5) {
				overlayState.xTarget = targetRect.x
				overlayState.xControl?.stop()
				overlayState.xControl = animate(overlayState.x, targetRect.x, spring)
			}
			if (Math.abs(targetRect.y - overlayState.yTarget) > 0.5) {
				overlayState.yTarget = targetRect.y
				overlayState.yControl?.stop()
				overlayState.yControl = animate(overlayState.y, targetRect.y, spring)
			}
			if (Math.abs(targetRect.width - overlayState.widthTarget) > 0.5) {
				overlayState.widthTarget = targetRect.width
				overlayState.widthControl?.stop()
				overlayState.widthControl = animate(overlayState.width, targetRect.width, spring)
			}
			if (Math.abs(targetRect.height - overlayState.heightTarget) > 0.5) {
				overlayState.heightTarget = targetRect.height
				overlayState.heightControl?.stop()
				overlayState.heightControl = animate(overlayState.height, targetRect.height, spring)
			}
		}
	}

	if (targetLabel) {
		if (overlayState.labelText !== targetLabel.text) {
			overlayState.labelText = targetLabel.text
			overlayView.label.text = targetLabel.text
		}
		overlayState.labelAlign = targetLabel.align
		overlayView.label.anchor.set(targetLabel.align === "center" ? 0.5 : 0, 0)
		animateScalarMotion(overlayState.labelOpacity, targetLabel.opacity, opacitySpring)
		if (Math.abs(targetLabel.x - overlayState.labelXTarget) > 0.5) {
			overlayState.labelXTarget = targetLabel.x
			overlayState.labelXControl?.stop()
			overlayState.labelXControl = animate(overlayState.labelX, targetLabel.x, spring)
		}
		if (Math.abs(targetLabel.y - overlayState.labelYTarget) > 0.5) {
			overlayState.labelYTarget = targetLabel.y
			overlayState.labelYControl?.stop()
			overlayState.labelYControl = animate(overlayState.labelY, targetLabel.y, spring)
		}
	} else {
		animateScalarMotion(overlayState.labelOpacity, 0, opacitySpring)
	}

	const overlayAlpha = readScalarMotion(overlayState.opacity, 0)
	const overlayFillOpacity = readScalarMotion(overlayState.fillOpacity, 0)
	const overlayBorderAlpha = readScalarMotion(overlayState.borderAlpha, 0)
	const overlayLabelOpacity = readScalarMotion(overlayState.labelOpacity, 0)
	overlayView.fill.clear()
	const overlayX = overlayState.x.get()
	const overlayY = overlayState.y.get()
	const overlayWidth = overlayState.width.get()
	const overlayHeight = overlayState.height.get()
	if (overlayAlpha > 0.001 && overlayFillOpacity > 0.001 && targetRect) {
		overlayView.fill.rect(overlayX, overlayY, overlayWidth, overlayHeight).fill({
			color: overlayState.fillColor,
			alpha: overlayAlpha * overlayFillOpacity,
		})
	}

	overlayView.border.clear()
	if (overlayAlpha > 0.001 && overlayBorderAlpha > 0.001 && targetRect) {
		overlayView.border.setStrokeStyle({
			width: 1,
			color: overlayState.borderColor,
			alpha: overlayAlpha * overlayBorderAlpha,
			alignment: 1,
		})
		overlayView.border.beginPath()
		overlayView.border.rect(overlayX, overlayY, overlayWidth, overlayHeight)
		overlayView.border.stroke()
	}

	overlayView.label.alpha = overlayAlpha * overlayLabelOpacity
	overlayView.label.position.set(overlayState.labelX.get(), overlayState.labelY.get())
	applyBlur(overlayView.blur, targetBlur)
}
