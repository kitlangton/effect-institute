import type { Application, BlurFilter } from "pixi.js"

export function getDevicePixelRatio() {
	return window.devicePixelRatio || 1
}

export function isPixiRendererDestroyed(app: Application) {
	const renderer = app.renderer as { destroyed?: boolean } | null | undefined
	return renderer == null || Boolean(renderer.destroyed)
}

export function isPixiApplicationUsable(app: Application | null): app is Application {
	return app !== null && !isPixiRendererDestroyed(app)
}

export function destroyBlurFilter(filter: BlurFilter | null | undefined) {
	if (!filter) return
	filter.blurXFilter.destroy()
	filter.blurYFilter.destroy()
	filter.destroy()
}
