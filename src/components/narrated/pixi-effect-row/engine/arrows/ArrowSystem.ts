import { type AnimationPlaybackControls, animate, type MotionValue, motionValue } from "motion"
import { BlurFilter, Container, Graphics } from "pixi.js"
import type { PixiEffectArrow } from "../../types"
import { destroyBlurFilter } from "../application"
import type { NodeTarget } from "../layout"
import { applyBlur } from "../math"
import type { NodeView } from "../node/NodeView"

interface ArrowView {
	container: Container
	graphics: Graphics
	blur: BlurFilter
	size: number
	color: number
	direction: "right" | "left"
}

interface ArrowState {
	opacity: MotionValue<number>
	opacityTarget: number
	opacityControl: AnimationPlaybackControls | null
}

const ARROW_HIDE_BLUR = 6

function destroyArrowView(view: ArrowView) {
	if (!view.container.destroyed) {
		view.container.filters = null
		view.container.parent?.removeChild(view.container)
		view.container.destroy({ children: true })
	}
	destroyBlurFilter(view.blur)
}

function createArrowGraphics(size: number, color: number): Graphics {
	const g = new Graphics()
	const scale = size / 256
	const strokeWidth = 16 * scale

	g.moveTo((40 - 128) * scale, 0)
	g.lineTo((216 - 128) * scale, 0)
	g.stroke({ width: strokeWidth, color, cap: "round", join: "round" })

	g.moveTo((144 - 128) * scale, (56 - 128) * scale)
	g.lineTo((216 - 128) * scale, 0)
	g.lineTo((144 - 128) * scale, (200 - 128) * scale)
	g.stroke({ width: strokeWidth, color, cap: "round", join: "round" })

	return g
}

function createArrowBlur(): BlurFilter {
	const blur = new BlurFilter({ strengthX: 0, strengthY: 0, quality: 2 })
	blur.repeatEdgePixels = false
	blur.enabled = false
	blur.resolution = 2
	blur.padding = 12
	return blur
}

export class ArrowSystem {
	private views = new Map<number, ArrowView>()
	private states = new Map<number, ArrowState>()
	private exiting = new Set<number>()

	private animateOpacity(state: ArrowState, target: number) {
		if (Math.abs(target - state.opacityTarget) < 0.01) return
		state.opacityTarget = target
		state.opacityControl?.stop()
		state.opacityControl = animate(state.opacity, target, {
			type: "spring",
			bounce: 0,
			visualDuration: 0.25,
		})
	}

	sync(arrows: PixiEffectArrow[] | undefined, root: Container) {
		const currentArrows = arrows ?? []
		const currentArrowIndices = new Set(currentArrows.map((a) => a.afterIndex))

		for (const arrow of currentArrows) {
			const arrowSize = arrow.size ?? 30
			const arrowColor = arrow.color ?? 0x71717a // zinc-500
			const arrowDirection = arrow.direction ?? "right"
			const existing = this.views.get(arrow.afterIndex)
			if (existing) {
				if (existing.size !== arrowSize || existing.color !== arrowColor || existing.direction !== arrowDirection) {
					const nextGraphics = createArrowGraphics(arrowSize, arrowColor)
					// Apply rotation for left-pointing arrows
					nextGraphics.rotation = arrowDirection === "left" ? Math.PI : 0
					existing.container.removeChild(existing.graphics)
					if (!existing.graphics.destroyed) {
						existing.graphics.destroy()
					}
					existing.container.addChild(nextGraphics)
					existing.graphics = nextGraphics
					existing.size = arrowSize
					existing.color = arrowColor
					existing.direction = arrowDirection
				}
				this.exiting.delete(arrow.afterIndex)
				continue
			}

			const arrowContainer = new Container()
			const arrowGraphics = createArrowGraphics(arrowSize, arrowColor)
			// Apply rotation for left-pointing arrows
			arrowGraphics.rotation = arrowDirection === "left" ? Math.PI : 0
			const arrowBlur = createArrowBlur()
			arrowContainer.addChild(arrowGraphics)
			arrowContainer.filters = [arrowBlur]
			arrowContainer.alpha = 0
			root.addChild(arrowContainer)
			this.views.set(arrow.afterIndex, {
				container: arrowContainer,
				graphics: arrowGraphics,
				blur: arrowBlur,
				size: arrowSize,
				color: arrowColor,
				direction: arrowDirection,
			})
			this.states.set(arrow.afterIndex, {
				opacity: motionValue(0),
				opacityTarget: 0,
				opacityControl: null,
			})
		}

		for (const idx of this.views.keys()) {
			if (!currentArrowIndices.has(idx)) {
				this.exiting.add(idx)
			}
		}
	}

	update({
		arrows,
		nodeTargets,
		nodeViews,
	}: {
		arrows: PixiEffectArrow[] | undefined
		nodeTargets: NodeTarget[]
		nodeViews: Map<string, NodeView>
	}) {
		const currentArrows = arrows ?? []
		const arrowByIndex = new Map(currentArrows.map((arrow) => [arrow.afterIndex, arrow]))

		for (const [idx, arrowView] of this.views.entries()) {
			const arrowState = this.states.get(idx)
			if (!arrowState) continue
			const arrow = arrowByIndex.get(idx)
			const isActive = Boolean(arrow)

			let shouldShow = false
			if (arrow) {
				const leftTarget = nodeTargets[arrow.afterIndex]
				const rightTarget = nodeTargets[arrow.afterIndex + 1]
				const leftView = leftTarget ? nodeViews.get(leftTarget.node.id) : null
				const rightView = rightTarget ? nodeViews.get(rightTarget.node.id) : null

				if (
					leftTarget &&
					rightTarget &&
					leftView &&
					rightView &&
					leftView.state.hasLayout &&
					rightView.state.hasLayout &&
					!leftTarget.isHidden &&
					!rightTarget.isHidden
				) {
					const leftEdge = leftView.state.centerX + leftView.state.width / 2
					const rightEdge = rightView.state.centerX - rightView.state.width / 2
					arrowView.container.position.set(
						(leftEdge + rightEdge) / 2,
						(leftView.state.centerY + rightView.state.centerY) / 2,
					)
					shouldShow = true
				}
			}

			const shouldFadeOut = !isActive || !shouldShow || this.exiting.has(idx)
			this.animateOpacity(arrowState, shouldFadeOut ? 0 : 1)

			if (arrowView.container.destroyed) continue
			const arrowOpacity = arrowState.opacity.get()
			arrowView.container.alpha = arrowOpacity
			applyBlur(arrowView.blur, (1 - arrowOpacity) * ARROW_HIDE_BLUR)

			if (!isActive && arrowState.opacity.get() <= 0.02) {
				arrowState.opacityControl?.stop()
				destroyArrowView(arrowView)
				this.views.delete(idx)
				this.states.delete(idx)
				this.exiting.delete(idx)
			}
		}
	}

	clear() {
		for (const state of this.states.values()) {
			state.opacityControl?.stop()
		}
		for (const view of this.views.values()) {
			destroyArrowView(view)
		}
		this.views.clear()
		this.states.clear()
		this.exiting.clear()
	}
}
