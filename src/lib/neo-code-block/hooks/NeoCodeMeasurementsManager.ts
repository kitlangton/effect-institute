"use client"

export interface TextMeasurement {
	/** Line top relative to code block */
	lineTop: number
	/** Line left relative to code block */
	lineLeft: number
	/** Line height */
	lineHeight: number
	/** X offset from line start to range start */
	textOffsetX: number
	/** Width of the measured text range */
	textWidth: number
}

export interface TextMeasurementRequest {
	lineId: string
	lineText: string
	start: number
	end: number
	/** Optional alternate element for measurement (e.g. hidden measurement line). */
	measureLineId?: string
}

/**
 * Receives the latest measurement together with the request it was measured
 * for. Consumers whose request changes over time (e.g. the cursor) can use
 * the echoed request to ignore stale measurements taken for an old target.
 */
type TextMeasurementListener = (measurement: TextMeasurement | null, request: TextMeasurementRequest) => void

const STABLE_FRAME_LIMIT = 3
const STABILITY_GRACE_MS = 100

function rectToMeasurement(
	blockRect: DOMRect,
	lineRect: DOMRect,
	textOffsetX: number,
	textWidth: number,
): TextMeasurement {
	return {
		lineTop: lineRect.top - blockRect.top,
		lineLeft: lineRect.left - blockRect.left,
		lineHeight: lineRect.height,
		textOffsetX,
		textWidth,
	}
}

export class NeoCodeMeasurementsManager {
	private codeBlockEl: HTMLPreElement | null = null
	private lineElsById = new Map<string, HTMLElement>()
	private lineContainerElsById = new Map<string, HTMLElement>()
	private measureLineElsById = new Map<string, HTMLElement>()

	private requestsByKey = new Map<string, TextMeasurementRequest>()
	private listenersByKey = new Map<string, Set<TextMeasurementListener>>()

	private latestByKey = new Map<string, TextMeasurement | null>()
	private initializedKeys = new Set<string>()

	private mutationObserver: MutationObserver | null = null
	private resizeObserver: ResizeObserver | null = null

	private rafId: number | null = null
	private dirty = false
	private activeUntil = 0
	private stableFrameCount = 0
	private allowStableStopAfter = 0

	private measureSpan: HTMLSpanElement | null = null
	private measureSpanFont = ""
	private widthCache = new Map<string, number>()

	setCodeBlockElement(el: HTMLPreElement | null) {
		if (this.codeBlockEl === el) return

		this.detachObservers()
		this.codeBlockEl = el
		this.lineElsById.clear()
		this.lineContainerElsById.clear()
		this.measureLineElsById.clear()

		if (el) {
			this.attachObservers(el)
			this.markDirty()
		}
	}

	/**
	 * Subscribe to updates for a specific measurement request.
	 * Key should be stable per consumer; request can change over time.
	 */
	subscribe(key: string, request: TextMeasurementRequest, listener: TextMeasurementListener): () => void {
		this.requestsByKey.set(key, request)

		let listeners = this.listenersByKey.get(key)
		if (!listeners) {
			listeners = new Set()
			this.listenersByKey.set(key, listeners)
		}
		listeners.add(listener)

		// Push latest immediately if we have it
		if (this.latestByKey.has(key)) {
			listener(this.latestByKey.get(key) ?? null, request)
		} else {
			this.markDirty()
		}

		return () => {
			const set = this.listenersByKey.get(key)
			if (set) {
				set.delete(listener)
				if (set.size === 0) {
					this.listenersByKey.delete(key)
					this.requestsByKey.delete(key)
					this.latestByKey.delete(key)
					this.initializedKeys.delete(key)
				}
			}
		}
	}

	updateRequest(key: string, request: TextMeasurementRequest) {
		const prev = this.requestsByKey.get(key)
		if (
			prev &&
			prev.lineId === request.lineId &&
			prev.lineText === request.lineText &&
			prev.start === request.start &&
			prev.end === request.end &&
			prev.measureLineId === request.measureLineId
		) {
			return
		}
		this.requestsByKey.set(key, request)
		this.markDirty()
	}

	getHasInitialized(key: string): boolean {
		return this.initializedKeys.has(key)
	}

	activateFor(ms: number) {
		const now = performance.now()
		this.activeUntil = Math.max(this.activeUntil, now + ms)
		this.stableFrameCount = 0
		this.allowStableStopAfter = now + STABILITY_GRACE_MS
		if (this.requestsByKey.size === 0) return
		this.ensureRaf()
	}

	dispose() {
		this.detachObservers()
		this.codeBlockEl = null
		this.lineElsById.clear()
		this.lineContainerElsById.clear()
		this.measureLineElsById.clear()
		this.requestsByKey.clear()
		this.listenersByKey.clear()
		this.latestByKey.clear()
		this.initializedKeys.clear()
		this.widthCache.clear()

		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId)
			this.rafId = null
		}

		if (this.measureSpan) {
			this.measureSpan.remove()
			this.measureSpan = null
		}
	}

	private attachObservers(el: HTMLPreElement) {
		// Only observe structural DOM changes, not per-frame style updates
		this.mutationObserver = new MutationObserver(() => {
			this.lineElsById.clear()
			this.lineContainerElsById.clear()
			this.measureLineElsById.clear()
			this.markDirty()
		})
		this.mutationObserver.observe(el, {
			childList: true,
			subtree: false,
		})

		this.resizeObserver = new ResizeObserver(() => {
			this.markDirty()
		})
		this.resizeObserver.observe(el)
	}

	private detachObservers() {
		this.mutationObserver?.disconnect()
		this.mutationObserver = null
		this.resizeObserver?.disconnect()
		this.resizeObserver = null
	}

	private markDirty() {
		this.dirty = true
		this.stableFrameCount = 0
		this.ensureRaf()
	}

	private ensureRaf() {
		if (this.rafId !== null) return
		this.rafId = requestAnimationFrame(this.onFrame)
	}

	private onFrame = () => {
		this.rafId = null

		const now = performance.now()
		if (!this.codeBlockEl) return

		let measurementsChanged = false
		if (this.dirty || now < this.activeUntil) {
			measurementsChanged = this.measureAll()
		}

		if (measurementsChanged) {
			this.stableFrameCount = 0
		} else {
			this.stableFrameCount += 1
		}

		const transitionMayStillMove =
			now < this.activeUntil && (now < this.allowStableStopAfter || this.stableFrameCount < STABLE_FRAME_LIMIT)
		if (this.dirty || transitionMayStillMove) {
			this.ensureRaf()
		}
	}

	private ensureMeasureSpan() {
		if (this.measureSpan) return this.measureSpan

		const span = document.createElement("span")
		span.style.visibility = "hidden"
		span.style.position = "absolute"
		span.style.whiteSpace = "pre"
		span.style.pointerEvents = "none"
		span.style.top = "0"
		span.style.left = "0"
		span.style.contain = "layout style"
		document.body.appendChild(span)

		this.measureSpan = span
		return span
	}

	private measureTextWidth(font: string, text: string): number {
		const cacheKey = `${font}\u0000${text}`
		const cached = this.widthCache.get(cacheKey)
		if (cached !== undefined) return cached

		const span = this.ensureMeasureSpan()
		if (this.measureSpanFont !== font) {
			span.style.font = font
			this.measureSpanFont = font
			// Font changed => widths invalid
			this.widthCache.clear()
		}

		span.textContent = text
		const width = span.offsetWidth
		this.widthCache.set(cacheKey, width)
		return width
	}

	/**
	 * Measure text position using DOM Range API.
	 * This measures the actual rendered position, accounting for icons and other non-text elements.
	 *
	 * Hidden parts stay mounted with their text (see AnimatedPart), marked
	 * with `data-measure-exclude`. The walker skips them so character
	 * offsets keep matching the line's VISIBLE text.
	 */
	private measureWithRange(
		lineEl: HTMLElement,
		blockRect: DOMRect,
		lineRect: DOMRect,
		start: number,
		end: number,
	): TextMeasurement | null {
		// Walk text nodes to find the range boundaries
		const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT, {
			acceptNode: (node) =>
				node.parentElement?.closest("[data-measure-exclude]") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
		})
		let charOffset = 0
		let startNode: Text | null = null
		let startOffset = 0
		let endNode: Text | null = null
		let endOffset = 0

		let node: Text | null
		while ((node = walker.nextNode() as Text | null)) {
			const nodeLength = node.textContent?.length ?? 0

			// Check if start falls within this node
			if (!startNode && charOffset + nodeLength > start) {
				startNode = node
				startOffset = start - charOffset
			}

			// Check if end falls within this node
			if (!endNode && charOffset + nodeLength >= end) {
				endNode = node
				endOffset = end - charOffset
				break
			}

			charOffset += nodeLength
		}

		if (!startNode || !endNode) return null

		try {
			const range = document.createRange()
			range.setStart(startNode, startOffset)
			range.setEnd(endNode, endOffset)

			const rangeRect = range.getBoundingClientRect()

			// textOffsetX is relative to line start
			const textOffsetX = rangeRect.left - lineRect.left
			const textWidth = rangeRect.width

			return {
				lineTop: lineRect.top - blockRect.top,
				lineLeft: lineRect.left - blockRect.left,
				lineHeight: lineRect.height,
				textOffsetX,
				textWidth,
			}
		} catch {
			return null
		}
	}

	private getLineElement(lineId: string): HTMLElement | null {
		const cached = this.lineElsById.get(lineId)
		if (cached?.isConnected) return cached
		const el = this.codeBlockEl?.querySelector(`[data-line-id="${lineId}"]`) as HTMLElement | null
		if (el) this.lineElsById.set(lineId, el)
		return el
	}

	private getLineContainerElement(lineId: string): HTMLElement | null {
		const cached = this.lineContainerElsById.get(lineId)
		if (cached?.isConnected) return cached
		const el = this.codeBlockEl?.querySelector(`[data-line-container-id="${lineId}"]`) as HTMLElement | null
		if (el) this.lineContainerElsById.set(lineId, el)
		return el
	}

	private getMeasureLineElement(lineId: string): HTMLElement | null {
		const cached = this.measureLineElsById.get(lineId)
		if (cached?.isConnected) return cached
		const el = this.codeBlockEl?.querySelector(`[data-measure-line-id="${lineId}"]`) as HTMLElement | null
		if (el) this.measureLineElsById.set(lineId, el)
		return el
	}

	private shallowEqual(a: TextMeasurement | null | undefined, b: TextMeasurement | null): boolean {
		if (a === b) return true
		if (!a || !b) return false
		return (
			a.lineTop === b.lineTop &&
			a.lineLeft === b.lineLeft &&
			a.lineHeight === b.lineHeight &&
			a.textOffsetX === b.textOffsetX &&
			a.textWidth === b.textWidth
		)
	}

	private measureAll(): boolean {
		this.dirty = false

		if (this.requestsByKey.size === 0) return false

		const codeBlock = this.codeBlockEl
		if (!codeBlock) return false

		let measurementsChanged = false

		// Read layout once per frame
		const blockRect = codeBlock.getBoundingClientRect()
		const font = window.getComputedStyle(codeBlock).font

		// Compute per-line rect + opacity once
		const lineRectByEl = new Map<HTMLElement, DOMRect>()
		const lineOpacityById = new Map<string, number>()

		for (const request of this.requestsByKey.values()) {
			if (!lineOpacityById.has(request.lineId)) {
				const lineEl = this.getLineContainerElement(request.lineId) ?? this.getLineElement(request.lineId)
				if (lineEl) {
					// Preserve previous behavior: ignore lines animating out
					const opacity = parseFloat(window.getComputedStyle(lineEl).opacity || "1")
					lineOpacityById.set(request.lineId, opacity)
				}
			}

			const measureEl =
				(request.measureLineId && this.getMeasureLineElement(request.measureLineId)) ??
				this.getLineElement(request.lineId)
			if (!measureEl || lineRectByEl.has(measureEl)) continue
			lineRectByEl.set(measureEl, measureEl.getBoundingClientRect())
		}

		for (const [key, request] of this.requestsByKey.entries()) {
			const opacity = lineOpacityById.get(request.lineId) ?? 1
			const measureEl =
				(request.measureLineId && this.getMeasureLineElement(request.measureLineId)) ??
				this.getLineElement(request.lineId)
			const lineRect = measureEl ? lineRectByEl.get(measureEl) : undefined

			const prev = this.latestByKey.get(key)
			// Preserve previous behavior: keep last known measurement when we can't
			// safely measure (e.g. line is fading out or not yet mounted).
			let measurement: TextMeasurement | null = prev ?? null
			if (lineRect && measureEl && opacity >= 0.5) {
				// Use Range API for accurate measurement of actual rendered DOM
				measurement = this.measureWithRange(measureEl, blockRect, lineRect, request.start, request.end)

				// Fallback to text-based measurement if Range fails
				if (!measurement) {
					const prefix = request.lineText.slice(0, request.start)
					const rangeText = request.lineText.slice(request.start, request.end)
					const textOffsetX = this.measureTextWidth(font, prefix)
					const textWidth = this.measureTextWidth(font, rangeText)
					measurement = rectToMeasurement(blockRect, lineRect, textOffsetX, textWidth)
				}
			}

			if (measurement && !this.initializedKeys.has(key)) {
				this.initializedKeys.add(key)
			}

			if (!this.shallowEqual(prev, measurement)) {
				measurementsChanged = true
				this.latestByKey.set(key, measurement)
				const listeners = this.listenersByKey.get(key)
				if (listeners) {
					for (const listener of listeners) {
						listener(measurement, request)
					}
				}
			}
		}

		return measurementsChanged
	}
}
